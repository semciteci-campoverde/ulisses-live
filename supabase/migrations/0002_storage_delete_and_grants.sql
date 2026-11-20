-- ULISSES LIVE: ajustes para o Supabase atual.
-- O Supabase bloqueia DELETE direto em storage.objects (gatilho storage.protect_delete),
-- o que fazia delete_mine, purge_demo e apply_retention falharem sempre.
-- As três funções liberam esse DELETE só durante a própria transação.

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
    perform set_config('storage.allow_delete_query', 'true', true);
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
  perform set_config('storage.allow_delete_query', 'true', true);
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
  perform set_config('storage.allow_delete_query', 'true', true);
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


-- Funções internas não precisam ser chamadas pela internet.
revoke execute on function public.touch_event(uuid) from public, anon, authenticated;
revoke execute on function public.purge_demo(text), public.seed_demo(text),
  public.apply_retention(text), public.create_event(text) from public, anon;
