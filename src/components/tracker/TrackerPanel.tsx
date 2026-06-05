import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import toast from 'react-hot-toast'
import type { ApplicationStage } from '../../types'

const STAGES = [
  { key: 'wishlist',     label: 'Wishlist',     color: '#8b8a99' },
  { key: 'applied',      label: 'Applied',      color: '#7c6af5' },
  { key: 'screening',    label: 'Screening',    color: '#2dd4bf' },
  { key: 'interviewing', label: 'Interviewing', color: '#fbbf24' },
  { key: 'offer',        label: 'Offer',        color: '#34d399' },
  { key: 'rejected',     label: 'Rejected',     color: '#f87171' },
]

export default function TrackerPanel() {
  const { user, applications, setApplications, updateApplication, setActivePanel } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ company: '', role: '', stage: 'wishlist' as ApplicationStage, job_url: '', notes: '' })

  const moveApp = async (id: string, stage: ApplicationStage) => {
    updateApplication(id, { stage })
    await supabase.from('applications').update({ stage }).eq('id', id)
  }

  const saveApp = async () => {
    if (!form.company || !form.role) { toast.error('Company and role required'); return }
    try {
      const { data, error } = await supabase.from('applications').insert({
        user_id: user!.id,
        company: form.company,
        role: form.role,
        stage: form.stage,
        job_url: form.job_url || null,
        notes: form.notes || null,
        match_score: 75,
        date_saved: new Date().toISOString().slice(0, 10),
      }).select().single()
      if (error) throw error
      setApplications([data, ...applications])
      toast.success('Application added!')
      setShowModal(false)
      setForm({ company: '', role: '', stage: 'wishlist', job_url: '', notes: '' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    }
  }

  const deleteApp = async (id: string) => {
    if (!confirm('Remove this application?')) return
    await supabase.from('applications').delete().eq('id', id)
    setApplications(applications.filter(a => a.id !== id))
    toast.success('Removed')
  }

  const matchColor = (s?: number) => !s ? '#8b8a99' : s >= 85 ? '#34d399' : s >= 70 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#17171d', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Application Board</div>
          <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>
            {applications.length} total · {applications.filter(a => a.stage === 'interviewing').length} interviewing · {applications.filter(a => a.stage === 'offer').length} offers
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: '#7c6af5', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          ＋ Add Application
        </button>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: '12px', height: '100%', minWidth: 'max-content' }}>
          {STAGES.map(stage => {
            const apps = applications.filter(a => a.stage === stage.key)
            const nextStage = STAGES[STAGES.findIndex(s => s.key === stage.key) + 1]
            return (
              <div key={stage.key} style={{ width: '220px', display: 'flex', flexDirection: 'column', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', flexShrink: 0 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: stage.color }} />
                    <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stage.label}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#8b8a99', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '9px', fontFamily: "'DM Mono', monospace" }}>{apps.length}</span>
                </div>

                {/* Cards */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {apps.map(app => (
                    <div key={app.id} style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '7px', padding: '10px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '2px', lineHeight: 1.3 }}>{app.role}</div>
                      <div style={{ fontSize: '11px', color: '#8b8a99', marginBottom: '6px' }}>{app.company}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        {app.match_score ? <span style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: matchColor(app.match_score) }}>{app.match_score}%</span> : <span />}
                        <span style={{ fontSize: '10px', color: '#4a4958' }}>{app.date_saved}</span>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {nextStage && (
                          <button onClick={() => moveApp(app.id, nextStage.key as ApplicationStage)} style={{ flex: 1, fontSize: '10px', padding: '3px 6px', borderRadius: '5px', background: 'rgba(124,106,245,0.1)', color: '#a594f9', border: '1px solid rgba(124,106,245,0.2)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                            → {nextStage.label}
                          </button>
                        )}
                        <button onClick={() => setActivePanel('research')} style={{ fontSize: '10px', padding: '3px 7px', borderRadius: '5px', background: 'transparent', color: '#4a4958', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>✦</button>
                        <button onClick={() => deleteApp(app.id)} style={{ fontSize: '10px', padding: '3px 7px', borderRadius: '5px', background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add button */}
                <button onClick={() => { setForm(f => ({...f, stage: stage.key as ApplicationStage})); setShowModal(true) }} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: 'transparent', color: '#4a4958', border: '1px dashed rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: '11px', marginTop: '6px', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                  ＋ Add
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '22px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Add Application</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#8b8a99', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            {[
              { key: 'company', label: 'Company', placeholder: 'e.g. Stripe' },
              { key: 'role', label: 'Role', placeholder: 'e.g. Regional Director' },
              { key: 'job_url', label: 'Job URL (optional)', placeholder: 'https://linkedin.com/jobs/…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', display: 'block', marginBottom: '5px' }}>{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0', fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', display: 'block', marginBottom: '5px' }}>Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({...f, stage: e.target.value as ApplicationStage}))} style={{ width: '100%', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0', fontSize: '13px', outline: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <button onClick={saveApp} style={{ width: '100%', padding: '11px', borderRadius: '8px', background: '#7c6af5', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Save Application
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
