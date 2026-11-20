\set ON_ERROR_STOP 0
\pset footer off
select id as ev from events where slug='teste' \gset
-- ---------- visitante anônimo ----------
set role anon;
select 'presenca 1' t, register_presence(:'ev', '11111111-1111-1111-1111-111111111111');
select 'presenca repetida' t, register_presence(:'ev', '11111111-1111-1111-1111-111111111111');
select 'presenca 2' t, register_presence(:'ev', '22222222-2222-2222-2222-222222222222');
select 'msg limpa' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','message','Ana','Que feira incrível, parabéns aos alunos!','🎉');
select 'msg palavrao' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','message','Ana','que p0rra legal','🎉');
select 'msg critica' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','message','Ana','Faltou água nos corredores','👍');
select 'msg telefone' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','message','Ana','me chama 65 99999-1234','👍');
select 'nome ofensivo' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','message','Idiota','Lindo trabalho','👍');
select 'sem presenca' t, create_post(:'ev','33333333-3333-3333-3333-333333333333','message','Ana','Oi gente','👍');
select 'status forjado ignorado' t, (create_post(:'ev','22222222-2222-2222-2222-222222222222','photo','Bia','foto','📸','[{"path":"x"}]'::jsonb, true));
-- upload: pasta errada deve falhar, pasta própria deve passar
insert into storage.objects (bucket_id, name) values ('uploads', :'ev' || '/33333333-3333-3333-3333-333333333333/a.jpg');
insert into storage.objects (bucket_id, name) values ('uploads', :'ev' || '/22222222-2222-2222-2222-222222222222/a.jpg');
select 'foto sem autorizacao' t, create_post(:'ev','22222222-2222-2222-2222-222222222222','photo','Bia','','📸',jsonb_build_array(jsonb_build_object('path', :'ev' || '/22222222-2222-2222-2222-222222222222/a.jpg')), false);
select 'foto' t, create_post(:'ev','22222222-2222-2222-2222-222222222222','photo','Bia','Nosso projeto','📸',jsonb_build_array(jsonb_build_object('path', :'ev' || '/22222222-2222-2222-2222-222222222222/a.jpg')), true, true);
select 'foto de outro' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','photo','Ana','','📸',jsonb_build_array(jsonb_build_object('path', :'ev' || '/22222222-2222-2222-2222-222222222222/a.jpg')), true);
select 'feedback' t, create_post(:'ev','11111111-1111-1111-1111-111111111111','feedback','','O som do auditório estava baixo','');
select 'reacao' t, add_reaction(:'ev','11111111-1111-1111-1111-111111111111','🚀');
select 'reacao invalida' t, add_reaction(:'ev','11111111-1111-1111-1111-111111111111','💩');
select 'anon ve posts' t, kind, status, author_name, body from posts order by created_at;
select 'anon ve arquivos' t, name from storage.objects;
select 'anon ve presencas?' t, count(*) from presences;
select 'anon ve post_owners?' t, count(*) from post_owners;
select 'anon atualiza post?' t; update posts set status='approved';
select 'anon relatorio?' t, admin_report(:'ev');
select 'stats' t, presences, messages, photos, reactions, last_reaction_emoji, posts_rev from event_stats where event_id=:'ev';
reset role;
-- ---------- administrador ----------
insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin@x') on conflict do nothing;
insert into admins values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select 'admin ve todos' t, kind, status, flags from posts order by created_at;
update posts set status='approved', reviewed_at=now() where kind='photo';
reset role;
set role anon; reset request.jwt.claim.sub;
select 'anon ve arquivo aprovado' t, name from storage.objects;
select 'stats apos aprovar' t, photos, posts_rev from event_stats where event_id=:'ev';
reset role;
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select 'relatorio' t, admin_report(:'ev')->>'presences' p, admin_report(:'ev')->>'pending' pend, admin_report(:'ev')->'by_shift' shifts;
select 'limpeza' t, admin_purge_event(:'ev');
select 'apos limpeza' t, presences, messages, photos, reactions from event_stats where event_id=:'ev';
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'nao-admin limpeza' t, admin_purge_event(:'ev');
reset role;
