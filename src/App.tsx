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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        const profile = await getProfile(session.user.id)
        setProfile(profile)
        setAuthed(true)
      }
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        const profile = await getProfile(session.user.id)
        setProfile(profile)
        setAuthed(true)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthed(false)
        window.location.href = '/'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!authChecked) {
    return (
      <div style={{
        height: '100vh', background: '#0f0f12', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6f0', letterSpacing: '-1px', marginBottom: '12px' }}>
            Job<span style={{ color: '#a594f9' }}>Scout</span>
          </div>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#7c6af5',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e1e27', color: '#e8e6f0',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#0f0f12' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#0f0f12' } },
        }}
      />
      {authed ? <Layout /> : <AuthScreen />}
    </>
  )
}
