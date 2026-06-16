import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

type Mode = 'signin' | 'signup' | 'reset'

export default function AuthScreen() {
  const [mode, setMode]       = useState<Mode>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast.error('Enter your email'); return }
    setLoading(true)
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/?reset=true',
        })
        if (error) throw error
        toast.success('Password reset email sent — check your inbox')
        setMode('signin')
      } else if (mode === 'signup') {
        if (!password) { toast.error('Enter a password'); setLoading(false); return }
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Account created! You are now signed in.')
      } else {
        if (!password) { toast.error('Enter your password'); setLoading(false); return }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast.error('Wrong email or password. Try reset password if you forgot it.')
          } else {
            throw error
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, string> = {
    signin: 'Sign in to JobScout',
    signup: 'Create your account',
    reset:  'Reset your password',
  }

  const subtitles: Record<Mode, string> = {
    signin: 'Welcome back',
    signup: 'Free to use · No credit card required',
    reset:  'We\'ll send a reset link to your email',
  }

  const btnLabels: Record<Mode, string> = {
    signin: 'Sign In',
    signup: 'Create Account',
    reset:  'Send Reset Link',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f12', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1.5px', color: '#e8e6f0' }}>
            Job<span style={{ color: '#a594f9' }}>Scout</span>
          </div>
          <div style={{ fontSize: '12px', color: '#8b8a99', marginTop: '5px', fontFamily: "'DM Mono', monospace" }}>
            AI Job Tracker · Free
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#17171d', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', padding: '28px',
        }}>
          <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px', color: '#e8e6f0' }}>
            {titles[mode]}
          </div>
          <div style={{ fontSize: '12px', color: '#8b8a99', marginBottom: '22px' }}>
            {subtitles[mode]}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#8b8a99', display: 'block', marginBottom: '4px', fontFamily: "'DM Mono', monospace" }}>
                EMAIL
              </label>
              <input
                type="email"
                placeholder="hhc1982@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
                  color: '#e8e6f0', fontSize: '13px', outline: 'none',
                  fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password — hidden on reset mode */}
            {mode !== 'reset' && (
              <div style={{ marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', color: '#8b8a99', display: 'block', marginBottom: '4px', fontFamily: "'DM Mono', monospace" }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
                    color: '#e8e6f0', fontSize: '13px', outline: 'none',
                    fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Forgot password link — only on sign in */}
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <span
                  onClick={() => { setMode('reset'); setPassword('') }}
                  style={{ fontSize: '11px', color: '#a594f9', cursor: 'pointer' }}
                >
                  Forgot password?
                </span>
              </div>
            )}

            {mode !== 'signin' && <div style={{ marginBottom: '16px' }} />}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px',
                background: loading ? '#4a4260' : '#7c6af5',
                color: '#fff', border: 'none', fontSize: '13px',
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
              }}
            >
              {loading ? 'Please wait…' : btnLabels[mode]}
            </button>
          </form>

          {/* Mode switcher */}
          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '12px', color: '#8b8a99' }}>
            {mode === 'signin' && (
              <>Don't have an account?{' '}
                <span onClick={() => { setMode('signup'); setPassword('') }} style={{ color: '#a594f9', cursor: 'pointer' }}>Sign up free</span>
              </>
            )}
            {mode === 'signup' && (
              <>Already have an account?{' '}
                <span onClick={() => { setMode('signin'); setPassword('') }} style={{ color: '#a594f9', cursor: 'pointer' }}>Sign in</span>
              </>
            )}
            {mode === 'reset' && (
              <>Remember it?{' '}
                <span onClick={() => setMode('signin')} style={{ color: '#a594f9', cursor: 'pointer' }}>Back to sign in</span>
              </>
            )}
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '20px' }}>
          {[['◎','AI job matching'],['▦','Application tracker'],['✦','Interview research'],['◈','CV optimiser']].map(([icon, label]) => (
            <div key={label} style={{
              background: '#17171d', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px', padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', color: '#8b8a99',
            }}>
              <span style={{ color: '#7c6af5' }}>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
