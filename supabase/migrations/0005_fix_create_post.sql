-- ULISSES LIVE: create_post falhava sempre ("column reference body is ambiguous")
-- porque as variáveis author/body/emoji tinham o mesmo nome das colunas de posts.
-- Também corrige a checagem de mensagem repetida, que comparava body com ele mesmo.
create or replace function public.create_post(
  p_slug text,
  p_visitor_id text,
  p_type text,
  p_author text,
  p_body text,
  p_emoji text,
  p_image_consent boolean,
  p_instagram_consent boolean,
  p_honeypot text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  recent integer;
  daily integer;
  result jsonb;
  new_id uuid;
  v_author text := nullif(trim(coalesce(p_author, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
  allowed text[] := array['👏','❤️','😍','🚀','🤩','🙌','💡','🎉','👍'];
begin
  if coalesce(p_honeypot, '') <> '' then
    raise exception 'Não foi possível enviar.';
  end if;
  if p_visitor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Identificador do navegador inválido. Recarregue a página.';
  end if;
  if p_type not in ('message', 'photo', 'video', 'reaction') then
    raise exception 'Tipo de participação inválido.';
  end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if ev.status <> 'live' then raise exception 'Este evento não está recebendo participações agora.'; end if;

  if p_type = 'reaction' then
    select count(*) into recent from public.posts
      where event_id = ev.id and visitor_id = p_visitor_id and type = 'reaction' and created_at > now() - interval '10 minutes';
    if recent >= 30 then raise exception 'Você enviou muitas reações. Espere um pouco.'; end if;
    if v_emoji is null or not (v_emoji = any(allowed)) or v_body is not null then
      raise exception 'Escolha um emoji da lista.';
    end if;
    result := jsonb_build_object('label','emoji','status','approved','audience','public','note','Reação da lista oficial, sem texto livre. Publicada direto no painel.','aiUsed', false);
  else
    select count(*) into recent from public.posts
      where event_id = ev.id and visitor_id = p_visitor_id and type <> 'reaction' and created_at > now() - interval '10 minutes';
    select count(*) into daily from public.posts
      where event_id = ev.id and visitor_id = p_visitor_id and type <> 'reaction' and created_at > now() - interval '24 hours';
    if recent >= 8 or daily >= 30 then
      raise exception 'Limite de envios deste navegador atingido. Tente mais tarde.';
    end if;
    if v_author is null or char_length(v_author) < 2 or char_length(v_author) > 40 or v_author ~ '[0-9]' then
      raise exception 'Informe um nome de exibição com 2 a 40 caracteres, só com letras.';
    end if;
    if p_type = 'message' and (v_body is null or char_length(v_body) > ev.message_max_chars) then
      raise exception 'Escreva uma mensagem de até % caracteres.', ev.message_max_chars;
    end if;
    if v_body is not null and char_length(v_body) > ev.message_max_chars then
      raise exception 'A legenda pode ter no máximo % caracteres.', ev.message_max_chars;
    end if;
    if v_emoji is not null and not (v_emoji = any(allowed)) then
      raise exception 'Escolha um emoji da lista.';
    end if;
    if p_type in ('photo', 'video') and coalesce(p_image_consent, false) = false then
      raise exception 'Para enviar foto ou vídeo, autorize o uso da imagem neste painel do evento.';
    end if;
    if v_body is not null and (
      select count(*) from public.posts
      where event_id = ev.id and visitor_id = p_visitor_id and posts.body = v_body and created_at > now() - interval '24 hours'
    ) >= 2 then
      raise exception 'Esta mensagem já foi enviada algumas vezes. Escreva algo novo.';
    end if;
    result := public.classify_text(trim(coalesce(v_author, '') || ' ' || coalesce(v_body, '')));
    if p_type in ('photo', 'video') and result->>'status' <> 'rejected' and result->>'audience' <> 'admin' then
      result := result || jsonb_build_object(
        'label', 'media_review',
        'status', 'pending',
        'audience', 'public',
        'note', 'Classificação automática por regras (não é inteligência artificial): fotografia ou vídeo aguarda revisão humana antes do painel.'
      );
    elsif p_type = 'message' and result->>'status' = 'approved' and ev.auto_approve_clean_messages = false then
      result := result || jsonb_build_object(
        'status', 'pending',
        'note', result->>'note' || ' A escola desligou a publicação automática.'
      );
    end if;
  end if;

  insert into public.posts (
    event_id, visitor_id, type, author_name, body, emoji, status, moderation_note, moderation_label,
    audience, ai_used, image_consent, instagram_consent
  ) values (
    ev.id, p_visitor_id, p_type, v_author, v_body, v_emoji, result->>'status', result->>'note', result->>'label',
    result->>'audience', false, coalesce(p_image_consent, false), coalesce(p_instagram_consent, false)
  ) returning id into new_id;
  perform public.touch_event(ev.id);
  return jsonb_build_object('postId', new_id, 'moderation', result);
end;
$$;
