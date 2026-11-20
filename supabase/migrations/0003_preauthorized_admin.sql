-- ULISSES LIVE: libera a área da equipe para e-mails pré-autorizados.
-- Quando a conta com um desses e-mails existir e estiver confirmada no Supabase Auth,
-- ela entra sozinha em public.admin_users. Nenhuma senha passa por aqui.
create table if not exists public.admin_invites (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from anon, authenticated;

create or replace function public.grant_invited_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_invites where email = lower(new.email)) then
    insert into public.admin_users (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_invited_admin() from public, anon, authenticated;

drop trigger if exists ulisses_grant_invited_admin on auth.users;
create trigger ulisses_grant_invited_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_invited_admin();

-- Contas que já existam e estejam confirmadas.
insert into public.admin_users (user_id, email)
select u.id, lower(u.email) from auth.users u
join public.admin_invites i on i.email = lower(u.email)
where u.email_confirmed_at is not null
on conflict (user_id) do nothing;
