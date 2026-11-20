-- ULISSES LIVE — esquema inicial
-- Executado pela Action "db-migrate" (psql) ou colado no SQL Editor do Supabase.

create extension if not exists pgcrypto;

-- =====================================================================
-- Tabelas
-- =====================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null,
  institution text not null default '',
  city text not null default '',
  theme text not null default '',
  schedule text not null default '',
  instagram_handle text not null default '',
  instagram_url text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  is_demo boolean not null default false,
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists events_one_default on public.events (is_default) where is_default;

create table if not exists public.admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.presences (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (event_id, visitor_id)
);
create index if not exists presences_event_time on public.presences (event_id, created_at);

-- Publicações: sem visitor_id, para nunca expor o identificador do navegador.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('message', 'photo', 'video', 'feedback')),
  author_name text not null default '',
  body text not null default '',
  emoji text not null default '',
  media jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'feedback', 'removed')),
  flags text[] not null default '{}',
  featured boolean not null default false,
  consent_image boolean not null default false,
  consent_instagram boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists posts_event_status on public.posts (event_id, status, created_at desc);

create table if not exists public.post_owners (
  post_id uuid primary key references public.posts (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists post_owners_visitor on public.post_owners (event_id, visitor_id, created_at);

create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  visitor_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now()
);
create index if not exists reactions_visitor on public.reactions (event_id, visitor_id, created_at);

-- Contadores públicos, atualizados por gatilhos. O painel da TV assina esta tabela.
create table if not exists public.event_stats (
  event_id uuid primary key references public.events (id) on delete cascade,
  presences integer not null default 0,
  messages integer not null default 0,
  photos integer not null default 0,
  videos integer not null default 0,
  reactions integer not null default 0,
  last_reaction_emoji text not null default '',
  last_reaction_at timestamptz,
  last_post_at timestamptz,
  posts_rev integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_terms (
  term text primary key,
  category text not null default 'ofensa',
  whole_word boolean not null default true
);

-- =====================================================================
-- Funções auxiliares
-- =====================================================================

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.normalize_text(t text) returns text
language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')),
             'áàâãäéèêëíìîïóòôõöúùûüçñ@4310$5!7',
             'aaaaaeeeeiiiiooooouuuucnaaeiosssit'),
           '(.)\1{2,}', '\1\1', 'g');
$$;

-- Retorna as categorias de problema encontradas em um texto (vazio = limpo).
create or replace function public.text_flags(t text) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  n text := public.normalize_text(t);
  squeezed text := regexp_replace(public.normalize_text(t), '[^a-z]', '', 'g');
  result text[] := '{}';
  r record;
begin
  if coalesce(t, '') = '' then
    return result;
  end if;
  for r in select term, category, whole_word from public.moderation_terms loop
    if (r.whole_word and n ~ ('(^|[^a-z])' || r.term || '([^a-z]|$)'))
       or (not r.whole_word and squeezed like '%' || r.term || '%') then
      result := array_append(result, r.category);
    end if;
  end loop;
  if t ~* '(https?://|www\.|\.com|\.br\b|\.net\b|bit\.ly)' then
    result := array_append(result, 'link');
  end if;
  if t ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' then
    result := array_append(result, 'dados_pessoais');
  end if;
  if t ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or t ~ '\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}' then
    result := array_append(result, 'dados_pessoais');
  end if;
  if t ~ '@[A-Za-z0-9_.]{3,}' then
    result := array_append(result, 'mencao');
  end if;
  if t ~ '(.)\1{6,}' or t ~ '[A-Z]{25,}' then
    result := array_append(result, 'spam');
  end if;
  return (select coalesce(array_agg(distinct x), '{}') from unnest(result) x);
end;
$$;

-- Palavras que costumam indicar crítica ou sugestão: a mensagem vai para análise humana.
create or replace function public.looks_like_criticism(t text) returns boolean
language sql immutable as $$
  select public.normalize_text(t) ~
    '(^|[^a-z])(ruim|pessim|horrivel|chato|chata|demor|faltou|falta |poderia|deveria|melhorar|melhoria|sugest|reclam|problema|bagunca|desorganiz|nao gostei|odiei|decepcion)';
$$;

-- =====================================================================
-- Contadores (gatilhos)
-- =====================================================================

