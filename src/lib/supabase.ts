import { createClient } from '@supabase/supabase-js'

const url = (import.meta as any).env?.VITE_SUPABASE_URL ?? ''
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true }
})

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

export const signUpWithEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password })

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' }
  })

export const signOut = () => supabase.auth.signOut()

export const getProfile = async (userId: string) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data || null
}

export const updateProfile = async (userId: string, updates: Record<string, unknown>) => {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return data
}

export const uploadCV = async (userId: string, file: File) => {
  const path = `${userId}/cv-${Date.now()}.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('cvs').getPublicUrl(path).data.publicUrl
}

export const uploadScreenshot = async (userId: string, file: File) => {
  const path = `${userId}/ss-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('screenshots').upload(path, file)
  if (error) throw error
  return supabase.storage.from('screenshots').getPublicUrl(path).data.publicUrl
}
