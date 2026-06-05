import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const supabase = createClient(
  (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? 'placeholder'
)

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Account created! You are now signed in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/callback' }
      })
    } catch (err: any) {
      toast.error(err.message || 'Google sign in failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f12', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-1.5px', color: '#e8e6f0' }}>
            Job<span style={{ color: '#a594f9' }}>Scout</span>
          </div>
          <div style={{ fontSize: '13px', color: '#8b8a99', marginTop: '6px', fontFamily: "'DM Mono', monospace" }}>
            AI Job Tracker · Free
          </div>
        </div>

        <div style={{
          background: '#17171d', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '28px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px', color: '#e8e6f0' }}>
            {mode === 'signin' ? 'Sign in to JobScout' : 'Create your account'}
          </div>
          <div style={{ fontSize: '13px', color: '#8b8a99', marginBottom: '24px' }}>
            Free to use · No credit card required
          </div>

          <button onClick={handleGoogle} style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            background: '#fff', color: '#111', border: 'none',
            fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            marginBottom: '16px', fontFamily: "'DM Sans', sans-serif",
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }}/>
            <span style={{ fontSize: '11px', color: '#4a4958', fontFamily: "'DM Mono', monospace" }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }}/>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
                color: '#e8e6f0', fontSize: '13px', outline: 'none',
                marginBottom: '10px', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
                color: '#e8e6f0', fontSize: '13px', outline: 'none',
                marginBottom: '10px', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
              }}
            />
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              background: '#7c6af5', color: '#fff', border: 'none',
              fontSize: '13px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif",
            }}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#8b8a99' }}>
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <span onClick={() => setMode('signup')} style={{ color: '#a594f9', cursor: 'pointer' }}>Sign up free</span>
              </>
            ) : (
              <>Already have an account?{' '}
                <span onClick={() => setMode('signin')} style={{ color: '#a594f9', cursor: 'pointer' }}>Sign in</span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '24px' }}>
          {[['◎','AI job matching'],['▦','Application tracker'],['✦','Interview research'],['◈','Auto-apply']].map(([icon, label]) => (
            <div key={label} style={{
              background: '#17171d', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px', padding: '10px 12px', display: 'flex',
              alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8b8a99',
            }}>
              <span style={{ color: '#7c6af5' }}>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
