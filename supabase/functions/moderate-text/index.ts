// Função opcional. Só faz algo se o segredo AI_API_KEY existir no Supabase.
// Sem a chave, responde que não há IA e não altera o conteúdo.
// Fotos e vídeos nunca são aprovados aqui.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('AI_API_KEY')
  const body = await req.json().catch(() => ({}))
  if (!key) {
    return new Response(JSON.stringify({ ai: false, message: 'Nenhum serviço de IA está configurado.' }), { headers: cors })
  }
  const model = Deno.env.get('AI_MODEL') || 'gpt-4o-mini'
  const url = Deno.env.get('AI_API_URL') || 'https://api.openai.com/v1/chat/completions'
  const prompt = body.kind === 'caption'
    ? `Escreva uma legenda curta de Instagram, em português, sem inventar fatos, para: ${String(body.text || '').slice(0, 400)}. Autor: ${body.author || 'estudante'}. Responda só a legenda.`
    : `Modere o texto de uma feira escolar. Responda só JSON {"decision":"approve|reject|pending|criticism","sentiment":"positive|neutral|negative","reason":"frase curta"}. Texto: ${String(body.text || '').slice(0, 500)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!response.ok) {
    return new Response(JSON.stringify({ ai: false }), { headers: cors, status: 200 })
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  if (body.kind === 'caption') {
    return new Response(JSON.stringify({ ai: true, caption: content.slice(0, 400) }), { headers: cors })
  }
  if (!body.postId) return new Response(JSON.stringify({ ai: false }), { headers: cors })

  let decision = 'pending'
  let reason = 'Análise automática de texto.'
  let sentiment = 'neutral'
  try {
    const parsed = JSON.parse(content.replace(/```json|```/g, ''))
    decision = parsed.decision || 'pending'
    reason = parsed.reason || reason
    sentiment = parsed.sentiment || sentiment
  } catch {
    return new Response(JSON.stringify({ ai: false }), { headers: cors })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: post } = await admin.from('posts').select('id, type, status').eq('id', body.postId).maybeSingle()
  if (!post || post.type !== 'message' || post.status !== 'pending') {
    return new Response(JSON.stringify({ ai: false }), { headers: cors })
  }
  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'pending'
  const audience = decision === 'criticism' ? 'admin' : 'public'
  await admin.from('posts').update({
    status,
    audience,
    ai_used: true,
    sentiment,
    moderation_label: decision === 'criticism' ? 'criticism' : decision === 'reject' ? 'blocked' : 'clean',
    moderation_note: `Análise automática de texto configurada pela escola: ${reason}`.slice(0, 240),
  }).eq('id', post.id)
  return new Response(JSON.stringify({ ai: true, status }), { headers: cors })
})
