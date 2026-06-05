import { useState, useEffect, useRef } from 'react'
import { supabase, uploadScreenshot } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import { parseScreenshot } from '../../lib/claude'
import { addToGoogleCalendar, formatInterviewDateTime } from '../../lib/calendar'
import toast from 'react-hot-toast'
import type { Interview, InterviewStage, InterviewFormat } from '../../types'

const STAGES: InterviewStage[] = ['Phone Screen', 'Recruiter Screen', 'Technical Round', 'Case Study', 'Panel Interview', 'Final Round', 'Culture Fit']
const FORMATS: InterviewFormat[] = ['Video Call', 'Phone', 'In-Person', 'Take-Home']

const STAGE_COLORS: Record<string, string> = {
  'Phone Screen': '#2dd4bf', 'Recruiter Screen': '#2dd4bf',
  'Technical Round': '#a594f9', 'Case Study': '#a594f9', 'Panel Interview': '#a594f9',
  'Final Round': '#fbbf24', 'Culture Fit': '#fbbf24',
}

export default function InterviewsPanel() {
  const { user, interviews, setInterviews, addInterview } = useStore()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [parsing, setParsing] = useState(false)
  const screenshotRef = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    company: '', role: '', interview_date: '', interview_time: '',
    stage: 'Phone Screen' as InterviewStage,
    format: 'Video Call' as InterviewFormat,
    interviewer: '', notes: '', addToGCal: true,
  })

  useEffect(() => { if (user) fetchInterviews() }, [user])

  const fetchInterviews = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('interviews')
      .select('*')
      .eq('user_id', user!.id)
      .order('interview_date', { ascending: true })
    setInterviews(data || [])
    setLoading(false)
  }

  const handleScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    toast.loading('Reading screenshot…', { id: 'ocr' })
    try {
      const url = await uploadScreenshot(user!.id, file)
      const result = await parseScreenshot(url)
      setForm(f => ({
        ...f,
        company: result.company || f.company,
        role: result.role || f.role,
        interview_date: result.date || f.interview_date,
        interview_time: result.time || f.interview_time,
        format: (result.format as InterviewFormat) || f.format,
        interviewer: result.interviewer || f.interviewer,
        notes: result.notes || f.notes,
      }))
      setShowModal(true)
      toast.success(`Details extracted (${result.confidence} confidence)`, { id: 'ocr' })
    } catch (err: any) {
      toast.error('Could not read screenshot — please fill in manually', { id: 'ocr' })
      setShowModal(true)
    } finally {
      setParsing(false)
    }
  }

  const saveInterview = async () => {
    if (!form.company || !form.role) { toast.error('Company and role are required'); return }
    try {
      const { data, error } = await supabase.from('interviews').insert({
        user_id: user!.id,
        company: form.company,
        role: form.role,
        interview_date: form.interview_date || null,
        interview_time: form.interview_time || null,
        stage: form.stage,
        format: form.format,
        interviewer: form.interviewer || null,
        notes: form.notes || null,
      }).select().single()

      if (error) throw error
      addInterview(data)
      toast.success('Interview saved!')

      if (form.addToGCal && data) {
        addToGoogleCalendar(data)
        toast.success('Opening Google Calendar…', { duration: 2000 })
      }
      setShowModal(false)
      resetForm()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    }
  }

  const resetForm = () => setForm({
    company: '', role: '', interview_date: '', interview_time: '',
    stage: 'Phone Screen', format: 'Video Call',
    interviewer: '', notes: '', addToGCal: true,
  })

  const upcoming = interviews.filter(i => {
    if (!i.interview_date) return true
    return new Date(i.interview_date) >= new Date(new Date().setHours(0,0,0,0))
  })
  const past = interviews.filter(i => i.interview_date && new Date(i.interview_date) < new Date(new Date().setHours(0,0,0,0)))

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      {/* Topbar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#17171d', display: 'flex', alignItems: 'center', gap: '10px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Interviews</div>
          <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>Auto-syncs to Google Calendar</div>
        </div>
        <input ref={screenshotRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScreenshot} />
        <button
          onClick={() => screenshotRef.current?.click()}
          disabled={parsing}
          style={{
            background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)',
            borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {parsing ? '…' : '📷 Screenshot'}
        </button>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#7c6af5', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
            fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ＋ Add Interview
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b8a99' }}>Loading…</div>
        ) : interviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8b8a99' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>◷</div>
            <div style={{ fontSize: '14px', color: '#e8e6f0', marginBottom: '6px', fontWeight: 500 }}>No interviews yet</div>
            <div style={{ fontSize: '12px', marginBottom: '16px' }}>
              Add manually or take a screenshot of your confirmation message
            </div>
            <button
              onClick={() => screenshotRef.current?.click()}
              style={{
                background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
                border: '1px solid rgba(45,212,191,0.25)', borderRadius: '8px',
                padding: '9px 18px', fontSize: '13px', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              📷 Upload screenshot to auto-create
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: '#8b8a99', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Upcoming ({upcoming.length})
                </div>
                {upcoming.map(i => <InterviewCard key={i.id} interview={i} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: '#8b8a99', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.5px', margin: '18px 0 10px', opacity: 0.6 }}>
                  Past ({past.length})
                </div>
                {past.map(i => <InterviewCard key={i.id} interview={i} past />)}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm() } }}>
          <div style={{
            background: '#17171d', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px', padding: '22px', width: '100%', maxWidth: '480px',
            maxHeight: '88vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Schedule Interview</div>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ background: 'none', border: 'none', color: '#8b8a99', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px' }}>
              <Field label="Company" value={form.company} onChange={v => setForm(f => ({...f, company: v}))} placeholder="e.g. Grab" />
              <Field label="Role" value={form.role} onChange={v => setForm(f => ({...f, role: v}))} placeholder="e.g. VP Sales" />
              <Field label="Date" type="date" value={form.interview_date} onChange={v => setForm(f => ({...f, interview_date: v}))} />
              <Field label="Time (SGT)" type="time" value={form.interview_time} onChange={v => setForm(f => ({...f, interview_time: v}))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px', marginTop: '11px' }}>
              <SelectField label="Stage" value={form.stage} options={STAGES} onChange={v => setForm(f => ({...f, stage: v as InterviewStage}))} />
              <SelectField label="Format" value={form.format} options={FORMATS} onChange={v => setForm(f => ({...f, format: v as InterviewFormat}))} />
            </div>

            <div style={{ marginTop: '11px' }}>
              <Field label="Interviewer / Notes" value={form.notes} onChange={v => setForm(f => ({...f, notes: v}))} placeholder="Name, format, what to prepare…" textarea />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8b8a99', cursor: 'pointer', marginTop: '12px' }}>
              <input type="checkbox" checked={form.addToGCal} onChange={e => setForm(f => ({...f, addToGCal: e.target.checked}))} />
              📅 Add to Google Calendar with reminder
            </label>

            <button
              onClick={saveInterview}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px',
                background: '#7c6af5', color: '#fff', border: 'none',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                marginTop: '16px', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Save Interview
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InterviewCard({ interview: i, past }: { interview: Interview; past?: boolean }) {
  const d = i.interview_date ? new Date(i.interview_date) : null
  const stageColor: Record<string, string> = {
    'Phone Screen': '#2dd4bf', 'Recruiter Screen': '#2dd4bf',
    'Technical Round': '#a594f9', 'Case Study': '#a594f9',
    'Final Round': '#fbbf24', 'Culture Fit': '#fbbf24',
  }
  return (
    <div style={{
      background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', padding: '16px', display: 'flex',
      alignItems: 'center', gap: '14px', marginBottom: '10px',
      opacity: past ? 0.6 : 1,
    }}>
      {d && (
        <div style={{
          background: '#17171d', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '7px 11px', textAlign: 'center', flexShrink: 0, minWidth: '52px',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-1px', lineHeight: 1 }}>{d.getDate()}</div>
          <div style={{ fontSize: '9px', color: '#8b8a99', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", marginTop: '2px' }}>
            {d.toLocaleString('default', { month: 'short' })}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{i.role} — {i.company}</div>
        <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i.interview_time} · {i.format} · {i.notes?.slice(0, 50)}{(i.notes?.length || 0) > 50 ? '…' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
        <span style={{
          fontSize: '10px', padding: '2px 8px', borderRadius: '9px',
          background: `${stageColor[i.stage] || '#8b8a99'}18`,
          color: stageColor[i.stage] || '#8b8a99',
          fontFamily: "'DM Mono', monospace",
        }}>{i.stage}</span>
        {!past && (
          <button
            onClick={() => addToGoogleCalendar(i)}
            style={{
              fontSize: '10px', padding: '3px 9px', borderRadius: '6px',
              background: 'rgba(52,211,153,0.08)', color: '#34d399',
              border: '1px solid rgba(52,211,153,0.2)', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            📅 Calendar
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean }) {
  const s = {
    width: '100%', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
    borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0',
    fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box' as const, minHeight: textarea ? '70px' : undefined,
  }
  return (
    <div>
      <label style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', display: 'block', marginBottom: '5px' }}>{label}</label>
      {textarea
        ? <textarea style={s} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={s} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', display: 'block', marginBottom: '5px' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
          borderRadius: '8px', padding: '8px 11px', color: '#e8e6f0',
          fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer', boxSizing: 'border-box',
        }}
      >
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
