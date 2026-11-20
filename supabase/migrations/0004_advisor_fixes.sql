-- ULISSES LIVE: ajustes apontados pelo Supabase Advisor.
alter function public.fold_text(text) set search_path = public;
alter function public.squeeze_text(text) set search_path = public;
alter function public.normalize_school_text(text) set search_path = public;
alter function public.classify_text(text) set search_path = public;

drop policy if exists admin_self on public.admin_users;
create policy admin_self on public.admin_users for select using (user_id = (select auth.uid()));
