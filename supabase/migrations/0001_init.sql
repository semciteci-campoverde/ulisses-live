-- ULISSES LIVE — Feira do Conhecimento 2026
-- Cole este arquivo no SQL Editor do Supabase (projeto gratuito) ou rode com a CLI.
-- Não cria usuário administrador: depois, crie o login em Authentication e
-- insira o id dele em public.admin_users (instruções no README).

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  institution text not null,
  municipality text not null,
  state text not null,
  theme text not null,
  slogan text not null,
  description text not null,
  internal_date date not null,
  public_date date not null,
  public_hours text not null,
  instagram_handle text not null,
  instagram_url text not null,
  status text not null default 'live' check (status in ('draft', 'live', 'ended')),
  is_demo boolean not null default false,
  logo_path text,
  scene_duration_seconds integer not null default 12,
  goals_json jsonb not null default '[50,100,200,300,500,1000]'::jsonb,
  retention_days integer not null default 365,
  emergency_stop boolean not null default false,
  mural_enabled boolean not null default true,
  video_max_seconds integer not null default 15,
  video_max_bytes integer not null default 26214400,
  photo_max_count integer not null default 5,
  message_max_chars integer not null default 200,
  auto_approve_clean_messages boolean not null default true,
  tv_epoch timestamptz not null default now(),
  celebration_goal integer,
  celebration_until timestamptz,
  celebrated_goals_json jsonb not null default '[]'::jsonb,
  colors_json jsonb not null default '{"navy":"#071433","royal":"#1347e6","gold":"#f0c14d","ink":"#f7f4ea"}'::jsonb,
  scenes_json jsonb not null default '{"messages":true,"photos":true,"videos":true,"counter":true,"invite":true,"instagram":true}'::jsonb,
  welcome_text text not null,
  presence_count integer not null default 0,
  feed_version integer not null default 0,
  ai_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  visitor_id text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (event_id, visitor_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  visitor_id text not null,
  type text not null check (type in ('message', 'photo', 'video', 'reaction')),
  author_name text,
  body text,
  emoji text,
  status text not null check (status in ('pending', 'approved', 'rejected', 'removed')),
  moderation_note text,
  moderation_label text,
  audience text not null default 'public' check (audience in ('public', 'admin')),
  sentiment text,
  ai_used boolean not null default false,
  is_highlight boolean not null default false,
  instagram_consent boolean not null default false,
  image_consent boolean not null default false,
  category text,
  comms_format text,
  suggested_caption text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  public_path text,
  mime text not null,
  bytes integer not null,
  width integer,
  height integer,
  duration_seconds numeric,
  sort_order integer not null default 0
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_event on public.posts (event_id, created_at desc);
create index if not exists idx_presences_event on public.presences (event_id, created_at);
create index if not exists idx_media_post on public.post_media (post_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.fold_text(p_text text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(p_text, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn');
$$;

create or replace function public.squeeze_text(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_text, ''), '(.)\1+', '\1', 'g');
$$;

-- Normaliza ofuscação: acento, leet colado em letra, repetição e "p o r r a".
create or replace function public.normalize_school_text(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  t text := public.fold_text(coalesce(p_text, ''));
  parts text[];
  part text;
  buf text := '';
  out text := '';
  squeezed text;
  joined boolean;
begin
  t := replace(t, '@', 'a');
  t := replace(t, '$', 's');
  t := regexp_replace(t, '([a-z])[|!]([a-z])', '\1i\2', 'g');
  t := regexp_replace(t, '([a-z])0([a-z])', '\1o\2', 'g');
  t := regexp_replace(t, '([a-z])0', '\1o', 'g');
  t := regexp_replace(t, '0([a-z])', 'o\1', 'g');
  t := regexp_replace(t, '([a-z])1([a-z])', '\1i\2', 'g');
  t := regexp_replace(t, '([a-z])3([a-z])', '\1e\2', 'g');
  t := regexp_replace(t, '([a-z])4([a-z])', '\1a\2', 'g');
  t := regexp_replace(t, '([a-z])5([a-z])', '\1s\2', 'g');
  t := regexp_replace(t, '([a-z])7([a-z])', '\1t\2', 'g');
  t := regexp_replace(t, '[^a-z\s]', ' ', 'g');
  t := regexp_replace(t, '(.)\1{2,}', '\1\1', 'g');
  t := trim(regexp_replace(t, '\s+', ' ', 'g'));
  if t = '' then return ''; end if;
  parts := regexp_split_to_array(t, ' ');
  foreach part in array parts loop
    if part is null or part = '' then continue; end if;
    if char_length(part) = 1 then
      buf := buf || part;
    else
      if buf <> '' then
        squeezed := public.squeeze_text(buf);
        joined := char_length(buf) >= 3 or squeezed in ('porra','caralho','merda','foda','cu','puta','vsf','vtnc','pqp','krl','buceta');
        if joined then out := out || ' ' || buf; else out := out || ' ' || trim(regexp_replace(buf, '(.)', '\1 ', 'g')); end if;
        buf := '';
      end if;
      out := out || ' ' || part;
    end if;
  end loop;
  if buf <> '' then
    squeezed := public.squeeze_text(buf);
    joined := char_length(buf) >= 3 or squeezed in ('porra','caralho','merda','foda','cu','puta','vsf','vtnc','pqp','krl','buceta');
    if joined then out := out || ' ' || buf; else out := out || ' ' || trim(regexp_replace(buf, '(.)', '\1 ', 'g')); end if;
  end if;
  return trim(regexp_replace(out, '\s+', ' ', 'g'));
end;
$$;

-- Classificador de regras. Mantenha alinhado com shared/moderation.ts.
-- Não é inteligência artificial. Mensagem positiva e limpa já sai aprovada.
create or replace function public.classify_text(p_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
  raw text := coalesce(p_text, '');
  norm text := public.normalize_school_text(raw);
  squeezed text := public.squeeze_text(norm);
  word text;
  note_rules text := 'Classificação automática por regras (não é inteligência artificial): ';
  blocked text[] := array[
    'porra','poha','caralho','carai','cacete','krl','pqp','vsf','vtnc','fdp','merda','bosta','cu',
    'foda','foder','fodase','fuder','arrombado','arrombada','otario','otaria','idiota','imbecil','babaca',
    'nojento','nojenta','vagabundo','vagabunda','retardado','retardada','buceta','boceta','puta','puto',
    'putaria','vadia','pornografia','porno','porn','nudes','punheta','boquete','xoxota','piroca','onlyfans',
    'estupro','estuprar','pedofilia','nazista','nazi','viado','viada','bicha','baitola'
  ];
  phrases text[] := array['vai se foder','vai se ferrar','tomar no cu','filho da puta','filha da puta','cala a boca','seu burro','sua burra','seu lixo','seu idiota'];
  criticism text[] := array[
    'nao gostei','nao recomendo','poderia melhorar','precisa melhorar','faltou organiz','mal organizado',
    'desorganizado','reclamacao','reclamar','decepcion','muito ruim','que absurdo','indignado','fila enorme',
    'fila grande','demorou demais','falta de organizacao','pior evento'
  ];
  sensitive text[] := array['sexo','sexual','nudez','pelado','pelada','droga','drogas','violencia','suicidio','matar','morte','arma','armas','sangue','odio','racismo','machismo','homofobia','bullying','preconceito'];
  spam text[] := array['ganhe dinheiro','clique aqui','cassino','apostas','compre agora','whatsapp','pix de','siga meu'];
  positive text[] := array[
    'parabens','orgulho','lindo','linda','lindos','lindas','incrivel','amei','adorei','maravilh','excelente',
    'otimo','otima','inspir','arrasou','sensacional','perfeito','perfeita','obrigado','obrigada','sucesso',
    'feliz','brilhant','fantast','talentoso','talentosa','emocion','espetac','gratidao','alegria'
  ];
  positive_hit boolean := false;
begin
  if raw ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
     or raw ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}'
     or raw ~ '(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[-\s.]?\d{4}' then
    return jsonb_build_object('label','personal_data','status','pending','audience','admin','note', note_rules || 'possível telefone, e-mail ou CPF. Fica só na administração.','aiUsed', false, 'sentiment', null);
  end if;
  foreach word in array blocked loop
    if norm ~ ('(^|[^a-z])' || word || '([^a-z]|$)') or squeezed ~ ('(^|[^a-z])' || public.squeeze_text(word) || '([^a-z]|$)') then
      return jsonb_build_object('label','blocked','status','rejected','audience','public','note', note_rules || 'termo ofensivo ou inadequado. Não publicada no painel.','aiUsed', false, 'sentiment', 'negative');
    end if;
  end loop;
  foreach word in array phrases loop
    if position(word in norm) > 0 or position(public.squeeze_text(word) in squeezed) > 0 then
      return jsonb_build_object('label','blocked','status','rejected','audience','public','note', note_rules || 'ofensa. Não publicada no painel.','aiUsed', false, 'sentiment', 'negative');
    end if;
  end loop;
  if raw ~* 'https?://|www\.' then
    return jsonb_build_object('label','spam','status','rejected','audience','public','note', note_rules || 'link ou anúncio. Não publicada no painel.','aiUsed', false, 'sentiment', 'negative');
  end if;
  foreach word in array spam loop
    if position(word in norm) > 0 then
      return jsonb_build_object('label','spam','status','rejected','audience','public','note', note_rules || 'propaganda. Não publicada no painel.','aiUsed', false, 'sentiment', 'negative');
    end if;
  end loop;
  foreach word in array criticism loop
    if position(word in norm) > 0 then
      return jsonb_build_object('label','criticism','status','pending','audience','admin','note', note_rules || 'crítica. Encaminhada somente à equipe.','aiUsed', false, 'sentiment', 'negative');
    end if;
  end loop;
  if position('fila' in norm) > 0 and (position('enorme' in norm) > 0 or position('grande' in norm) > 0 or position('demor' in norm) > 0) then
    return jsonb_build_object('label','criticism','status','pending','audience','admin','note', note_rules || 'crítica. Encaminhada somente à equipe.','aiUsed', false, 'sentiment', 'negative');
  end if;
  foreach word in array sensitive loop
    if norm ~ ('(^|[^a-z])' || word || '([^a-z]|$)') then
      return jsonb_build_object('label','sensitive','status','pending','audience','public','note', note_rules || 'termo sensível. Aguardando revisão humana.','aiUsed', false, 'sentiment', null);
    end if;
  end loop;
  foreach word in array positive loop
    if norm ~ ('(^|[^a-z])' || word) then
      positive_hit := true;
    end if;
  end loop;
  if norm ~ '(^|[^a-z])(top|show|bacana)([^a-z]|$)' and char_length(norm) <= 48 then
    positive_hit := true;
  end if;
  if positive_hit and position('pessimo' in norm) = 0 and position('horrivel' in norm) = 0 and position('odiei' in norm) = 0 then
    return jsonb_build_object('label','positive','status','approved','audience','public','note', note_rules || 'mensagem positiva e sem termo proibido. Publicada no painel.','aiUsed', false, 'sentiment', 'positive');
  end if;
  if position('pessimo' in norm) > 0 or position('horrivel' in norm) > 0 or position('odiei' in norm) > 0 or position('vergonha' in norm) > 0 then
    return jsonb_build_object('label','criticism','status','pending','audience','admin','note', note_rules || 'tom negativo. Encaminhada somente à equipe.','aiUsed', false, 'sentiment', 'negative');
  end if;
  return jsonb_build_object('label','neutral','status','pending','audience','public','note', note_rules || 'texto neutro, sem elogio claro. Aguardando revisão humana.','aiUsed', false, 'sentiment', 'neutral');
end;
$$;

create or replace function public.touch_event(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
    set feed_version = feed_version + 1,
        presence_count = (select count(*) from public.presences where event_id = p_event),
        updated_at = now()
  where id = p_event;
end;
$$;

create or replace function public.register_presence(p_slug text, p_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  inserted integer;
  total integer;
  goals jsonb;
  done jsonb;
  goal integer;
  hit integer;
  until_at timestamptz;
begin
  if p_visitor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Identificador do navegador inválido. Recarregue a página.';
  end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if ev.status <> 'live' then raise exception 'Este evento não está recebendo presenças agora.'; end if;
  insert into public.presences (event_id, visitor_id, user_agent)
  values (ev.id, p_visitor_id, left(coalesce(current_setting('request.headers', true), ''), 180))
  on conflict (event_id, visitor_id) do nothing;
  get diagnostics inserted = row_count;
  select count(*) into total from public.presences where event_id = ev.id;
  if inserted > 0 then
    goals := ev.goals_json;
    done := ev.celebrated_goals_json;
    select max(value::int) into hit
    from jsonb_array_elements_text(goals) as value
    where value::int <= total
      and not done @> jsonb_build_array(value::int);
    if hit is not null then
      until_at := now() + interval '20 seconds';
      update public.events
        set celebration_goal = hit,
            celebration_until = until_at,
            celebrated_goals_json = (
              select coalesce(jsonb_agg(distinct item), '[]'::jsonb)
              from (
                select jsonb_array_elements(done) as item
                union all
                select to_jsonb(value::int)
                from jsonb_array_elements_text(goals) as value
                where value::int <= total
              ) gathered
            )
      where id = ev.id;
      goal := hit;
    end if;
  end if;
  perform public.touch_event(ev.id);
  return jsonb_build_object('already', inserted = 0, 'total', total, 'celebration', case when goal is null then null else jsonb_build_object('goal', goal, 'total', total) end);
end;
$$;

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
  author text := nullif(trim(coalesce(p_author, '')), '');
  body text := nullif(trim(coalesce(p_body, '')), '');
  emoji text := nullif(trim(coalesce(p_emoji, '')), '');
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
    if emoji is null or not (emoji = any(allowed)) or body is not null then
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
    if author is null or char_length(author) < 2 or char_length(author) > 40 or author ~ '[0-9]' then
      raise exception 'Informe um nome de exibição com 2 a 40 caracteres, só com letras.';
    end if;
    if p_type = 'message' and (body is null or char_length(body) > ev.message_max_chars) then
      raise exception 'Escreva uma mensagem de até % caracteres.', ev.message_max_chars;
    end if;
    if body is not null and char_length(body) > ev.message_max_chars then
      raise exception 'A legenda pode ter no máximo % caracteres.', ev.message_max_chars;
    end if;
    if emoji is not null and not (emoji = any(allowed)) then
      raise exception 'Escolha um emoji da lista.';
    end if;
    if p_type in ('photo', 'video') and coalesce(p_image_consent, false) = false then
      raise exception 'Para enviar foto ou vídeo, autorize o uso da imagem neste painel do evento.';
    end if;
    if body is not null and (
      select count(*) from public.posts
      where event_id = ev.id and visitor_id = p_visitor_id and body = body and created_at > now() - interval '24 hours'
    ) >= 2 then
      raise exception 'Esta mensagem já foi enviada algumas vezes. Escreva algo novo.';
    end if;
    result := public.classify_text(trim(coalesce(author, '') || ' ' || coalesce(body, '')));
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
    ev.id, p_visitor_id, p_type, author, body, emoji, result->>'status', result->>'note', result->>'label',
    result->>'audience', false, coalesce(p_image_consent, false), coalesce(p_instagram_consent, false)
  ) returning id into new_id;
  perform public.touch_event(ev.id);
  return jsonb_build_object('postId', new_id, 'moderation', result);
end;
$$;

create or replace function public.register_media(
  p_post_id uuid,
  p_visitor_id text,
  p_path text,
  p_mime text,
  p_bytes integer,
  p_duration numeric,
  p_sort integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post public.posts%rowtype;
  ev public.events%rowtype;
begin
  select * into post from public.posts where id = p_post_id;
  if not found or post.visitor_id <> p_visitor_id then
    raise exception 'Publicação não encontrada.';
  end if;
  if post.type not in ('photo', 'video') or post.status <> 'pending' then
    raise exception 'Este envio não aceita arquivo agora.';
  end if;
  if p_path not like 'pending/' || p_post_id::text || '/%' then
    raise exception 'Caminho de arquivo inválido.';
  end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm') then
    raise exception 'Formato não aceito. Use JPEG, PNG ou WEBP para fotos e MP4 ou WEBM para vídeos.';
  end if;
  select * into ev from public.events where id = post.event_id;
  if post.type = 'photo' and (p_mime like 'video/%' or p_bytes > 5242880) then
    raise exception 'A imagem ficou grande demais ou não é uma fotografia.';
  end if;
  if post.type = 'video' then
    if p_mime not like 'video/%' then raise exception 'Envie um vídeo MP4 ou WEBM.'; end if;
    if p_bytes > ev.video_max_bytes then raise exception 'O vídeo está grande demais.'; end if;
    if p_duration is not null and p_duration > ev.video_max_seconds + 0.4 then
      raise exception 'O vídeo precisa ter no máximo % segundos.', ev.video_max_seconds;
    end if;
  end if;
  insert into public.post_media (post_id, storage_path, mime, bytes, duration_seconds, sort_order)
  values (p_post_id, p_path, p_mime, p_bytes, p_duration, coalesce(p_sort, 0));
end;
$$;

create or replace function public.delete_mine(p_slug text, p_visitor_id text, p_scope text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_id uuid;
begin
  select id into ev_id from public.events where slug = p_slug;
  if ev_id is null then raise exception 'Evento não encontrado.'; end if;
  if p_scope in ('content', 'all') then
    delete from storage.objects
    where name in (
      select storage_path from public.post_media m
      join public.posts p on p.id = m.post_id
      where p.event_id = ev_id and p.visitor_id = p_visitor_id and m.storage_path is not null
      union
      select public_path from public.post_media m
      join public.posts p on p.id = m.post_id
      where p.event_id = ev_id and p.visitor_id = p_visitor_id and m.public_path is not null
    );
    delete from public.posts where event_id = ev_id and visitor_id = p_visitor_id;
  end if;
  if p_scope in ('presence', 'all') then
    delete from public.presences where event_id = ev_id and visitor_id = p_visitor_id;
  end if;
  perform public.touch_event(ev_id);
end;
$$;

create or replace function public.purge_demo(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
begin
  if not public.is_admin() then raise exception 'Entre com a conta da equipe.'; end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if not ev.is_demo then raise exception 'Só é possível apagar dados do modo de demonstração.'; end if;
  delete from storage.objects
  where name in (
    select storage_path from public.post_media m join public.posts p on p.id = m.post_id where p.event_id = ev.id and storage_path is not null
    union
    select public_path from public.post_media m join public.posts p on p.id = m.post_id where p.event_id = ev.id and public_path is not null
  );
  delete from public.posts where event_id = ev.id;
  delete from public.presences where event_id = ev.id;
  update public.events
    set presence_count = 0, celebration_goal = null, celebration_until = null, celebrated_goals_json = '[]'::jsonb
  where id = ev.id;
  perform public.touch_event(ev.id);
end;
$$;

create or replace function public.seed_demo(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
begin
  if not public.is_admin() then raise exception 'Entre com a conta da equipe.'; end if;
  select * into ev from public.events where slug = p_slug;
  if not found or not ev.is_demo then raise exception 'Os exemplos só podem entrar no modo de demonstração.'; end if;
  if exists(select 1 from public.posts where event_id = ev.id and moderation_note = 'Exemplo do modo demonstração.') then
    return;
  end if;
  insert into public.presences (event_id, visitor_id, user_agent) values
    (ev.id, '00000000-0000-4000-8000-000000000001', 'demonstracao'),
    (ev.id, '00000000-0000-4000-8000-000000000002', 'demonstracao'),
    (ev.id, '00000000-0000-4000-8000-000000000003', 'demonstracao'),
    (ev.id, '00000000-0000-4000-8000-000000000004', 'demonstracao');
  insert into public.posts (event_id, visitor_id, type, author_name, body, emoji, status, moderation_note, moderation_label, audience) values
    (ev.id, '00000000-0000-4000-8000-000000000001', 'message', 'Ana', 'A feira está linda. Orgulho da nossa escola!', '🤩', 'approved', 'Exemplo do modo demonstração.', 'clean', 'public'),
    (ev.id, '00000000-0000-4000-8000-000000000002', 'message', 'Pedro', 'Ciência que transforma o futuro. Parabéns, estudantes!', '🚀', 'approved', 'Exemplo do modo demonstração.', 'clean', 'public'),
    (ev.id, '00000000-0000-4000-8000-000000000003', 'message', 'Marina', 'Que alegria ver a comunidade reunida em Campo Verde.', '👏', 'approved', 'Exemplo do modo demonstração.', 'clean', 'public'),
    (ev.id, '00000000-0000-4000-8000-000000000004', 'message', 'Lucas', 'Ideias que constroem o futuro. Viva o Ulisses!', '💡', 'approved', 'Exemplo do modo demonstração.', 'clean', 'public');
  perform public.touch_event(ev.id);
end;
$$;

create or replace function public.apply_retention(p_slug text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  removed integer;
begin
  if not public.is_admin() then raise exception 'Entre com a conta da equipe.'; end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'Evento não encontrado.'; end if;
  delete from storage.objects
  where name in (
    select storage_path from public.post_media m join public.posts p on p.id = m.post_id
      where p.event_id = ev.id and p.created_at < now() - (ev.retention_days || ' days')::interval and storage_path is not null
    union
    select public_path from public.post_media m join public.posts p on p.id = m.post_id
      where p.event_id = ev.id and p.created_at < now() - (ev.retention_days || ' days')::interval and public_path is not null
  );
  delete from public.posts where event_id = ev.id and created_at < now() - (ev.retention_days || ' days')::interval;
  get diagnostics removed = row_count;
  delete from public.presences where event_id = ev.id and created_at < now() - (ev.retention_days || ' days')::interval;
  perform public.touch_event(ev.id);
  return removed;
end;
$$;

create or replace function public.create_event(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.events%rowtype;
  new_slug text;
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Entre com a conta da equipe.'; end if;
  if char_length(trim(p_name)) < 3 then raise exception 'Dê um nome ao evento (3 a 80 caracteres).'; end if;
  select * into source from public.events where slug = 'feira-2026';
  new_slug := left(trim(both '-' from regexp_replace(lower(translate(p_name, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g')), 48);
  if new_slug is null or new_slug = '' then new_slug := 'evento'; end if;
  if exists(select 1 from public.events where slug = new_slug) then
    new_slug := new_slug || '-' || floor(random() * 900 + 100)::text;
  end if;
  insert into public.events (
    slug, name, institution, municipality, state, theme, slogan, description,
    internal_date, public_date, public_hours, instagram_handle, instagram_url,
    status, is_demo, welcome_text
  ) values (
    new_slug, trim(p_name),
    coalesce(source.institution, 'Escola Estadual Cívico-Militar Ulisses Guimarães'),
    coalesce(source.municipality, 'Campo Verde'),
    coalesce(source.state, 'MT'),
    coalesce(source.theme, 'Ideias que transformam o presente e constroem o futuro!'),
    coalesce(source.slogan, 'Sua presença. Seu olhar. Nossa história.'),
    'Novo evento da escola. Ajuste as datas e publique quando estiver pronto.',
    coalesce(source.internal_date, current_date),
    coalesce(source.public_date, current_date),
    coalesce(source.public_hours, ''),
    coalesce(source.instagram_handle, '@e.e.c.m.ulissesguimaraes'),
    coalesce(source.instagram_url, 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/'),
    'draft', false,
    'Presença confirmada! Você faz parte desta história.'
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'slug', new_slug);
end;
$$;

alter table public.events enable row level security;
alter table public.presences enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);
drop policy if exists events_admin_update on public.events;
create policy events_admin_update on public.events for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists events_admin_insert on public.events;
create policy events_admin_insert on public.events for insert with check (public.is_admin());

drop policy if exists presences_admin_read on public.presences;
create policy presences_admin_read on public.presences for select using (public.is_admin());
drop policy if exists presences_admin_delete on public.presences;
create policy presences_admin_delete on public.presences for delete using (public.is_admin());

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  public.is_admin() or (status = 'approved' and audience = 'public')
);
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts for delete using (public.is_admin());

drop policy if exists media_read on public.post_media;
create policy media_read on public.post_media for select using (
  public.is_admin() or exists (
    select 1 from public.posts p where p.id = post_id and p.status = 'approved' and p.audience = 'public'
  )
);
drop policy if exists media_admin_update on public.post_media;
create policy media_admin_update on public.post_media for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists media_admin_delete on public.post_media;
create policy media_admin_delete on public.post_media for delete using (public.is_admin());

drop policy if exists admin_self on public.admin_users;
create policy admin_self on public.admin_users for select using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.events, public.posts, public.post_media to anon, authenticated;
grant select, insert, update, delete on public.events, public.posts, public.post_media, public.presences to authenticated;
grant select on public.admin_users to authenticated;
grant execute on function
  public.register_presence(text, text),
  public.create_post(text, text, text, text, text, text, boolean, boolean, text),
  public.register_media(uuid, text, text, text, integer, numeric, integer),
  public.delete_mine(text, text, text)
to anon, authenticated;
grant execute on function
  public.purge_demo(text),
  public.seed_demo(text),
  public.apply_retention(text),
  public.create_event(text),
  public.is_admin()
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ulisses-private', 'ulisses-private', false, 26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('ulisses-public', 'ulisses-public', true, 26214400, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

drop policy if exists ulisses_pending_insert on storage.objects;
create policy ulisses_pending_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'ulisses-private' and name like 'pending/%');

drop policy if exists ulisses_private_admin on storage.objects;
create policy ulisses_private_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'ulisses-private' and public.is_admin());

drop policy if exists ulisses_private_admin_delete on storage.objects;
create policy ulisses_private_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ulisses-private' and public.is_admin());

drop policy if exists ulisses_public_admin on storage.objects;
create policy ulisses_public_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'ulisses-public' and public.is_admin())
  with check (bucket_id = 'ulisses-public' and public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

insert into public.events (
  id, slug, name, institution, municipality, state, theme, slogan, description,
  internal_date, public_date, public_hours, instagram_handle, instagram_url,
  status, is_demo, welcome_text
) values
(
  '11111111-1111-4111-8111-111111111111',
  'feira-2026',
  'Feira do Conhecimento 2026',
  'Escola Estadual Cívico-Militar Ulisses Guimarães',
  'Campo Verde',
  'MT',
  'Ideias que transformam o presente e constroem o futuro!',
  'Sua presença. Seu olhar. Nossa história.',
  'A EECM Ulisses Guimarães convida toda a comunidade, pais, responsáveis e a população em geral para prestigiar os trabalhos dos estudantes na Feira do Conhecimento 2026.',
  '2026-11-24',
  '2026-11-25',
  'Das 9h às 11h e das 15h às 17h',
  '@e.e.c.m.ulissesguimaraes',
  'https://www.instagram.com/e.e.c.m.ulissesguimaraes/',
  'live',
  false,
  'Presença confirmada! Você faz parte desta história.'
),
(
  '22222222-2222-4222-8222-222222222222',
  'feira-2026-demo',
  'Feira do Conhecimento 2026 — demonstração',
  'Escola Estadual Cívico-Militar Ulisses Guimarães',
  'Campo Verde',
  'MT',
  'Ideias que transformam o presente e constroem o futuro!',
  'Sua presença. Seu olhar. Nossa história.',
  'Evento de demonstração, separado dos dados reais da Feira do Conhecimento 2026. Pode ser apagado sem afetar o evento oficial.',
  '2026-11-24',
  '2026-11-25',
  'Das 9h às 11h e das 15h às 17h',
  '@e.e.c.m.ulissesguimaraes',
  'https://www.instagram.com/e.e.c.m.ulissesguimaraes/',
  'live',
  true,
  'Presença confirmada! Você faz parte desta história.'
)
on conflict (slug) do nothing;
