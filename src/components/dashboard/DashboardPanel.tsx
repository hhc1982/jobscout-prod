import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'

const STAGES = [
  { key: 'wishlist',     label: 'Wishlist',     color: '#8b8a99' },
  { key: 'applied',      label: 'Applied',      color: '#7c6af5' },
  { key: 'screening',    label: 'Screening',    color: '#2dd4bf' },
  { key: 'interviewing', label: 'Interviewing', color: '#fbbf24' },
  { key: 'offer',        label: 'Offer',        color: '#34d399' },
  { key: 'rejected',     label: 'Rejected',     color: '#f87171' },
]

export default function DashboardPanel() {
  const { user, profile, applications, interviews, shortlistedJobs,
          setApplications, setInterviews, setShortlistedJobs, setActivePanel } = useStore()

  useEffect(() => { if (user) fetchAll() }, [user])

  const fetchAll = async () => {
    const [{ data: apps }, { data: ints }, { data: sj }] = await Promise.all([
      supabase.from('applications').select('*, job:jobs(*)').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('interviews').select('*').eq('user_id', user!.id).order('interview_date', { ascending: true }),
      supabase.from('shortlisted_jobs').select('*, job:jobs(*)').eq('user_id', user!.id).eq('dismissed', false).order('match_score', { ascending: false }).limit(20),
    ])
    setApplications(apps || [])
    setInterviews(ints || [])
    setShortlistedJobs(sj || [])
  }

  const greeting = () => {
    const h = new Date().getHours()
    const name = profile?.full_name?.split(' ')[0] || 'there'
    const emoji = h < 12 ? '☀' : h < 17 ? '🌤' : '🌙'
    const word = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    return `${word}, ${name} ${emoji}`
  }

  const applied = applications.filter(a => ['applied','screening','interviewing','offer'].includes(a.stage)).length
  const interviewing = applications.filter(a => a.stage === 'interviewing').length
  const offers = applications.filter(a => a.stage === 'offer').length
  const responseRate = applied > 0 ? Math.round((interviewing + offers) / applied * 100) : 0
  const newMatches = shortlistedJobs.filter(j => !j.actioned).length

  const upcomingInterviews = interviews.filter(i => {
    if (!i.interview_date) return false
    return new Date(i.interview_date) >= new Date(new Date().setHours(0,0,0,0))
  }).slice(0, 3)

  const stageColor = (s: number) => s >= 85 ? '#34d399' : s >= 70 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      {/* Topbar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#17171d', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{greeting()}</div>
          <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>
            {new Date().toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button onClick={() => setActivePanel('shortlisted')} style={{ background: '#7c6af5', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          ＋ Find Jobs
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '22px' }}>
          {[
            { label: 'Applied', value: applied, color: '#a594f9', delta: `${applications.filter(a=>a.stage==='applied').length} pending` },
            { label: 'Interviewing', value: interviewing, color: '#2dd4bf', delta: 'Active pipeline' },
            { label: 'New Matches', value: newMatches, color: '#fbbf24', delta: 'Fetched today' },
            { label: 'Response Rate', value: `${responseRate}%`, color: '#34d399', delta: 'vs avg 28%' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-1px', marginTop: '3px', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>{s.delta}</div>
            </div>
          ))}
        </div>

        {/* Pipeline mini kanban */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Application Pipeline</div>
          <button onClick={() => setActivePanel('tracker')} style={{ fontSize: '11px', color: '#8b8a99', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>View full →</button>
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '22px', paddingBottom: '4px' }}>
          {STAGES.slice(0, 5).map(s => {
            const apps = applications.filter(a => a.stage === s.key)
            return (
              <div key={s.key} style={{ flex: '0 0 180px', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#8b8a99', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '9px', fontFamily: "'DM Mono', monospace" }}>{apps.length}</span>
                </div>
                {apps.slice(0, 2).map(a => (
                  <div key={a.id} onClick={() => setActivePanel('tracker')} style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px', marginBottom: '5px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>{a.role}</div>
                    <div style={{ fontSize: '10px', color: '#8b8a99', marginBottom: '5px' }}>{a.company}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {a.match_score && <span style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: stageColor(a.match_score) }}>{a.match_score}%</span>}
                      <span style={{ fontSize: '10px', color: '#4a4958' }}>{a.date_saved}</span>
                    </div>
                  </div>
                ))}
                {apps.length === 0 && <div style={{ fontSize: '11px', color: '#4a4958', textAlign: 'center', padding: '10px 0' }}>Empty</div>}
              </div>
            )
          })}
        </div>

        {/* Upcoming interviews */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Upcoming Interviews</div>
          <button onClick={() => setActivePanel('interviews')} style={{ fontSize: '11px', color: '#8b8a99', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>View all →</button>
        </div>
        {upcomingInterviews.length === 0 ? (
          <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#4a4958' }}>
            No upcoming interviews · <span style={{ color: '#a594f9', cursor: 'pointer' }} onClick={() => setActivePanel('interviews')}>Add one</span>
          </div>
        ) : upcomingInterviews.map(i => {
          const d = i.interview_date ? new Date(i.interview_date) : null
          const stageClr: Record<string, string> = { 'Phone Screen': '#2dd4bf', 'Technical Round': '#a594f9', 'Final Round': '#fbbf24' }
          return (
            <div key={i.id} style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '8px' }}>
              {d && (
                <div style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: '9px', color: '#8b8a99', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', marginTop: '1px' }}>{d.toLocaleString('default', { month: 'short' })}</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{i.role} — {i.company}</div>
                <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.interview_time} · {i.format}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: `${stageClr[i.stage] || '#8b8a99'}18`, color: stageClr[i.stage] || '#8b8a99', fontFamily: "'DM Mono', monospace" }}>{i.stage}</span>
                <button onClick={() => setActivePanel('research')} style={{ fontSize: '10px', color: '#a594f9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>✦ Prep</button>
              </div>
            </div>
          )
        })}

        {/* New matches banner */}
        {newMatches > 0 && (
          <div onClick={() => setActivePanel('shortlisted')} style={{ marginTop: '16px', background: 'rgba(124,106,245,0.07)', border: '1px solid rgba(124,106,245,0.2)', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>★</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#a594f9' }}>{newMatches} new jobs matched your profile today</div>
              <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '2px' }}>Tap to review and apply →</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
