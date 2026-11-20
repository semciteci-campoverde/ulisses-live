# Manual — ULISSES LIVE

Feira do Conhecimento 2026  
Escola Estadual Cívico-Militar Ulisses Guimarães · Campo Verde, Mato Grosso

Slogan: **Sua presença. Seu olhar. Nossa história.**

Este manual é para a equipe da escola. A parte técnica de publicação na internet está no README.

## O que o sistema faz

Um único QR Code abre o celular do visitante. A presença entra sozinha, sem nome, CPF, telefone ou cadastro. A pessoa pode deixar mensagem, foto, vídeo curto ou reação. A equipe aprova o que pode ir para as televisões. Várias TVs mostram a mesma programação e se atualizam sozinhas.

O número na tela é de **presenças por navegador**. A mesma pessoa, em outro celular, conta de novo. Quem volta no mesmo navegador não conta duas vezes. O número não diz quantas pessoas estão na escola naquele minuto.

## Antes do dia 24

1. Abra a área da equipe em `/admin` e entre com o e-mail e a senha.
2. Confira nome, datas e horários na aba **Evento**. Programação interna: 24/11/2026. Visitação aberta: 25/11/2026, das 9h às 11h e das 15h às 17h.
3. Se a logomarca precisar ser trocada, envie o arquivo original na mesma aba. Não redesenhe o brasão.
4. Na aba **Exibição**, deixe o mural ligado e a emergência desligada. O tempo de cada cena pode ficar em 12 segundos.
5. Abra `/qr`, confira os dois códigos e imprima.
   - O QR **azul/branco** é o de presença. Espalhe em salas, corredores e espaços.
   - O QR **colorido** é só o Instagram (@e.e.c.m.ulissesguimaraes). Ele não registra presença.
6. Na televisão, abra `/tv` e toque em **Tela cheia** (ou a tecla F). Deixe essa página aberta o dia todo.
7. Faça um teste com o modo demonstração (aba **Demonstração**) antes de usar o evento real. Apague o teste em seguida. Isso não mexe na feira.

## No celular do visitante

Ao escanear o QR de presença aparece: **Presença confirmada! Você faz parte desta história.**

Quatro opções:

- **Mensagem** — nome de exibição e texto de até 200 caracteres.
- **Fotografia** — até 5 imagens, com legenda. O celular comprime a foto antes de enviar.
- **Vídeo** — até 15 segundos, MP4 ou WEBM.
- **Reação** — emoji da lista. Pode aparecer na TV na hora.

Foto e vídeo só entram na TV depois que uma pessoa da equipe aprova. Mensagem limpa também fica na fila, salvo se a escola ligar o filtro automático de regras. Esse filtro **não é inteligência artificial** e não entende ironia.

Para foto ou vídeo, a pessoa marca a autorização de uso no painel. A autorização do Instagram é outra caixa, separada e opcional. Sem ela, o material não deve ir para as redes.

O nome só é pedido na publicação. Nunca para contar presença.

No mesmo celular, a pessoa pode apagar os próprios envios ou remover a própria presença.

## Moderação

Na aba **Moderação**:

- **Aprovar** — pode ir ao painel, à galeria e, se o evento for encerrado, à memória.
- **Rejeitar** — não vai ao ar. A equipe ainda vê o item.
- **Retirar agora** — some das televisões na hora.
- **Excluir** — apaga de vez, inclusive o arquivo.
- **Destacar** — entra com prioridade na TV.

Crítica e possível telefone, e-mail ou CPF ficam só na administração. Se a equipe decidir que foi um alarme falso, use **Publicar no painel mesmo assim**.

Fotos e vídeos nunca são aprovados por máquina. Sem uma chave de IA configurada no servidor, o sistema não diz que fez análise automática.

## Emergência e pausa

O botão vermelho **parar as TVs**, na aba **Exibição**, tira o conteúdo do público de todas as televisões ao mesmo tempo. A página da TV passa a mostrar só a identificação da escola. **Liberar televisões** devolve a programação.

**Pausar mural** esconde mensagens, fotos e vídeos, mas mantém contador, QR e Instagram. A presença continua sendo registrada.

## Televisão

A página `/tv` é horizontal, 16:9, e alterna sozinha:

1. Mensagens aprovadas
2. Mosaico de fotos
3. Vídeos aprovados, sem som
4. Contador de presenças
5. Convite com o QR de presença
6. Instagram, com o outro QR

Quando a contagem cruza 50, 100, 200, 300, 500 ou 1.000, todas as TVs mostram uma cena de celebração por alguns segundos. As metas podem ser alteradas na aba Exibição.

Se a internet oscilar, a página tenta reconectar e também consulta o servidor de tempos em tempos. O ponto verde **Ao vivo** fica âmbar enquanto reconecta.

## Comunicação e Instagram

A aba **Comunicação** reúne fotos e vídeos já aprovados. Dá para marcar categoria, escolher Feed, Stories ou Reels, copiar uma sugestão de legenda e baixar um arquivo ou o lote.

As sugestões de legenda são modelos prontos. O botão de IA só funciona se a escola tiver configurado um serviço. Sem isso, a tela avisa que não há IA.

O sistema **não publica** sozinho no Instagram. Quem publica é a equipe, na conta oficial.

## Depois da feira

Na aba Evento, **Encerrar evento**. A página `/memorias` passa a mostrar o agradecimento, os números e os registros autorizados, com botão para compartilhar o link. Enquanto o evento está aberto, essa página avisa que a memória ainda não foi publicada.

A galeria pública (`/galeria`) só mostra o que já foi aprovado.

## Privacidade

O prazo padrão de guarda é 365 dias. Ele se ajusta na aba **Exportar**. **Aplicar retenção agora** apaga o que for mais antigo que esse prazo.

CSV, Excel e PDF saem na mesma aba. Guarde esses arquivos como documento da escola.

O aviso completo para o público está em `/privacidade`.

## Se algo falhar

- TV parada em “Reconectando”: confira o Wi-Fi e atualize a página uma vez. Ela volta a acompanhar as outras.
- Foto não aparece: está na fila de moderação, ou foi enviada em HEIC. Peça para fotografar de novo pela câmera do navegador.
- Vídeo recusado: passou de 15 segundos ou não está em MP4/WEBM.
- O mesmo aluno contou duas vezes: usou dois navegadores ou dois aparelhos. O sistema é feito assim de propósito.
- Visitante não consegue enviar: o evento pode estar em rascunho ou encerrado, ou o navegador estourou o limite de envios.
