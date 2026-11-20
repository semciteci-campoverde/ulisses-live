import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ulisses-live-admin' },
  realtime: { params: { eventsPerSecond: 20 } },
})

const ERRORS: Record<string, string> = {
  evento_indisponivel: 'Este evento não está recebendo participações no momento.',
  presenca_nao_registrada: 'Não conseguimos confirmar sua presença. Recarregue a página e tente de novo.',
  limite_de_envios: 'Você enviou muitas publicações seguidas. Aguarde alguns minutos e tente de novo.',
  limite_de_reacoes: 'Calma! Espere um instante antes de mandar mais reações.',
  nome_invalido: 'Informe um nome de exibição com 2 a 40 caracteres.',
  texto_longo: 'O texto passou de 200 caracteres.',
  texto_vazio: 'Escreva sua mensagem antes de enviar.',
  quantidade_de_midia_invalida: 'Envie de 1 a 5 fotos, ou 1 vídeo.',
  midia_nao_encontrada: 'Um dos arquivos não terminou de enviar. Tente de novo.',
  midia_invalida: 'Arquivo inválido.',
  autorizacao_de_imagem_obrigatoria: 'Marque a autorização de uso de imagem para enviar fotos ou vídeos.',
  emoji_invalido: 'Reação inválida.',
  tipo_invalido: 'Tipo de publicação inválido.',
  acesso_negado: 'Acesso negado.',
}

export function friendlyError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  for (const key of Object.keys(ERRORS)) {
    if (raw.includes(key)) return ERRORS[key]
  }
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return 'Sem conexão com a internet. Verifique o sinal e tente de novo.'
  if (/exceeded|too large|Payload/i.test(raw)) return 'Arquivo grande demais.'
  if (/mime|type.*not supported|invalid_mime/i.test(raw)) return 'Formato de arquivo não aceito.'
  return raw ? `Não foi possível concluir: ${raw}` : 'Algo deu errado. Tente de novo.'
}