create or replace function public.ensure_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_stats (event_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists events_stats on public.events;
create trigger events_stats after insert on public.events
  for each row execute function public.ensure_stats();

create or replace function public.recount_posts(p_event uuid) returns void
language sql security definer set search_path = public as $$
  update public.event_stats s set
    messages = (select count(*) from public.posts where event_id = p_event and kind = 'message' and status = 'approved'),
    photos = (select coalesce(sum(jsonb_array_length(media)), 0) from public.posts where event_id = p_event and kind = 'photo' and status = 'approved'),
    videos = (select count(*) from public.posts where event_id = p_event and kind = 'video' and status = 'approved'),
    last_post_at = now(),
    posts_rev = s.posts_rev + 1,
    updated_at = now()
  where s.event_id = p_event;
$$;

create or replace function public.on_post_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recount_posts(old.event_id);
    return old;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.media is distinct from old.media then
    perform public.recount_posts(new.event_id);
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stats on public.posts;
create trigger posts_stats after insert or update or delete on public.posts
  for each row execute function public.on_post_change();

-- =====================================================================
-- Funções chamadas pelo site (visitantes anônimos)
-- =====================================================================

-- Registra a presença de um navegador. Repetir não duplica.
create or replace function public.register_presence(p_event uuid, p_visitor uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  inserted integer;
  total integer;
begin
  select * into ev from public.events where id = p_event;
  if not found or ev.status <> 'active' then
    raise exception 'evento_indisponivel' using errcode = 'P0001';
  end if;
  insert into public.presences (event_id, visitor_id) values (p_event, p_visitor)
    on conflict (event_id, visitor_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.event_stats set presences = presences + 1, updated_at = now()
      where event_id = p_event
      returning presences into total;
  else
    select presences into total from public.event_stats where event_id = p_event;
  end if;
  return jsonb_build_object('is_new', inserted > 0, 'total', coalesce(total, 0));
end;
$$;

-- Cria uma publicação. O status é sempre decidido aqui, nunca pelo navegador.
create or replace function public.create_post(
  p_event uuid,
  p_visitor uuid,
  p_kind text,
  p_author text,
  p_body text,
  p_emoji text,
  p_media jsonb default '[]'::jsonb,
  p_consent_image boolean default false,
  p_consent_instagram boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  recent integer;
  flags text[];
  new_status text;
  new_id uuid;
  item jsonb;
  max_media integer;
  author text := btrim(regexp_replace(coalesce(p_author, ''), '\s+', ' ', 'g'));
  body text := btrim(coalesce(p_body, ''));
  emoji text := left(coalesce(p_emoji, ''), 16);
begin
  select * into ev from public.events where id = p_event;
  if not found or ev.status <> 'active' then
    raise exception 'evento_indisponivel' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.presences where event_id = p_event and visitor_id = p_visitor) then
    raise exception 'presenca_nao_registrada' using errcode = 'P0001';
  end if;
  if p_kind not in ('message', 'photo', 'video', 'feedback') then
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;

  -- Limite contra spam: 8 publicações a cada 10 minutos por navegador.
  select count(*) into recent from public.post_owners
    where event_id = p_event and visitor_id = p_visitor and created_at > now() - interval '10 minutes';
  if recent >= 8 then
    raise exception 'limite_de_envios' using errcode = 'P0001';
  end if;

  if p_kind <> 'feedback' and (char_length(author) < 2 or char_length(author) > 40) then
    raise exception 'nome_invalido' using errcode = 'P0001';
  end if;
  if char_length(body) > 200 then
    raise exception 'texto_longo' using errcode = 'P0001';
  end if;
  if p_kind in ('message', 'feedback') and char_length(body) < 2 then
    raise exception 'texto_vazio' using errcode = 'P0001';
  end if;

  -- Mídias: precisam estar na pasta do próprio navegador e existir no armazenamento.
  if jsonb_typeof(coalesce(p_media, '[]'::jsonb)) <> 'array' then
    raise exception 'midia_invalida' using errcode = 'P0001';
  end if;
  max_media := case p_kind when 'photo' then 5 when 'video' then 1 else 0 end;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > max_media
     or (p_kind in ('photo', 'video') and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0) then
    raise exception 'quantidade_de_midia_invalida' using errcode = 'P0001';
  end if;
  for item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    if (item ->> 'path') is null
       or (item ->> 'path') not like (p_event::text || '/' || p_visitor::text || '/%')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'uploads' and o.name = item ->> 'path') then
      raise exception 'midia_nao_encontrada' using errcode = 'P0001';
    end if;
    if (item ->> 'poster') is not null and (
         (item ->> 'poster') not like (p_event::text || '/' || p_visitor::text || '/%')
         or not exists (select 1 from storage.objects o where o.bucket_id = 'uploads' and o.name = item ->> 'poster')) then
      raise exception 'midia_nao_encontrada' using errcode = 'P0001';
    end if;
  end loop;
  if p_kind in ('photo', 'video') and not p_consent_image then
    raise exception 'autorizacao_de_imagem_obrigatoria' using errcode = 'P0001';
  end if;

  flags := public.text_flags(author || ' ' || body);

  if p_kind = 'feedback' then
    new_status := 'feedback';
  elsif p_kind in ('photo', 'video') then
    new_status := 'pending';
  elsif array_length(flags, 1) is not null then
    new_status := 'pending';
  elsif public.looks_like_criticism(body) then
    flags := array_append(flags, 'possivel_critica');
    new_status := 'pending';
  elsif coalesce((ev.settings ->> 'auto_approve_messages')::boolean, false) then
    new_status := 'approved';
  else
    new_status := 'pending';
  end if;

  insert into public.posts (event_id, kind, author_name, body, emoji, media, status, flags,
                            consent_image, consent_instagram, reviewed_at)
  values (p_event, p_kind, case when p_kind = 'feedback' then coalesce(nullif(author, ''), 'Anônimo') else author end,
          body, emoji, coalesce(p_media, '[]'::jsonb), new_status, flags,
          coalesce(p_consent_image, false), coalesce(p_consent_instagram, false),
          case when new_status = 'approved' then now() end)
  returning id into new_id;

  insert into public.post_owners (post_id, event_id, visitor_id) values (new_id, p_event, p_visitor);

  return jsonb_build_object('id', new_id, 'status', new_status);
end;
$$;

-- Envia uma reação (emoji). Limite: 20 por minuto por navegador.
create or replace function public.add_reaction(p_event uuid, p_visitor uuid, p_emoji text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  recent integer;
  total integer;
begin
  select * into ev from public.events where id = p_event;
  if not found or ev.status <> 'active' then
    raise exception 'evento_indisponivel' using errcode = 'P0001';
  end if;
  if p_emoji not in ('👏', '❤️', '😍', '🚀', '🤩', '🙌', '💡', '🎉', '👍') then
    raise exception 'emoji_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.presences where event_id = p_event and visitor_id = p_visitor) then
    raise exception 'presenca_nao_registrada' using errcode = 'P0001';
  end if;
  select count(*) into recent from public.reactions
    where event_id = p_event and visitor_id = p_visitor and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'limite_de_reacoes' using errcode = 'P0001';
  end if;
  insert into public.reactions (event_id, visitor_id, emoji) values (p_event, p_visitor, p_emoji);
  update public.event_stats
    set reactions = reactions + 1, last_reaction_emoji = p_emoji, last_reaction_at = now(), updated_at = now()
    where event_id = p_event
    returning reactions into total;
  return jsonb_build_object('total', total);
end;
$$;

-- =====================================================================
-- Funções administrativas
-- =====================================================================

create or replace function public.admin_report(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'presences', (select count(*) from public.presences where event_id = p_event),
    'posts_total', (select count(*) from public.posts where event_id = p_event),
    'messages_total', (select count(*) from public.posts where event_id = p_event and kind = 'message'),
    'messages_approved', (select count(*) from public.posts where event_id = p_event and kind = 'message' and status = 'approved'),
    'photos_total', (select coalesce(sum(jsonb_array_length(media)), 0) from public.posts where event_id = p_event and kind = 'photo'),
    'photos_approved', (select coalesce(sum(jsonb_array_length(media)), 0) from public.posts where event_id = p_event and kind = 'photo' and status = 'approved'),
    'videos_total', (select count(*) from public.posts where event_id = p_event and kind = 'video'),
    'videos_approved', (select count(*) from public.posts where event_id = p_event and kind = 'video' and status = 'approved'),
    'reactions', (select count(*) from public.reactions where event_id = p_event),
    'pending', (select count(*) from public.posts where event_id = p_event and status = 'pending'),
    'rejected', (select count(*) from public.posts where event_id = p_event and status in ('rejected', 'removed')),
    'feedback', (select count(*) from public.posts where event_id = p_event and status = 'feedback'),
    'engaged_visitors', (select count(distinct visitor_id) from (
        select visitor_id from public.post_owners where event_id = p_event
        union select visitor_id from public.reactions where event_id = p_event) v),
    'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'presences', c) order by h), '[]'::jsonb) from (
        select to_char(date_trunc('hour', created_at at time zone 'America/Cuiaba'), 'YYYY-MM-DD HH24:00') h, count(*) c
        from public.presences where event_id = p_event group by 1) x),
    'by_shift', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'shift', s, 'presences', c) order by d, s), '[]'::jsonb) from (
        select to_char(created_at at time zone 'America/Cuiaba', 'YYYY-MM-DD') d,
               case when extract(hour from created_at at time zone 'America/Cuiaba') < 12 then 'manhã'
                    when extract(hour from created_at at time zone 'America/Cuiaba') < 18 then 'tarde'
                    else 'noite' end s,
               count(*) c
        from public.presences where event_id = p_event group by 1, 2) y)
  ) into result;
  return result;
