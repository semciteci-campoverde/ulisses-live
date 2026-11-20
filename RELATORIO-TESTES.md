# Relatório de testes — ULISSES LIVE

Data do ensaio: 20/11/2026.  
Ambiente: Linux, Node.js 22.23, Chrome headless, FFmpeg 6.1.  
Banco usado nos testes: SQLite local, em pasta temporária. Não é o banco da feira.

Não havia credencial de Supabase nem de hospedagem. O site **não foi publicado** na internet. O SQL do Supabase foi escrito e revisado, mas não executado num projeto real.

## O que passou

Comando: `npm test`.

Filtro de regras (`tests/rules.ts`):

- Mensagem respeitosa fica pendente e o texto deixa claro que não é inteligência artificial.
- A aprovação automática, se a escola ligar, também avisa que não é IA.
- Palavrão é rejeitado.
- “Não gostei…” vai só para a administração.
- “Coleta de lixo” não é tratada como crítica.
- “Diga não ao racismo” fica pendente para uma pessoa decidir.
- E-mail e telefone não vão ao mural.
- Foto, mesmo educada, fica em revisão humana.
- Reação da lista oficial é aceita. Emoji fora da lista, não.

Fluxos de API (`tests/flows.ts`), com dois identificadores de navegador:

- A primeira presença conta. A segunda, no mesmo navegador, não aumenta o total.
- Outro navegador aumenta o total.
- Mensagem limpa não aparece no feed público antes da aprovação.
- Depois que a equipe aprova, a mensagem entra no feed.
- Foto fica inacessível sem login (resposta 401) e abre para a equipe. Depois de aprovada, abre no endereço público.
- Vídeo de 18 segundos é recusado. Vídeo de 2 segundos, em MP4, entra na fila.
- Emergência liga e desliga no cadastro do evento.
- Exemplos e a limpeza do modo demonstração não alteram a contagem da feira real.
- A limpeza da feira real por esse botão é recusada.
- O canal ao vivo (`/stream`) entrega o primeiro evento de conexão.

No Chrome, com o site compilado:

- `/participar` registrou presença, mostrou o aviso de que o número é por navegador e ofereceu mensagem, foto, vídeo e reação.
- `/tv` em 1920×1080 mostrou a mensagem aprovada, o contador, o brasão e o estado “Ao vivo”.
- `/admin` entrou com senha, mostrou indicadores (presenças, mensagens, pendentes, horário no fuso de Campo Verde) e a fila de moderação com a foto ainda privada.
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
