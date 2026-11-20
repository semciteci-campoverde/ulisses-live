import { supabase } from './supabase'

/** Lista todos os arquivos enviados para um evento (pasta <evento>/<navegador>/arquivo). */
export async function listEventFiles(eventId: string): Promise<string[]> {
  const bucket = supabase.storage.from('uploads')
  const out: string[] = []
  const folders: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(eventId, { limit: 1000, offset })
    if (error) throw error
    for (const f of data || []) if (!f.id) folders.push(`${eventId}/${f.name}`)
    if (!data || data.length < 1000) break
  }
  for (const folder of folders) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(folder, { limit: 1000, offset })
      if (error) throw error
      for (const f of data || []) if (f.id) out.push(`${folder}/${f.name}`)
      if (!data || data.length < 1000) break
    }
  }
  return out
}

export async function removeFiles(paths: string[], onProgress?: (done: number) => void) {
  const bucket = supabase.storage.from('uploads')
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await bucket.remove(paths.slice(i, i + 100))
    if (error) throw error
    onProgress?.(Math.min(paths.length, i + 100))
  }
}
