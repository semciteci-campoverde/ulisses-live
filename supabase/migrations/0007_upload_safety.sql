-- ULISSES LIVE: segurança dos envios de foto e vídeo antes do evento.
-- 1) discard_failed_post: se o arquivo não subir, o celular apaga a própria publicação vazia
--    (antes ela ficava na fila sem arquivo e podia ser aprovada vazia).
-- 2) register_media avisa o painel (touch_event) quando o arquivo chega, para a fila atualizar sozinha.

create or replace function public.discard_failed_post(p_post_id uuid, p_visitor_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post public.posts%rowtype;
begin
  select * into post from public.posts where id = p_post_id;
  if not found or post.visitor_id <> p_visitor_id then return; end if;
  if post.type not in ('photo', 'video') or post.status <> 'pending' then return; end if;
  if post.created_at < now() - interval '2 hours' then return; end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
    where bucket_id = 'ulisses-private' and name like 'pending/' || p_post_id::text || '/%';
  delete from public.post_media where post_id = p_post_id;
  delete from public.posts where id = p_post_id;
  perform public.touch_event(post.event_id);
end;
$$;

revoke all on function public.discard_failed_post(uuid, text) from public;
grant execute on function public.discard_failed_post(uuid, text) to anon, authenticated;

create or replace function public.register_media(p_post_id uuid, p_visitor_id text, p_path text, p_mime text, p_bytes integer, p_duration numeric, p_sort integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  perform public.touch_event(post.event_id);
end;
$function$;
