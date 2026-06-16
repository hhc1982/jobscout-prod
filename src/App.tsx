import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase, getProfile } from './lib/supabase'
import { useStore } from './stores/app.store'
import AuthScreen from './components/auth/AuthScreen'
import Layout from './components/layout/Layout'
import './styles/globals.css'

export default function App() {
  const { setUser, setProfile } = useStore()
  const [authChecked, setAuthChecked] = useState(false)
  const [authed, setAuthed] = useState(false)

  const loadUser = async (userId: string, email: string) => {
    setUser({ id: userId, email })
    const profile = await getProfile(userId)
    setProfile(profile)
    setAuthed(true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUser(session.user.id, session.user.email!)
      }
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
        if (session?.user) {
          await loadUser(session.user.id, session.user.email!)
          setAuthChecked(true)
          if (window.location.search.includes('reset') || window.location.hash.includes('access_token')) {
            window.history.replaceState({}, document.title, '/')
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthed(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authChecked) {
    return (
      <div style={{ height: '100vh', background: '#0f0f12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6f0', letterSpacing: '-1px', marginBottom: '16px' }}>Job<span style={{ color: '#a594f9' }}>Scout</span></div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7c6af5', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e1e27', color: '#e8e6f0', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px' }, success: { iconTheme: { primary: '#34d399', secondary: '#0f0f12' } }, error: { iconTheme: { primary: '#f87171', secondary: '#0f0f12' } } }} />
      {authed ? <Layout /> : <AuthScreen />}
    </>
  )
}
