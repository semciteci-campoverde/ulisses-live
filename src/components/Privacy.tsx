import type { EventRow } from '../lib/types'

export function PrivacyNotice({ event }: { event: EventRow | null }) {
  const days = event?.settings?.retention_days ?? 180
  return (
    <div className="space-y-3 text-sm leading-relaxed text-white/80">
      <p>
        <strong className="text-white">Presença sem cadastro.</strong> Ao abrir esta página, o seu navegador recebe um código aleatório que fica guardado
        só no seu aparelho. Ele serve apenas para contar a presença uma única vez. Não pedimos nome, CPF, telefone, e-mail ou senha para registrar presença.
      </p>
      <p>
        <strong className="text-white">O contador mostra presenças registradas por navegador.</strong> Ele não é o número exato de pessoas: quem usa dois
        celulares conta duas vezes, e uma família que usa um só celular conta uma vez.
      </p>
      <p>
        <strong className="text-white">Publicações.</strong> O nome só é pedido para mensagens, fotos e vídeos, e pode ser um apelido ou só o primeiro nome.
        Não escreva telefones, endereços ou documentos. Mensagens passam por um filtro automático de palavras e, se houver dúvida, por um adulto da equipe.
        Fotos e vídeos sempre são revistos por uma pessoa da equipe antes de aparecer no telão.
      </p>
      <p>
        <strong className="text-white">Imagem de estudantes e de outras pessoas.</strong> Só envie fotos e vídeos de quem concordou em aparecer. No caso de
        crianças e adolescentes, é preciso a concordância dos responsáveis. A escola pode recusar qualquer conteúdo.
      </p>
      <p>
        <strong className="text-white">Instagram.</strong> Fotos e vídeos selecionados só serão publicados nas redes sociais da escola se você marcar a
        autorização específica para isso, separada da autorização para o telão.
      </p>
      <p>
        <strong className="text-white">Guarda e exclusão.</strong> Os conteúdos ficam guardados por até {days} dias após o evento, salvo os escolhidos para a
        memória digital do evento. Para pedir a retirada de uma publicação, procure a coordenação da escola.
      </p>
    </div>
  )
}
