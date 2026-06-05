import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import { generateCoverLetter } from '../../lib/claude'
import toast from 'react-hot-toast'
import type { ShortlistedJob } from '../../types'

const STAGE_COLORS: Record<string, string> = {
  applied: '#7c6af5', screening: '#2dd4bf', interviewing: '#fbbf24',
  offer: '#34d399', rejected: '#f87171',
}

export default function ShortlistedPanel() {
  const { user, profile, shortlistedJobs, setShortlistedJobs, addApplication, dismissShortlisted, actionShortlisted } = useStore()
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'new' | 'actioned'>('new')

  useEffect(() => { if (user) fetchShortlisted() }, [user])

  const fetchShortlisted = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shortlisted_jobs')
        .select('*, job:jobs(*)')
        .eq('user_id', user!.id)
        .eq('dismissed', false)
        .order('match_score', { ascending: false })
        .limit(30)
      if (error) throw error
      setShortlistedJobs(data || [])
    } catch (err: any) {
      toast.error('Failed to load shortlisted jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async (sj: ShortlistedJob, level: 1 | 2) => {
    setApplying(sj.id)

    try {
      if (level === 1) {
        // Level 1: Generate cover letter + open job URL
        toast.loading('Generating tailored cover letter…', { id: 'cl' })
        const coverLetter = await generateCoverLetter({
          jobTitle: sj.job.title,
          company: sj.job.company,
          jobDescription: sj.job.description || '',
          cvContent: undefined as any,
          userProfile: profile!,
        })
        toast.success('Cover letter ready!', { id: 'cl' })

        // Add to applications
        const { data: app } = await supabase.from('applications').insert({
          user_id: user!.id,
          job_id: sj.job_id,
          company: sj.job.company,
          role: sj.job.title,
          job_url: sj.job.url,
          stage: 'wishlist',
          match_score: sj.match_score,
          cover_letter: coverLetter,
          apply_level: 1,
        }).select().single()

        if (app) addApplication(app)
        actionShortlisted(sj.id)
        await supabase.from('shortlisted_jobs').update({ actioned: true }).eq('id', sj.id)

        // Open job URL with cover letter copied
        await navigator.clipboard.writeText(coverLetter).catch(() => {})
        toast.success('Cover letter copied! Opening application…', { duration: 4000 })
        if (sj.job.url) window.open(sj.job.url, '_blank')

      } else if (level === 2) {
        // Level 2: One-click apply via API
        toast.loading('Submitting application…', { id: 'apply' })

        const { data: result, error } = await supabase.functions.invoke('auto-apply', {
          body: {
            jobId: sj.job_id,
            jobUrl: sj.job.url,
            source: sj.job.source,
            userId: user!.id,
          }
        })

        if (error) throw error

        const { data: app } = await supabase.from('applications').insert({
          user_id: user!.id,
          job_id: sj.job_id,
          company: sj.job.company,
          role: sj.job.title,
          job_url: sj.job.url,
          stage: 'applied',
          match_score: sj.match_score,
          apply_level: 2,
          applied_at: new Date().toISOString(),
          applied_via: 'auto_level2',
        }).select().single()

        if (app) addApplication(app)
        actionShortlisted(sj.id)
        await supabase.from('shortlisted_jobs').update({ actioned: true }).eq('id', sj.id)
        toast.success('Applied! Moved to Application Board.', { id: 'apply' })
      }
    } catch (err: any) {
      toast.error(err.message || 'Apply failed', { id: applying === 'cl' ? 'cl' : 'apply' })
    } finally {
      setApplying(null)
    }
  }

  const handleDismiss = async (id: string) => {
    dismissShortlisted(id)
    await supabase.from('shortlisted_jobs').update({ dismissed: true }).eq('id', id)
  }

  const filtered = shortlistedJobs.filter(j =>
    filter === 'all' ? true :
    filter === 'new' ? !j.actioned :
    j.actioned
  )

  const matchColor = (score: number) =>
    score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      {/* Topbar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#17171d', display: 'flex', alignItems: 'center', gap: '12px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Shortlisted Jobs</div>
          <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>
            AI-picked daily matches · Updated 6:00 AM SGT
          </div>
        </div>
        <button
          onClick={fetchShortlisted}
          style={{
            background: '#7c6af5', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
            fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ⟳ Refresh
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '18px',
          background: '#1e1e27', padding: '3px', borderRadius: '8px', width: 'fit-content',
        }}>
          {(['new', 'all', 'actioned'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
                cursor: 'pointer', border: 'none', fontFamily: "'DM Sans', sans-serif",
                background: filter === f ? '#17171d' : 'transparent',
                color: filter === f ? '#e8e6f0' : '#8b8a99',
                fontWeight: filter === f ? 500 : 400,
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {f === 'new' ? `New (${shortlistedJobs.filter(j => !j.actioned).length})` :
               f === 'all' ? `All (${shortlistedJobs.length})` :
               `Actioned (${shortlistedJobs.filter(j => j.actioned).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b8a99' }}>
            <div style={{ marginBottom: '10px' }}>Loading your matches…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8b8a99' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>★</div>
            <div style={{ fontSize: '14px', color: '#e8e6f0', marginBottom: '6px', fontWeight: 500 }}>
              {filter === 'new' ? 'No new matches today' : 'No jobs here yet'}
            </div>
            <div style={{ fontSize: '12px' }}>
              Jobs are matched daily at 6 AM SGT based on your CV profile
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {filtered.map(sj => (
              <div
                key={sj.id}
                style={{
                  background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px', padding: '16px',
                  opacity: sj.actioned ? 0.6 : 1,
                  transition: 'border-color 0.12s',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                      {sj.job?.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b8a99' }}>
                      {sj.job?.company} · {sj.job?.location}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px', fontFamily: "'DM Mono', monospace", fontWeight: 600,
                    padding: '2px 8px', borderRadius: '10px', flexShrink: 0, marginLeft: '8px',
                    background: `${matchColor(sj.match_score)}20`,
                    color: matchColor(sj.match_score),
                  }}>
                    {sj.match_score}%
                  </div>
                </div>

                {/* Salary */}
                {(sj.job?.salary_min || sj.job?.salary_max) && (
                  <div style={{ fontSize: '11px', color: '#34d399', marginBottom: '6px' }}>
                    💰 SGD {sj.job.salary_min?.toLocaleString()}
                    {sj.job.salary_max ? ` – ${sj.job.salary_max.toLocaleString()}` : '+'}
                  </div>
                )}

                {/* Match reasons */}
                {sj.match_reasons?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    {sj.match_reasons.slice(0, 3).map(r => (
                      <span key={r} style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '9px',
                        background: 'rgba(124,106,245,0.1)', color: '#a594f9',
                        fontFamily: "'DM Mono', monospace",
                      }}>{r}</span>
                    ))}
                  </div>
                )}

                {/* Source badge + date */}
                <div style={{ fontSize: '10px', color: '#4a4958', marginBottom: '10px', fontFamily: "'DM Mono', monospace" }}>
                  {sj.job?.source?.toUpperCase()} · {new Date(sj.created_at).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })}
                </div>

                {/* Action buttons */}
                {!sj.actioned ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleApply(sj, 1)}
                      disabled={applying === sj.id}
                      style={{
                        flex: 1, padding: '7px 8px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(124,106,245,0.3)',
                        background: 'rgba(124,106,245,0.1)', color: '#a594f9',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {applying === sj.id ? '…' : '1 Pre-fill'}
                    </button>
                    <button
                      onClick={() => handleApply(sj, 2)}
                      disabled={applying === sj.id}
                      style={{
                        flex: 1, padding: '7px 8px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: 500, cursor: 'pointer', border: 'none',
                        background: '#7c6af5', color: '#fff',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {applying === sj.id ? '…' : '2 Apply'}
                    </button>
                    <button
                      title="Auto apply + follow-up — coming in v2.0"
                      style={{
                        padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                        fontWeight: 500, cursor: 'not-allowed', border: '1px solid rgba(255,255,255,0.07)',
                        background: 'transparent', color: '#4a4958',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      3 🔒
                    </button>
                    <button
                      onClick={() => handleDismiss(sj.id)}
                      style={{
                        padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                        cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)',
                        background: 'transparent', color: '#4a4958',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.2)', borderRadius: '6px',
                    padding: '5px 10px', textAlign: 'center',
                  }}>
                    ✓ Actioned
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
