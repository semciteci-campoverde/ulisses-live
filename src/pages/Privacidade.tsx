import { Link, useSearchParams } from 'react-router-dom'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { Sky } from '../components/Sky.tsx'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

export function PrivacidadePage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event } = useLiveEvent(slug)
  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <Topbar event={event} slug={slug} />
      <main className="page-wrap narrow" style={{ lineHeight: 1.55 }}>
        <h1 className="display gold-text" style={{ fontSize: 58 }}>Privacidade e imagem</h1>
        <p>
          Este aviso vale para o ULISSES LIVE da {event?.institution || 'Escola Estadual Cívico-Militar Ulisses Guimarães'},
          em Campo Verde, Mato Grosso. A escola é quem decide sobre os dados deste evento. O contato para pedidos de exclusão
          ou dúvidas é a equipe gestora da escola, pela secretaria ou pela área da equipe neste sistema.
        </p>
        <h2>O que é coletado</h2>
        <ul>
          <li>Um identificador aleatório criado no navegador, só para não contar a mesma presença duas vezes.</li>
          <li>Data e hora da presença e, para conter abusos, um recorte do navegador usado.</li>
          <li>Nome de exibição, mensagem, emoji, fotografia ou vídeo, apenas quando a pessoa escolhe publicar.</li>
          <li>As autorizações marcadas: uso no painel e, separadamente, possibilidade de uso no Instagram.</li>
        </ul>
        <p>Não pedimos CPF, telefone, e-mail, endereço nem cadastro para registrar presença.</p>
        <h2>Para que serve</h2>
        <p>
          Contar presenças por navegador, exibir um mural moderado nas televisões da feira, montar a galeria autorizada
          e, depois do encerramento, a memória do evento. O indicador não mede pessoas físicas distintas nem a ocupação da escola naquele minuto.
        </p>
        <h2>Imagem</h2>
        <p>
          Fotografia e vídeo só entram no painel depois que uma pessoa da equipe aprova. A autorização marcada no envio não substitui
          a autorização de imagem de estudantes e de terceiros exigida pela escola. Sem a opção específica do Instagram, o material
          não deve ser selecionado para as redes. A publicação no Instagram não é automática e depende da conta oficial da escola.
        </p>
        <h2>Quem vê o quê</h2>
        <p>
          Conteúdos pendentes, rejeitados ou marcados só para a administração ficam fora do mural, da galeria e da memória.
          Arquivos ainda não aprovados ficam em armazenamento privado. A área da equipe exige senha.
        </p>
        <h2>Por quanto tempo</h2>
        <p>
          O prazo de retenção é definido pela escola na administração (padrão de 365 dias) e pode ser aplicado por lá.
          No mesmo navegador, a pessoa pode apagar os próprios envios e a própria presença. A equipe também pode excluir qualquer publicação.
        </p>
        <h2>Segurança</h2>
        <p>
          O acesso público deve ocorrer por HTTPS. Há limite de envios por navegador, validação do tipo de arquivo e revisão humana obrigatória de fotos e vídeos.
          Se não houver um serviço de inteligência artificial configurado no servidor, o sistema não finge que fez essa análise.
        </p>
        <p><Link to={withEvent('/participar', slug)}>Voltar a participar</Link></p>
      </main>
      <Footer slug={slug} />
    </div>
  )
}
