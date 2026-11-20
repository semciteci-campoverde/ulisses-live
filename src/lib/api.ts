import { createLocalBackend } from './localBackend.ts'
import { createSupabaseBackend } from './supabaseBackend.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const api = url && key ? createSupabaseBackend(url, key) : createLocalBackend()
export const usingSupabase = Boolean(url && key)
