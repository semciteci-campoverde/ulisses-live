-- ULISSES LIVE — dados iniciais (seguro para rodar mais de uma vez)

insert into public.events (slug, name, institution, city, theme, schedule, instagram_handle, instagram_url,
                           status, is_demo, is_default, settings)
values (
  'feira2026',
  'Feira do Conhecimento 2026',
  'Escola Estadual Cívico-Militar Ulisses Guimarães',
  'Campo Verde – MT',
  'Ideias que transformam o presente e constroem o futuro!',
  '24/11 (terça): programação interna e para convidados · 25/11 (quarta): visitação aberta à comunidade, das 9h às 11h e das 15h às 17h',
  '@e.e.c.m.ulissesguimaraes',
  'https://www.instagram.com/e.e.c.m.ulissesguimaraes/',
  'active', false, true,
  jsonb_build_object(
    'auto_approve_messages', true,
    'paused', false,
    'emergency', false,
    'goals', jsonb_build_array(50, 100, 200, 300, 500, 1000),
    'scenes', jsonb_build_object(
      'messages', 14, 'photos', 14, 'videos', 30, 'counter', 8,
      'invite', 12, 'qr', 12, 'instagram', 10),
    'thank_you', 'Obrigado a toda a comunidade escolar, às famílias e aos visitantes que fizeram parte desta história!',
    'memories_public', false,
    'retention_days', 180
  )
)
on conflict (slug) do nothing;

insert into public.events (slug, name, institution, city, theme, schedule, instagram_handle, instagram_url,
                           status, is_demo, is_default, settings)
select 'teste', 'Modo de teste', institution, city, theme, 'Ambiente de testes: os dados daqui não entram no evento real.',
       instagram_handle, instagram_url, 'active', true, false,
       settings || jsonb_build_object('goals', jsonb_build_array(3, 5, 10))
from public.events where slug = 'feira2026'
on conflict (slug) do nothing;

insert into public.event_stats (event_id)
select id from public.events
on conflict do nothing;

-- Termos bloqueados. whole_word = false procura o termo mesmo colado a outras letras.
insert into public.moderation_terms (term, category, whole_word) values
  ('porra', 'palavrao', false), ('caralho', 'palavrao', false), ('caralh', 'palavrao', false),
  ('buceta', 'palavrao', false), ('boceta', 'palavrao', false), ('puta', 'palavrao', true),
  ('puto', 'palavrao', true), ('putaria', 'palavrao', false), ('fdp', 'palavrao', true),
  ('filhodaputa', 'palavrao', false), ('foder', 'palavrao', true), ('fodase', 'palavrao', false),
  ('foda', 'palavrao', true), ('fodido', 'palavrao', true), ('merda', 'palavrao', false),
  ('bosta', 'palavrao', true), ('cacete', 'palavrao', true), ('cu', 'palavrao', true),
  ('cuzao', 'palavrao', false), ('arrombado', 'palavrao', false), ('arrombada', 'palavrao', false),
  ('desgraca', 'palavrao', true), ('desgracado', 'palavrao', true), ('vsf', 'palavrao', true),
  ('vtnc', 'palavrao', true), ('pqp', 'palavrao', true), ('krl', 'palavrao', true), ('crl', 'palavrao', true),
  ('piroca', 'conteudo_sexual', false), ('pinto', 'conteudo_sexual', true), ('rola', 'conteudo_sexual', true),
  ('xota', 'conteudo_sexual', true), ('xoxota', 'conteudo_sexual', false), ('punheta', 'conteudo_sexual', false),
  ('siririca', 'conteudo_sexual', false), ('sexo', 'conteudo_sexual', true), ('porno', 'conteudo_sexual', true),
  ('pelada', 'conteudo_sexual', true), ('gostosa', 'conteudo_sexual', true), ('gostoso', 'conteudo_sexual', true),
  ('tesao', 'conteudo_sexual', true), ('safada', 'conteudo_sexual', true), ('safado', 'conteudo_sexual', true),
  ('nudes', 'conteudo_sexual', true),
  ('idiota', 'ofensa', true), ('imbecil', 'ofensa', true), ('burro', 'ofensa', true), ('burra', 'ofensa', true),
  ('otario', 'ofensa', true), ('otaria', 'ofensa', true), ('babaca', 'ofensa', true), ('retardado', 'ofensa', true),
  ('retardada', 'ofensa', true), ('lixo', 'ofensa', true), ('nojento', 'ofensa', true), ('nojenta', 'ofensa', true),
  ('trouxa', 'ofensa', true), ('vagabundo', 'ofensa', true), ('vagabunda', 'ofensa', true), ('corno', 'ofensa', true),
  ('escroto', 'ofensa', true), ('palhaco', 'ofensa', true), ('feio', 'ofensa', true), ('feia', 'ofensa', true),
  ('gordo', 'ofensa', true), ('gorda', 'ofensa', true), ('baleia', 'ofensa', true), ('chupa', 'ofensa', true),
  ('macaco', 'discriminacao', true), ('macaca', 'discriminacao', true), ('viado', 'discriminacao', true),
  ('veado', 'discriminacao', true), ('bicha', 'discriminacao', true), ('sapatao', 'discriminacao', true),
  ('traveco', 'discriminacao', false), ('crioulo', 'discriminacao', true), ('neguinho', 'discriminacao', true),
  ('macumbeiro', 'discriminacao', true), ('aleijado', 'discriminacao', true), ('mongoloide', 'discriminacao', true),
  ('matar', 'violencia', true), ('morrer', 'violencia', true), ('morra', 'violencia', true), ('morte', 'violencia', true),
  ('arma', 'violencia', true), ('tiro', 'violencia', true), ('bomba', 'violencia', true), ('facada', 'violencia', true),
  ('espancar', 'violencia', true), ('massacre', 'violencia', true), ('suicidio', 'violencia', true),
  ('droga', 'improprio', true), ('maconha', 'improprio', true), ('cocaina', 'improprio', true), ('baseado', 'improprio', true),
  ('cerveja', 'improprio', true), ('bet', 'propaganda', true), ('aposta', 'propaganda', true), ('pix', 'propaganda', true),
  ('promocao', 'propaganda', true), ('desconto', 'propaganda', true), ('compre', 'propaganda', true),
  ('vendo', 'propaganda', true), ('whatsapp', 'propaganda', true), ('zap', 'propaganda', true),
  ('sigam', 'propaganda', true), ('segue', 'propaganda', true), ('siga', 'propaganda', true)
on conflict (term) do nothing;
