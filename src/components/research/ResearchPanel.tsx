import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import { generateResearch } from '../../lib/claude'
import toast from 'react-hot-toast'
import type { Research } from '../../types'

const TABS = [
  { key: 'company',   label: 'Company' },
  { key: 'role',      label: 'The Role' },
  { key: 'domain',    label: 'Domain' },
  { key: 'questions', label: 'Questions' },
  { key: 'points',    label: 'Talking Points' },
  { key: 'salary',    label: 'Salary Intel' },
]

export default function ResearchPanel() {
  const { user, profile, interviews } = useStore()
  const [selectedId, setSelectedId] = useState('')
  const [customCo, setCustomCo] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [research, setResearch] = useState<Research | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('company')

  const upcoming = interviews.filter(i => {
    if (!i.interview_date) return true
    return new Date(i.interview_date) >= new Date(new Date().setHours(0, 0, 0, 0))
  })

  const generate = async () => {

    let co = customCo, role = customRole, stage = ''
    if (selectedId && selectedId !== 'custom') {
      const int = upcoming.find(i => i.id === selectedId)
      if (!int) { toast.error('Interview not found'); return }
      co = int.company; role = int.role; stage = int.stage
    }
    if (!co || !role) { toast.error('Please select an interview or enter company/role'); return }

    setLoading(true)
    toast.loading(`Generating research for ${role} @ ${co}…`, { id: 'research' })

    try {
      const result = await generateResearch({ company: co, role, interviewStage: stage, userProfile: profile! })

      // Save to DB
      const intId = selectedId !== 'custom' ? selectedId : undefined
      const { data } = await supabase.from('research').insert({
        user_id: user!.id,
        interview_id: intId || null,
        company: co,
        role,
        company_overview: result.company_overview,
        company_recent: result.company_recent,
        role_breakdown: result.role_breakdown,
        role_looking_for: result.role_looking_for,
        domain_context: result.domain_context,
        interview_questions: result.interview_questions,
        talking_points: result.talking_points,
        salary_intel: result.salary_intel,
      }).select().single()

      setResearch(data || result as any)
      setTab('company')
      toast.success('Research ready!', { id: 'research' })
    } catch (err: any) {
      toast.error(err.message || 'Generation failed', { id: 'research' })
    } finally {
      setLoading(false)
    }
  }

  const renderContent = (text?: string) => {
    if (!text) return <div style={{ color: '#4a4958', fontSize: '13px' }}>No content generated</div>
    return (
      <div style={{ fontSize: '13px', color: '#8b8a99', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
        dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8e6f0;font-weight:500">$1</strong>').replace(/✦/g, '<span style="color:#a594f9">✦</span>').replace(/•/g, '<span style="color:#7c6af5">•</span>') }}
      />
    )
  }

  const tabContent: Record<string, string | undefined> = research ? {
    company:   `${research.company_overview || ''}\n\n${research.company_recent || ''}`,
    role:      `${research.role_breakdown || ''}\n\n${research.role_looking_for || ''}`,
    domain:    research.domain_context,
    questions: research.interview_questions,
    points:    research.talking_points,
    salary:    research.salary_intel,
  } : {}

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#17171d', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 600 }}>Interview Research</div>
        <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>AI-generated prep materials powered by Claude</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Selector */}
        <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{ flex: 1, minWidth: '200px', background: '#17171d', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0', fontSize: '13px', outline: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              <option value="">— Select upcoming interview —</option>
              {upcoming.map(i => (
                <option key={i.id} value={i.id}>
                  {i.stage}: {i.role} @ {i.company}{i.interview_date ? ` (${new Date(i.interview_date).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })})` : ''}
                </option>
              ))}
              <option value="custom">+ Enter manually</option>
            </select>
            <button
              onClick={generate}
              disabled={loading}
              style={{ background: loading ? '#4a4958' : '#7c6af5', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: 1 }}
            >
              {loading ? '✦ Generating…' : '✦ Generate Prep'}
            </button>
          </div>

          {selectedId === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input value={customCo} onChange={e => setCustomCo(e.target.value)} placeholder="Company name" style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0', fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
              <input value={customRole} onChange={e => setCustomRole(e.target.value)} placeholder="Role title" style={{ background: '#17171d', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0', fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
            </div>
          )}
        </div>

        {!research && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8b8a99' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
            <div style={{ fontSize: '14px', color: '#e8e6f0', marginBottom: '6px', fontWeight: 500 }}>Select an interview to prepare</div>
            <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
              Claude will generate company research, role analysis,<br />
              domain context, likely questions, and tailored talking points
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b8a99' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124,106,245,0.07)', border: '1px solid rgba(124,106,245,0.18)', borderRadius: '20px', padding: '10px 16px', fontSize: '12px', color: '#a594f9' }}>
              <span style={{ display: 'flex', gap: '3px' }}>
                {[0,1,2].map(i => <span key={i} style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#a594f9', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </span>
              Claude is generating research materials…
            </div>
          </div>
        )}

        {research && !loading && (
          <>
            {/* Research header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{research.role}</div>
                <div style={{ fontSize: '12px', color: '#8b8a99', marginTop: '1px' }}>{research.company} · Generated {new Date(research.generated_at).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <button onClick={generate} style={{ fontSize: '11px', color: '#a594f9', background: 'rgba(124,106,245,0.08)', border: '1px solid rgba(124,106,245,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                ⟳ Refresh
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '16px', background: '#1e1e27', padding: '3px', borderRadius: '8px', flexWrap: 'wrap' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: "'DM Sans', sans-serif", background: tab === t.key ? '#17171d' : 'transparent', color: tab === t.key ? '#e8e6f0' : '#8b8a99', fontWeight: tab === t.key ? 500 : 400, boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '18px' }}>
              {renderContent(tabContent[tab])}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