end;
$$;

-- Apaga presenças, publicações e reações de um evento (usado para limpar o modo de teste).
-- Os arquivos de mídia são apagados pelo painel antes, pela API de armazenamento.
create or replace function public.admin_purge_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  delete from public.posts where event_id = p_event;
  delete from public.presences where event_id = p_event;
  delete from public.reactions where event_id = p_event;
  update public.event_stats set presences = 0, messages = 0, photos = 0, videos = 0, reactions = 0,
    last_reaction_emoji = '', last_reaction_at = null, posts_rev = posts_rev + 1, updated_at = now()
    where event_id = p_event;
end;
$$;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================

alter table public.events enable row level security;
alter table public.admins enable row level security;
alter table public.presences enable row level security;
alter table public.posts enable row level security;
alter table public.post_owners enable row level security;
alter table public.reactions enable row level security;
alter table public.event_stats enable row level security;
alter table public.moderation_terms enable row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select
  using (status in ('active', 'closed') or public.is_admin());
drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select using (user_id = auth.uid());

drop policy if exists presences_admin on public.presences;
create policy presences_admin on public.presences for select using (public.is_admin());

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select
  using (status = 'approved' or public.is_admin());
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts for delete using (public.is_admin());

drop policy if exists post_owners_admin on public.post_owners;
create policy post_owners_admin on public.post_owners for select using (public.is_admin());

