-- ULISSES LIVE: moderação v2 (regras, não é inteligência artificial).
-- 1) Muito mais frases positivas da feira entram direto no painel.
-- 2) Palavrão, xingamento, ofensa a alguém e tema sensível (política, religião atacada,
--    violência, armas, drogas, álcool, sexo, automutilação, ameaça, tragédia), propaganda,
--    link e dado pessoal são RECUSADOS NO ENVIO: nada é gravado, nem para a moderação.
--    Vale para mensagem, nome e legenda de foto/vídeo.
-- 3) Crítica educada continua só para a equipe; texto neutro, misto ou irônico espera revisão.

create or replace function public.ul_has(p_text text, p_terms text[], p_mode text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  t text := ' ' || coalesce(p_text, '') || ' ';
  s text := ' ' || public.squeeze_text(coalesce(p_text, '')) || ' ';
  term text;
begin
  foreach term in array p_terms loop
    if p_mode = 'word' then
      if position(' ' || term || ' ' in t) > 0 or position(' ' || public.squeeze_text(term) || ' ' in s) > 0 then return true; end if;
    elsif p_mode = 'stem' then
      if position(' ' || term in t) > 0 or position(' ' || public.squeeze_text(term) in s) > 0 then return true; end if;
    else -- phrase: começa em início de palavra
      if position(' ' || term in t) > 0 or position(' ' || public.squeeze_text(term) in s) > 0 then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.ul_block_reason(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text := coalesce(p_raw, '');
  folded text := public.fold_text(raw);
  norm text := public.normalize_school_text(raw);
  compact text := public.squeeze_text(replace(public.normalize_school_text(raw), ' ', ''));
  term text;
  -- palavrões e xingamentos (palavra inteira)
  swear_w text[] := array['porra','poha','pora','caralho','carai','caraio','cacete','krl','crl','pqp','vsf','vtnc','tnc','pnc','tmnc','fdp','merda','bosta','cu','cuzao','cuzinho','foda','fodase','foder','fodido','fodida','fuder','fudido','fudida','fudeu','arrombado','arrombada','desgraca','desgracado','desgracada','inferno','peido','peida','cagar','cagada','cagado','shit','fuck','fck','wtf','bitch','puta','puto','putinha','putaria','vadia','vagabundo','vagabunda','piranha','corno','corna','cachorra','besta'];
  swear_s text[] := array['caralh','porr','merd','bost','fodid','fudid','arromb','desgrac','vagabund','putari'];
  -- ofensa e denegrir alguém (corpo, inteligência, raça, gênero, orientação, bullying)
  demean_w text[] := array['idiota','imbecil','babaca','otario','otaria','trouxa','burro','burra','burros','burras','burrice','lerdo','lerda','retardado','retardada','mongol','mongoloide','aleijado','aleijada','debil','palhaco','palhaca','ridiculo','ridicula','inutil','fracassado','fracassada','perdedor','perdedora','nerdola','chato','chata','chatos','chatas','gordo','gorda','gordos','gordas','gordao','gordona','gordinho','gordinha','baleia','obeso','obesa','feio','feia','feios','feias','feioso','feiosa','horroroso','horrorosa','nojento','nojenta','nojo','fedido','fedida','fedorento','fedorenta','macaco','macaca','macacos','macacas','neguinho','neguinha','bombril','sapatao','traveco','viado','viada','viadinho','bicha','bixa','boiola','baitola','gay','gays','lesbica','vesgo','vesga','banguela','dentuco','dentuca','orelhudo','orelhuda','narigudo','nariguda','cabecudo','cabecuda','nanico','nanica','magrelo','magrela','favelado','favelada','bruxa','bruxo','jumento','jumenta','asno','mulherzinha','escroto','escrota','safado','safada','canalha','vergonhoso'];
  demean_p text[] := array['cabelo ruim','cabelo duro','cabelo de bombril','rolha de poco','lugar de mulher','mulher no fogao','volta pra cozinha','seu burro','sua burra','seu lixo','sua lixo','um lixo','e lixo','que lixo','lixo humano','sua feia','seu feio','cala a boca','cala boca','vai se','vai tomar','tomar no','toma no','filho da','filha da','vai pro inferno','vai a merda','some daqui','ninguem gosta de voce','ninguem te suporta'];
  -- sexual
  sex_w text[] := array['sexo','sexual','sexy','transa','transar','transou','nudes','nude','pelado','pelada','peladao','gostosa','gostoso','gostosao','tesao','tesuda','tesudo','porno','porn','punheta','boquete','xoxota','xereca','piroca','bunda','bundao','siririca','onlyfans','prostituta','prostituto','puteiro','motel'];
  sex_s text[] := array['pornog','prostitu','estupr','pedofil','assedi','abusad','abuso sex'];
  -- violência, armas, ameaça, automutilação, tragédia
  viol_w text[] := array['matar','mato voce','morte','mortes','morrer','morra','morreu','morto','morta','mortos','sangue','arma','armas','revolver','pistola','fuzil','faca','facada','facadas','tiros','tiroteio','atirar','baleado','baleada','bala perdida','briga','brigar','porrada','soco','socos','espancar','guerra','terrorista','bomba','explodir','luto','velorio','enterro','chacina','massacre','atentado','tragedia','acidente','sequestro','assalto','roubo','ladrao','ladra','bandido','bandida'];
  viol_s text[] := array['assassin','suicid','automutil','depress','ameac','tragedi','massacr','atentad','falec','espanc','esfaque','tirotei','sequestr'];
  viol_p text[] := array['se matar','se mata','vai se matar','te mata','me matar','te matar','vou matar','quero morrer','vou morrer','vai morrer','se cortar','me cortar','cortar os pulsos','vou te pegar','te pegar','te bater','vou bater','te quebrar','vai apanhar','cuidado comigo','la fora'];
  -- drogas e álcool
  drug_w text[] := array['droga','drogas','drogado','drogada','maconha','maconheiro','baseado','cocaina','crack','lsd','ecstasy','lanca perfume','cerveja','cervejinha','breja','cachaca','cachaceiro','pinga','vodka','vodca','whisky','uisque','tequila','bebado','bebada','bebedeira','porre','alcool','alcoolico','cigarro','cigarros','vape','narguile','tabaco','fumar','chapado','chapada','beck'];
  -- política, eleição, partidos
  pol_w text[] := array['politica','politico','politicos','politicas','eleicao','eleicoes','eleitor','eleitores','eleitoral','voto','votos','votar','vote','votem','votei','candidato','candidata','candidatos','campanha eleitoral','partido','partidos','pt','psdb','psol','mdb','lula','lulista','bolsonaro','bolsonarista','bolsominion','dilma','haddad','trump','petista','petralha','esquerdista','direitista','de esquerda','de direita','comunista','comunismo','fascista','fascismo','nazista','nazismo','nazi','ditadura','golpe','golpista','prefeito','prefeita','vereador','vereadora','deputado','deputada','senador','senadora','governador','governadora','ministro'];
  -- ataque a religião
  rel_w text[] := array['macumba','macumbeiro','macumbeira','satanas','satanico','demonio','demonios','diabo','capeta','seita','herege','crente burro'];
  -- figurinhas ruins
  bad_emoji text[] := array['🖕','💩','🍆','🍑','🔫','🔪','💊','💉','🍺','🍻','🍷','🥃','🍾','🚬','🍁','👎','😡','🤬','💀','☠','⚰','🤮','🤢','🐒','🐵','🙈','🐷','🐖','🤡','😈','👿','🩸','💣','🧨','🔞','👅','💦','🥵'];
  compact_terms text[] := array['caralho','arrombad','buceta','boceta','punheta','putaria','piroca','xoxota','xereca','filhodaputa','vaisefoder','vaisefuder','tomarnocu','estupr','pedofil','maconh','cocain','suicid','viadinho','retardad','desgracad','vagabund','nojent','fodase','bolsonar','petralh','macumb'];
begin
  if raw ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
     or raw ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}'
     or raw ~ '(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[-\s.]?\d{4}'
     or raw ~ '(\d[\s.-]*){10,11}'
     or folded ~ '(meu|minha) (zap|whats|insta|numero|telefone|celular|endereco)' then
    return 'personal_data';
  end if;
  if raw ~* 'https?://|www\.|\.com\b|\.com\.br|@[a-z0-9_.]{3,}' then return 'spam'; end if;
  foreach term in array bad_emoji loop
    if position(term in raw) > 0 then return 'emoji'; end if;
  end loop;
  if norm = '' then return null; end if;
  if public.ul_has(norm, swear_w, 'word') or public.ul_has(norm, swear_s, 'stem') then return 'swear'; end if;
  if public.ul_has(norm, demean_w, 'word') or public.ul_has(norm, demean_p, 'phrase') then return 'demeaning'; end if;
  if public.ul_has(norm, sex_w, 'word') or public.ul_has(norm, sex_s, 'stem') then return 'sexual'; end if;
  if public.ul_has(norm, viol_w, 'word') or public.ul_has(norm, viol_s, 'stem') or public.ul_has(norm, viol_p, 'phrase') then return 'violence'; end if;
  if public.ul_has(norm, drug_w, 'word') then return 'drugs'; end if;
  if public.ul_has(norm, pol_w, 'word') or public.ul_has(norm, array['bolsonar','petist','comunis','fascis','eleic','candidat','deputad','vereador','senador','governador','prefeit'], 'stem') then return 'politics'; end if;
  if public.ul_has(norm, rel_w, 'word') or public.ul_has(norm, array['macumb','satan','demoni'], 'stem') then return 'religion'; end if;
  foreach term in array compact_terms loop
    if position(term in compact) > 0 then return 'swear'; end if;
  end loop;
  if public.ul_has(norm, array['ganhe dinheiro','clique aqui','siga meu','siga o meu','sigam','me segue','segue la','cassino','apostas','aposta','bet','tigrinho','pix','compre agora','whatsapp','zap','promocao','desconto','sorteio','renda extra','link na bio'], 'phrase') then
    return 'spam';
  end if;
  return null;
end;
$$;

create or replace function public.classify_text(p_text text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text := coalesce(p_text, '');
  folded text := public.fold_text(raw);
  norm text := public.normalize_school_text(raw);
  reason text := public.ul_block_reason(raw);
  note_rules text := 'Classificação automática por regras (não é inteligência artificial): ';
  strong_w text[] := array['parabens','parabems','parabains','amo','top','show','legal','bacana','dahora','daora','viva','vivas','uau','uhul','bravo','fera','feras','craque','craques','genial','genio','genios','belo','bela','belos','belas','beleza','valeu','sucesso','obrigado','obrigada','obg','grato','grata','gratidao','incrivel','incriveis','perfeito','perfeita','lindo','linda','lindos','lindas','otimo','otima','otimos','otimas','excelente','arrasou','arrasaram','arrasando','arrasa','mandou','mandaram'];
  strong_s text[] := array['parabe','parabeniz','orgulh','lindissim','lind','incrive','amei','adorei','adoro','adorav','maravilh','excelen','otim','inspir','arras','sensaciona','perfeit','obrigad','emocion','brilh','espetac','fantast','talent','sucess','feliz','felicidad','alegr','belissim','caprich','admir','encant','abencoe','abencoad','abenco','bravissim','campeo','campea','vitori','honra','exemplar','dedicad','dedicac','esforc','empenh'];
  phrase_pos text[] := array['muito bom','muito boa','muito bons','muito boas','muito legal','que legal','que bom','que lindo','que linda','show de bola','de parabens','nota dez','nota mil','mandaram bem','mandou bem','que massa','ta massa','muito massa','massa demais','projeto massa','feira massa','trabalho massa','top demais','orgulho de ser','deus abencoe','sucesso sempre','e nois','ficou lindo','ficou linda','ficou top','ficou show','ficou otimo','ficou bom'];
  context_s text[] := array['transform','conheciment','futur','inova','cienc','cientif','tecnolog','educac','disciplin','civism','civic','patri','respeit','cidadan','professor','mestre','aluno','aluna','estudant','equipe','escola','colegio','feira','comunidad','famili','ulisses','guimaraes','gremio','projeto','trabalho','aprend','ensin','saber','criativ','ideia','descobert','pesquis','experiment','deus','brasil','juntos','uniao','constr','evolu','progress','desenvolv','conquist','sonh','esperanc','paz','amor','carinho','valor'];
  weak_w text[] := array['bom','boa','bons','boas','demais','massa','gostei','curti','curtimos','amamos','adoramos','sim'];
  negative_s text[] := array['pessim','horrivel','horriveis','odiei','odeio','detest','ruim','ruins','fracasso','vergonh','triste','decepc','chatice','tedio','entediant','cansativ','demorad','lotad','bagunc','sujeira','infeliz','faltou','faltaram','precisa melhorar','poderia melhorar','podia ser melhor','nao presta','nao gostei','nao recomendo','nada bom','pior'];
  criticism_p text[] := array['nao gostei','nao recomendo','poderia melhorar','precisa melhorar','podia ser melhor','faltou organiz','mal organizad','desorganizad','reclamac','reclamar','decepcion','muito ruim','que absurdo','indignad','fila enorme','fila grande','demorou demais','falta de organizac','pior evento','pessima organizac','ponto a melhorar','sugestao','sugiro','deveria','deveriam'];
  sarcasm_p text[] := array['so que nao','so q nao','sqn','ate parece','aham','ironia','nada a ver','que piada','piada','zoeira','zoando','zuera','kk','haha','hehe','rsrs','kkk'];
  positive integer := 0;
  context integer := 0;
  term text;
  has_negative boolean;
  negated boolean;
  connector boolean;
begin
  if reason is not null then
    return jsonb_build_object('label','blocked','status','rejected','audience','public','category', reason,
      'note', note_rules || 'conteúdo não permitido (' || reason || '). Recusado no envio e não gravado.','aiUsed', false, 'sentiment', 'negative');
  end if;
  if norm = '' then
    return jsonb_build_object('label','neutral','status','pending','audience','public','note', note_rules || 'sem texto para avaliar. Aguardando revisão humana.','aiUsed', false, 'sentiment', 'neutral');
  end if;

  if public.ul_has(norm, criticism_p, 'phrase') or (position('fila' in norm) > 0 and norm ~ '(enorm|grande|demor|long|lotad)') then
    return jsonb_build_object('label','criticism','status','pending','audience','admin','note', note_rules || 'crítica. Encaminhada somente à equipe.','aiUsed', false, 'sentiment', 'negative');
  end if;

  if public.ul_has(norm, strong_w, 'word') or public.ul_has(norm, strong_s, 'stem') or public.ul_has(norm, phrase_pos, 'phrase')
     or folded ~ 'nota\s*(10|dez|mil|1000|100)\M' or folded ~ '10\s*/\s*10' or folded ~ '1000\s*%' then
    positive := 2;
  end if;
  if public.ul_has(norm, weak_w, 'word') then positive := positive + 1; end if;
  foreach term in array context_s loop
    if public.ul_has(norm, array[term], 'stem') then context := context + 1; end if;
  end loop;
  if raw ~ '!' then context := context + 1; end if;

  has_negative := public.ul_has(norm, negative_s, 'stem');
  negated := (' ' || norm) ~ ' (nao|nem|nunca|jamais|nada) ((foi|e|eh|ta|esta|estava|achei|ficou|era|muito|tao|tem|teve|tinha|de) )?(bom|boa|legal|lind|top|show|incriv|otim|massa|bacana|perfeit|maravilh|parabe|gostei|amei|curti|sucess|orgulh)';
  connector := (' ' || norm || ' ') ~ ' (mas|porem|entretanto|contudo|apesar|so que|todavia) ';

  if public.ul_has(norm, sarcasm_p, 'stem') or negated or (connector and (has_negative or position(' nao ' in ' ' || norm || ' ') > 0)) then
    return jsonb_build_object('label','neutral','status','pending','audience','public','note', note_rules || 'mistura de elogio e restrição, ironia ou risada. Aguardando revisão humana.','aiUsed', false, 'sentiment', 'neutral');
  end if;
  if has_negative then
    if positive > 0 then
      return jsonb_build_object('label','neutral','status','pending','audience','admin','note', note_rules || 'mistura de elogio e queixa. Só a equipe vê.','aiUsed', false, 'sentiment', 'neutral');
    end if;
    return jsonb_build_object('label','criticism','status','pending','audience','admin','note', note_rules || 'tom negativo. Encaminhada somente à equipe.','aiUsed', false, 'sentiment', 'negative');
  end if;
  if positive >= 2 or (positive >= 1 and context >= 1) or context >= 2 then
    return jsonb_build_object('label','positive','status','approved','audience','public','note', note_rules || 'mensagem positiva e sem termo proibido. Publicada no painel.','aiUsed', false, 'sentiment', 'positive');
  end if;
  return jsonb_build_object('label','neutral','status','pending','audience','public','note', note_rules || 'texto neutro, sem elogio claro. Aguardando revisão humana.','aiUsed', false, 'sentiment', 'neutral');
end;
$$;

-- Nome + texto. Nome é checado sozinho; figurinhas positivas sozinhas valem como elogio.
create or replace function public.classify_post(p_author text, p_body text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  author_result jsonb := public.classify_text(coalesce(p_author, ''));
  body text := coalesce(p_body, '');
  joined_reason text := public.ul_block_reason(coalesce(p_author, '') || ' ' || body);
  good_emoji text[] := array['❤','💙','💛','💚','🧡','💜','🤍','💖','💗','💓','💕','💞','👏','😍','🚀','🤩','🙌','💡','🎉','👍','✨','⭐','🌟','🥰','😊','😀','😃','😄','😁','🙏','💯','🏆','🥇','🔬','🧪','📚','🎓','🇧🇷','👌','💪','🤝','🎊','🌻','🌈','☀','😎','🫶','👊'];
  term text;
  has_good boolean := false;
begin
  if author_result->>'status' = 'rejected' then return author_result; end if;
  if joined_reason is not null then return public.classify_text(coalesce(p_author, '') || ' ' || body); end if;
  if public.normalize_school_text(body) = '' then
    foreach term in array good_emoji loop
      if position(term in body) > 0 then has_good := true; end if;
    end loop;
    if has_good then
      return jsonb_build_object('label','positive','status','approved','audience','public','note','Classificação automática por regras (não é inteligência artificial): só figurinhas positivas. Publicada no painel.','aiUsed', false, 'sentiment', 'positive');
    end if;
    if body = '' then return author_result; end if;
  end if;
  return public.classify_text(body);
end;
$$;

-- create_post: recusado não é gravado.
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
    result := public.classify_post(v_author, v_body);
    if result->>'status' = 'rejected' then
      -- Nada é gravado: nem texto, nem nome, nem arquivo. A equipe não vê.
      if result->>'category' = 'personal_data' then
        raise exception 'Por segurança, não coloque telefone, e-mail ou documento. Que tal deixar uma mensagem positiva?';
      end if;
      raise exception 'Sua mensagem não pôde ser publicada. Que tal deixar uma mensagem positiva?';
    end if;
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
