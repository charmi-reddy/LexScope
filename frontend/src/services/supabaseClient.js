import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const missing = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

if (missing.length) {
  console.error(`Supabase is not configured. Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`)
}

const supabaseClient = missing.length ? null : createClient(url, anonKey)

export default supabaseClient
