# ULISSES LIVE

Presença, interação e memória digital da **Feira do Conhecimento 2026** da Escola Estadual Cívico-Militar Ulisses Guimarães, em Campo Verde, Mato Grosso.

Slogan: **Sua presença. Seu olhar. Nossa história.**

O uso no dia do evento está no [MANUAL.md](MANUAL.md). O que foi testado e o que ainda depende de conta está no [RELATORIO-TESTES.md](RELATORIO-TESTES.md).

## O que já funciona neste repositório

- Presença anônima por navegador, com trava de duplicidade no banco.
- Mensagem (200 caracteres), até 5 fotos comprimidas, vídeo de até 15 segundos e reações.
- Fotos e vídeos ficam privados até uma pessoa aprovar. Sem chave de IA, nada é rotulado como inteligência artificial.
- Painel `/tv` em 16:9, cenas automáticas, emergência, reconexão.
- Administração com indicadores, moderação, comunicação, exportação CSV/Excel/PDF, QR e memória.
- Vários eventos, com a feira real separada do modo demonstração.
- Modo local completo (SQLite + arquivos) para rodar e testar sem conta paga.
- SQL, buckets e políticas do Supabase prontos para colar no projeto gratuito.

Não há, neste ambiente, conta Supabase nem hospedagem. Por isso ainda não existe o link público. O passo a passo para publicar está abaixo. Não é preciso contratar plano pago.

## Rodar na escola ou no computador, agora

Requisitos: Node.js 22 ou mais novo e FFmpeg (para medir a duração do vídeo).

```bash
npm install
cp .env.example .env
```

Edite `.env` e troque `ADMIN_PASSWORD`. Depois:

```bash
npm run dev
```

- Participante: http://127.0.0.1:5173/participar
- Televisão: http://127.0.0.1:5173/tv
- Equipe: http://127.0.0.1:5173/admin
- QR para impressão: http://127.0.0.1:5173/qr

O e-mail inicial é o `ADMIN_EMAIL` do `.env` (padrão `admin@eecm.local`).

Para servir o site já compilado, na mesma porta da API:

```bash
npm run build
npm start
```

Aí tudo fica em http://127.0.0.1:8787.

`npm test` cobre o filtro de regras e os fluxos de presença, duplicidade, foto, vídeo, moderação, emergência e demonstração.

## Variáveis

### Servidor local

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `PORT` | não | Porta. Padrão 8787. |
| `DATA_DIR` | não | Pasta do banco e das mídias. Padrão `./data`. |
| `ADMIN_EMAIL` | sim, na prática | E-mail da equipe. |
| `ADMIN_PASSWORD` | sim | Senha da equipe. Se faltar, o servidor gera uma e grava em `data/CREDENCIAIS.txt`. |
| `ADMIN_SYNC` | não | Se for `1`, a senha do `.env` substitui a já gravada. |
| `AI_API_KEY` | não | Chave de um serviço compatível com a API da OpenAI. Fica só no servidor. |
| `AI_API_URL` | não | Padrão `https://api.openai.com/v1/chat/completions`. |
| `AI_MODEL` | não | Padrão `gpt-4o-mini`. |

Sem `AI_API_KEY`, a moderação é humana. O filtro de regras só sugere ou segura conteúdo. Ele não se apresenta como IA.

### Site publicado com Supabase

| Variável | Onde | Obrigatória |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel ou Netlify | sim, para o modo nuvem |
| `VITE_SUPABASE_ANON_KEY` | Vercel ou Netlify | sim, para o modo nuvem |

A chave `anon` é pública por desenho do Supabase. A segurança fica nas políticas do banco (RLS). Não coloque a chave `service_role` no site.

Segredos opcionais da função de IA, só no painel do Supabase:

| Segredo | Obrigatório |
| --- | --- |
| `AI_API_KEY` | não |
| `AI_API_URL` | não |
| `AI_MODEL` | não |

## Publicar de graça

### 1. Banco e arquivos (Supabase, plano Free)

1. Crie uma conta em https://supabase.com e um projeto novo. Não escolha plano pago.
2. Em **SQL Editor**, execute nesta ordem os arquivos de `supabase/migrations/`: `0001_init.sql`, `0002_storage_delete_and_grants.sql`, `0003_preauthorized_admin.sql`, `0004_advisor_fixes.sql` e `0005_fix_create_post.sql`. O `0005` corrige o envio de mensagem, que falhava por uma coluna ambígua.
3. O primeiro cria as tabelas, a feira, o evento de demonstração, os buckets `ulisses-private` e `ulisses-public` e o tempo real. O segundo permite apagar arquivos nas funções de exclusão. O terceiro e o quarto ajustam o acesso da equipe.
4. Em **Authentication → Users**, crie um usuário com e-mail e senha da equipe da escola e confirme o e-mail.
5. Autorize esse e-mail antes ou depois, com um dos dois comandos:

```sql
insert into public.admin_invites (email) values ('email-da-equipe@escola');
```

Se a conta já estiver confirmada, o passo acima não a promove sozinho. Nesse caso use:

```sql
insert into public.admin_users (user_id, email)
values ('COLE-O-UUID-AQUI', 'email-da-equipe@escola');
```

6. Em **Project Settings → API**, copie a Project URL e a chave `anon` `public`.

### 2. Site (Vercel, plano Hobby)

1. Envie este repositório ao GitHub, se ainda não estiver.
2. Em https://vercel.com, importe o repositório. Framework: Vite. Não precisa de plano pago.
3. Em Environment Variables, crie:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a chave anon
4. Faça o deploy. A Vercel entrega HTTPS.
5. Abra `https://SEU-DOMINIO/admin` e entre com o usuário criado no passo 4.
6. Abra `https://SEU-DOMINIO/qr` e imprima os dois QR Codes.
7. Nas TVs, abra `https://SEU-DOMINIO/tv` em tela cheia.

O Netlify também serve. O arquivo `netlify.toml` já aponta o build para `dist`. Use as mesmas duas variáveis.

### 3. IA, se a escola quiser

Só depois do banco no ar, e só se houver uma chave gratuita ou já autorizada:

```bash
npx supabase functions deploy moderate-text
```

Grave `AI_API_KEY` como segredo da função. A publicação das mensagens positivas já acontece pelas regras, sem essa chave. A função só acrescenta uma segunda leitura do texto. Foto e vídeo continuam na fila humana. Se a função não existir ou a chave faltar, a tela não fala em IA.

### Caminho sem Supabase

O `Dockerfile` sobe o site e a API juntos, com SQLite. Serve para um computador da escola ou um container gratuito. Nesse modo há um único servidor: se ele desligar, as TVs param até voltar. O Supabase aguenta melhor várias TVs e celulares ao mesmo tempo. Os dois modos usam a mesma tela.

## Rotas

| Rota | Uso |
| --- | --- |
| `/` | Convite e explicação |
| `/participar` | Presença e envios. É o destino do QR. |
| `/tv` | Painel das televisões |
| `/admin` | Equipe, com senha |
| `/qr` | Impressão dos dois QR Codes |
| `/galeria` | Só o que foi aprovado |
| `/memorias` | Memória pública depois do encerramento |
| `/privacidade` | Aviso de privacidade e imagem |

`?modo=demo` abre o evento de teste. Outros eventos usam `?e=slug`.

## Identidade

As cores seguem o convite oficial: azul royal, azul-marinho, dourado e branco. A logomarca em `public/brand/logo.png` foi recortada do convite, sem redesenho. A equipe pode substituí-la em `/admin`.