drop policy if exists reactions_admin on public.reactions;
create policy reactions_admin on public.reactions for select using (public.is_admin());

drop policy if exists stats_public_read on public.event_stats;
create policy stats_public_read on public.event_stats for select using (true);

drop policy if exists terms_admin on public.moderation_terms;
create policy terms_admin on public.moderation_terms for all
  using (public.is_admin()) with check (public.is_admin());

-- Privilégios: visitantes só leem o necessário e escrevem por meio das funções acima.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.events, public.posts, public.event_stats to anon, authenticated;
grant select, insert, update, delete on public.events, public.posts, public.moderation_terms to authenticated;
grant select on public.presences, public.post_owners, public.reactions, public.admins to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.register_presence(uuid, uuid) to anon, authenticated;
grant execute on function public.create_post(uuid, uuid, text, text, text, text, jsonb, boolean, boolean) to anon, authenticated;
grant execute on function public.add_reaction(uuid, uuid, text) to anon, authenticated;
grant execute on function public.admin_report(uuid) to authenticated;
grant execute on function public.admin_purge_event(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- =====================================================================
-- Armazenamento
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true;

-- Funções usadas pelas regras de armazenamento (rodam com privilégio para checar presença e aprovação).
create or replace function public.can_upload(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.presences p join public.events e on e.id = p.event_id
    where e.status = 'active'
      and p.event_id::text = split_part(p_name, '/', 1)
      and p.visitor_id::text = split_part(p_name, '/', 2)
      and split_part(p_name, '/', 3) <> ''
      and split_part(p_name, '/', 4) = ''
  );
$$;

create or replace function public.media_is_public(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts po
    where po.status = 'approved'
      and (po.media @> jsonb_build_array(jsonb_build_object('path', p_name))
           or po.media @> jsonb_build_array(jsonb_build_object('poster', p_name)))
  );
$$;

grant execute on function public.can_upload(text) to anon, authenticated;
grant execute on function public.media_is_public(text) to anon, authenticated;

-- Visitante só envia para a pasta <evento>/<seu navegador>/ de um evento ativo onde registrou presença.
drop policy if exists uploads_visitor_insert on storage.objects;
create policy uploads_visitor_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'uploads' and public.can_upload(name));

-- Arquivos só ficam legíveis depois que a publicação é aprovada.
drop policy if exists uploads_public_read_approved on storage.objects;
create policy uploads_public_read_approved on storage.objects for select to anon, authenticated
  using (bucket_id = 'uploads' and public.media_is_public(name));

drop policy if exists uploads_admin_all on storage.objects;
create policy uploads_admin_all on storage.objects for all to authenticated
  using (bucket_id in ('uploads', 'branding') and public.is_admin())
  with check (bucket_id in ('uploads', 'branding') and public.is_admin());

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'branding');

-- =====================================================================
-- Tempo real
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.event_stats;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
end $$;
