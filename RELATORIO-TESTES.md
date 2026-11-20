# Relatório de testes — ULISSES LIVE

Data do ensaio: 20/11/2026.  
Ambiente: Linux, Node.js 22.23, Chrome headless, FFmpeg 6.1.  
Banco usado nos testes: SQLite local, em pasta temporária. Não é o banco da feira.

Não havia credencial de Supabase nem de hospedagem. O site **não foi publicado** na internet. O SQL do Supabase foi escrito e revisado, mas não executado num projeto real.

## O que passou

Comando: `npm test`.

Classificador de regras (`tests/rules.ts`), sem chave de IA:

- 12 mensagens positivas, entre elas “A feira está linda” e “Parabéns… incrível”, saem aprovadas e o texto avisa que não é inteligência artificial.
- 13 palavrões são recusados, inclusive ofuscados: `p o r r a`, `P.O.R.R.A`, `pooorraaa`, `p0rr@`, `p-o-r-r-a`, `c a r a l h o`, `m3rda`, `f o d a`, `v t n c`.
- Ofensas (“seu burro”, “uns idiotas”, “cala a boca”) são recusadas.
- Propaganda e link são recusados.
- Crítica (“Não gostei da organização”, “Poderia melhorar o som”) fica só para a equipe, mesmo quando também elogia os alunos.
- Texto neutro (“Estou na sala 3”, “coleta de lixo”, “o burro” num projeto de ciências) espera uma pessoa e não é recusado à toa.
- “Diga não ao racismo” e “violência na escola” ficam pendentes.
- E-mail, telefone e CPF não vão ao mural.
- Foto com legenda positiva continua na revisão humana. Foto com palavrão é recusada.
- Se a escola desliga a publicação automática, o elogio fica na fila, ainda marcado como positivo.

Fluxos de API (`tests/flows.ts`), com dois identificadores de navegador:

- A primeira presença conta. A segunda, no mesmo navegador, não aumenta o total.
- Outro navegador aumenta o total.
- Mensagem positiva entra no feed público sem passar pela equipe, com rótulo `positive` e `aiUsed: false`.
- `p o r r a` é recusado no servidor e não entra no feed.
- Texto neutro fica pendente e só aparece depois que a equipe aprova.
- Foto fica inacessível sem login (resposta 401) e abre para a equipe. Depois de aprovada, abre no endereço público.
- Vídeo de 18 segundos é recusado. Vídeo de 2 segundos, em MP4, entra na fila.
- Emergência liga e desliga no cadastro do evento.
- Exemplos e a limpeza do modo demonstração não alteram a contagem da feira real.
- A limpeza da feira real por esse botão é recusada.
- O canal ao vivo (`/stream`) entrega o primeiro evento de conexão.

No Chrome, com o site compilado:

- `/participar` registrou presença, avisou que mensagem positiva entra na hora e ofereceu mensagem, foto, vídeo e reação.
- `/tv` em 1920×1080 mostrou ao mesmo tempo a mensagem positiva, o contador de presenças, a foto e o vídeo, com o estado “Ao vivo”.
- `/admin` entrou com senha, mostrou indicadores e a fila com o motivo da classificação. O envio `p o r r a` aparece como ofensa recusada, com botões para a equipe publicar ou manter fora.
- A foto pendente não estava no feed público.

As capturas estão em `docs/screenshots/` (`participar.png`, `tv.png`, `admin.png`, `admin-moderacao.png`, `home.png`). O contador nelas é de navegadores de teste abertos neste ensaio, mais uma mensagem e uma foto de teste. Não é público da feira. O banco dessas imagens não entra no Git.

## O que não foi possível provar daqui

- Várias televisões físicas ao mesmo tempo. O mecanismo é o mesmo canal e o mesmo relógio do servidor; o ensaio usou o navegador e o canal de eventos, não uma sala com vários aparelhos.
- Celulares reais na rede da escola, inclusive câmera e HEIC.
- Um projeto Supabase de verdade: cadastro, RLS, storage e tempo real do Postgres.
- HTTPS público. Falta a conta da Vercel ou do Netlify e as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- A função opcional de IA. Sem chave, o caminho testado é o honesto: revisão humana.
- Publicação dentro do Instagram. O sistema só prepara e avisa que a postagem é manual na conta da escola.
- A duração do vídeo no modo Supabase depende do que o navegador informa e da revisão humana. No modo local, o FFmpeg mede o arquivo.

## Limitações conhecidas

- Presença é por navegador, de propósito. Não identifica a pessoa.
- O filtro de regras erra contexto e ironia. Por isso o padrão é fila humana. Fotos e vídeos nunca passam direto.
- No modo local, um único processo Node guarda o SQLite. Serve para a escola e para o ensaio. Para muitos celulares ao mesmo tempo, o caminho previsto é o Supabase.
- A retenção automática roda na subida do servidor local e a cada seis horas, além do botão da equipe.
- O pacote da área da equipe é grande (planilha e PDF). Ele só baixa quando alguém abre `/admin`.
- A logomarca padrão é o recorte do convite. Em tela muito pequena, o desenho interno do brasão fica menos nítido porque a arte original, no vídeo do convite, tem 720 pixels de largura.

## Como repetir

```bash
npm install
npm test
npm run build
ADMIN_EMAIL=admin@eecm.local ADMIN_PASSWORD=uma-senha DATA_DIR=/tmp/ulisses npm start
```

Troque a senha. Não use a senha de ensaio fora da máquina de teste.
