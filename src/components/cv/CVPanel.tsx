import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase, uploadCV, updateProfile } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import { parseCV, generateBestPracticeCV } from '../../lib/claude'
import toast from 'react-hot-toast'
import type { CVFile } from '../../types'

const SALARY_FIELDS = [
  { key: 'salary_current', label: 'Current Salary (SGD)', hint: 'Private — used to filter out step-down roles', private: true },
  { key: 'salary_min',     label: 'Target Range — Min (SGD)', hint: 'Used to match job listings', private: false },
  { key: 'salary_max',     label: 'Target Range — Max (SGD)', hint: 'Used to match job listings', private: false },
  { key: 'salary_ask',     label: 'Ask Salary (SGD)', hint: 'Your opening number in negotiation', private: true },
]

export default function CVPanel() {
  const { user, profile, setProfile, cvFiles, setCVFiles } = useStore()
  const [tab, setTab]           = useState<'profile' | 'versions' | 'salary'>('profile')
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]     = useState(false)

  // Editable profile fields — pre-populated from store
  const [fullName,    setFullName]    = useState(profile?.full_name    || '')
  const [headline,    setHeadline]    = useState(profile?.cv_headline  || '')
  const [rolesInput,  setRolesInput]  = useState((profile?.cv_target_roles  || []).join(', '))
  const [skillsInput, setSkillsInput] = useState((profile?.cv_skills        || []).join(', '))
  const [locsInput,   setLocsInput]   = useState((profile?.cv_locations     || []).join(', '))
  const [indInput,    setIndInput]    = useState((profile?.cv_industries     || []).join(', '))

  const [salaries, setSalaries] = useState({
    salary_current: profile?.salary_current || '',
    salary_min:     profile?.salary_min     || '',
    salary_max:     profile?.salary_max     || '',
    salary_ask:     profile?.salary_ask     || '',
  })

  // Keep fields in sync if profile loads after mount
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name    || '')
      setHeadline(profile.cv_headline  || '')
      setRolesInput((profile.cv_target_roles  || []).join(', '))
      setSkillsInput((profile.cv_skills       || []).join(', '))
      setLocsInput((profile.cv_locations      || []).join(', '))
      setIndInput((profile.cv_industries      || []).join(', '))
      setSalaries({
        salary_current: profile.salary_current || '',
        salary_min:     profile.salary_min     || '',
        salary_max:     profile.salary_max     || '',
        salary_ask:     profile.salary_ask     || '',
      })
    }
  }, [profile?.id])

  useEffect(() => { if (user) fetchCVFiles() }, [user])

  const fetchCVFiles = async () => {
    const { data } = await supabase.from('cv_files').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
    setCVFiles(data || [])
  }

  const saveProfile = async () => {
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    setSaving(true)
    try {
      const updates = {
        full_name:       fullName.trim(),
        cv_headline:     headline.trim(),
        cv_target_roles: rolesInput.split(',').map(s => s.trim()).filter(Boolean),
        cv_skills:       skillsInput.split(',').map(s => s.trim()).filter(Boolean),
        cv_locations:    locsInput.split(',').map(s => s.trim()).filter(Boolean),
        cv_industries:   indInput.split(',').map(s => s.trim()).filter(Boolean),
      }
      await updateProfile(user!.id, updates)
      setProfile({ ...profile!, ...updates })
      toast.success('Profile saved!')
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    onDrop: async (files) => {
      if (!files[0]) return
      setUploading(true)
      toast.loading('Uploading CV…', { id: 'cv-upload' })
      try {
        const url = await uploadCV(user!.id, files[0])
        toast.loading('AI is parsing your CV…', { id: 'cv-upload' })

        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string || ''
            const parsed = await parseCV(url, text)

            const { data: cvRecord } = await supabase.from('cv_files').insert({
              user_id:        user!.id,
              type:           'base',
              label:          'Base CV',
              file_url:       url,
              file_name:      files[0].name,
              parsed_content: parsed,
              is_base:        true,
            }).select().single()

            // Auto-fill profile fields from CV
            const extractedName  = parsed.name  || fullName
            const extractedTitle = `${parsed.experience?.[0]?.title || ''} · ${parsed.experience?.length || 0}+ yrs exp`.trim()
            const extractedSkills = parsed.skills?.slice(0, 12) || []

            const updates = {
              full_name:   extractedName,
              cv_headline: extractedTitle,
              cv_skills:   extractedSkills,
            }
            await updateProfile(user!.id, updates)
            setProfile({ ...profile!, ...updates })
            setFullName(extractedName)
            setHeadline(extractedTitle)
            setSkillsInput(extractedSkills.join(', '))

            if (cvRecord) setCVFiles([cvRecord, ...cvFiles.filter(f => !f.is_base)])
            toast.success('CV uploaded and parsed! Review your profile below.', { id: 'cv-upload' })
          } catch (parseErr: any) {
            // CV uploaded fine — parse failed (likely missing API key in Vercel)
            toast.success('CV uploaded! AI parsing requires Anthropic API key in Vercel — fill in your profile manually below.', { id: 'cv-upload', duration: 6000 })
          } finally {
            setUploading(false)
          }
        }
        reader.onerror = () => {
          toast.error('Could not read file', { id: 'cv-upload' })
          setUploading(false)
        }
        reader.readAsText(files[0])
      } catch (err: any) {
        toast.error(err.message || 'Upload failed', { id: 'cv-upload' })
        setUploading(false)
      }
    }
  })

  const generateBestPractice = async () => {
    const baseCV = cvFiles.find(f => f.is_base)
    if (!baseCV?.parsed_content) { toast.error('Upload your base CV first'); return }
    setGenerating(true)
    toast.loading('Analysing against best practices…', { id: 'bp' })
    try {
      const result = await generateBestPracticeCV(baseCV.parsed_content, profile!)
      const { data } = await supabase.from('cv_files').insert({
        user_id:        user!.id,
        type:           'best_practice',
        label:          `Best Practice v${cvFiles.filter(f => f.type === 'best_practice').length + 1}`,
        parsed_content: { suggestions: result.sections, score: result.overall_score, summary: result.summary },
        is_base:        false,
      }).select().single()
      if (data) setCVFiles([data, ...cvFiles])
      toast.success(`CV scored ${result.overall_score}/100`, { id: 'bp' })
      setTab('versions')
    } catch (err: any) {
      toast.error(err.message || 'Generation failed', { id: 'bp' })
    } finally {
      setGenerating(false)
    }
  }

  const saveSalaries = async () => {
    try {
      const updates = Object.fromEntries(
        Object.entries(salaries).map(([k, v]) => [k, v ? parseInt(String(v)) : null])
      )
      await updateProfile(user!.id, updates)
      setProfile({ ...profile!, ...updates as any })
      toast.success('Salary targets saved')
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    }
  }

  const baseCV = cvFiles.find(f => f.is_base)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1e1e27',
    border: '1px solid rgba(255,255,255,0.11)',
    borderRadius: '8px', padding: '9px 12px',
    color: '#e8e6f0', fontSize: '13px', outline: 'none',
    fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontFamily: "'DM Mono', monospace",
    color: '#8b8a99', display: 'block', marginBottom: '5px',
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      {/* Topbar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#17171d', position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>My CV Profile</div>
          <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>Upload your CV or fill in manually</div>
        </div>
        {tab === 'profile' && (
          <button onClick={saveProfile} disabled={saving} style={{
            background: '#7c6af5', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '7px 16px', fontSize: '13px',
            fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '3px', marginBottom: '20px',
          background: '#1e1e27', padding: '3px', borderRadius: '8px', width: 'fit-content',
        }}>
          {(['profile', 'versions', 'salary'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              border: 'none', fontFamily: "'DM Sans', sans-serif",
              background: tab === t ? '#17171d' : 'transparent',
              color: tab === t ? '#e8e6f0' : '#8b8a99',
              fontWeight: tab === t ? 500 : 400,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              textTransform: 'capitalize',
            }}>{t === 'salary' ? 'Salary Targets' : t}</button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <>
            {/* CV Upload zone */}
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#7c6af5' : 'rgba(255,255,255,0.11)'}`,
              borderRadius: '12px', padding: '24px', textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer', marginBottom: '24px',
              background: isDragActive ? 'rgba(124,106,245,0.04)' : 'transparent',
              transition: 'all 0.15s',
            }}>
              <input {...getInputProps()} disabled={uploading} />
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>
                {uploading ? '⟳' : baseCV ? '✓' : '⬆'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '3px', color: baseCV ? '#34d399' : '#e8e6f0' }}>
                {uploading ? 'Uploading and parsing…' : baseCV ? `Base CV: ${baseCV.file_name}` : 'Drop your CV here or click to upload'}
              </div>
              <div style={{ fontSize: '11px', color: '#8b8a99' }}>
                {uploading ? 'Please wait' : baseCV ? 'Click to replace · PDF, DOCX, TXT' : 'PDF, DOCX, TXT · AI auto-fills fields below'}
              </div>
            </div>

            {/* ── Manual profile fields — always visible ── */}
            <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#8b8a99', marginBottom: '18px', lineHeight: 1.6 }}>
                Upload your CV above to auto-fill, or type directly below. All fields are used to match and score jobs for you.
              </div>

              {/* Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Full Name <span style={{ color: '#f87171' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Hong Chia"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Headline */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Professional Headline</label>
                <input
                  type="text"
                  placeholder="e.g. GM Asia Pacific · 15+ yrs enterprise tech sales"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Target Roles */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Target Roles <span style={{ color: '#4a4958', fontStyle: 'normal' }}>· comma separated</span></label>
                <input
                  type="text"
                  placeholder="e.g. GM APAC, VP Sales, Country Manager, Regional Director"
                  value={rolesInput}
                  onChange={e => setRolesInput(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Key Skills */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Key Skills <span style={{ color: '#4a4958', fontStyle: 'normal' }}>· comma separated</span></label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Sales, SaaS, AI, Go-To-Market, P&L Management"
                  value={skillsInput}
                  onChange={e => setSkillsInput(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Locations */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Preferred Locations <span style={{ color: '#4a4958', fontStyle: 'normal' }}>· comma separated</span></label>
                <input
                  type="text"
                  placeholder="e.g. Singapore, Remote, Hong Kong, Tokyo"
                  value={locsInput}
                  onChange={e => setLocsInput(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Industries */}
              <div style={{ marginBottom: '4px' }}>
                <label style={labelStyle}>Industries <span style={{ color: '#4a4958', fontStyle: 'normal' }}>· comma separated</span></label>
                <input
                  type="text"
                  placeholder="e.g. Technology, SaaS, AI, FinTech, Enterprise Software"
                  value={indInput}
                  onChange={e => setIndInput(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Best practice button */}
            {baseCV && (
              <button
                onClick={generateBestPractice}
                disabled={generating}
                style={{
                  marginTop: '14px', width: '100%', padding: '11px',
                  background: 'rgba(124,106,245,0.1)', color: '#a594f9',
                  border: '1px solid rgba(124,106,245,0.25)', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, cursor: generating ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {generating ? '✦ Analysing against best practices…' : '✦ Generate best-practice suggestions'}
              </button>
            )}
          </>
        )}

        {/* ── VERSIONS TAB ── */}
        {tab === 'versions' && (
          <div>
            <div style={{ fontSize: '12px', color: '#8b8a99', marginBottom: '14px', lineHeight: 1.6 }}>
              Your base CV is the source of truth and is never modified. Tailored CVs are generated automatically when you apply to a job. Best-practice versions show suggestions you can accept or reject.
            </div>
            {cvFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b8a99', fontSize: '13px' }}>
                Upload your base CV first
              </div>
            ) : cvFiles.map(f => (
              <CVFileCard key={f.id} file={f} />
            ))}
          </div>
        )}

        {/* ── SALARY TAB ── */}
        {tab === 'salary' && (
          <div>
            <div style={{ background: 'rgba(124,106,245,0.07)', border: '1px solid rgba(124,106,245,0.15)', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px', fontSize: '12px', color: '#8b8a99', lineHeight: 1.6 }}>
              <span style={{ color: '#a594f9' }}>✦</span>&nbsp; Salary fields are private and never shared. Used to match job listings to your target range and provide negotiation context in interview research.
            </div>
            {SALARY_FIELDS.map(field => (
              <div key={field.key} style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>
                  {field.label} {field.private && <span style={{ color: '#4a4958', fontSize: '10px' }}>· private</span>}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 180000"
                  value={(salaries as any)[field.key]}
                  onChange={e => setSalaries(s => ({ ...s, [field.key]: e.target.value }))}
                  style={inputStyle}
                />
                <div style={{ fontSize: '10px', color: '#4a4958', marginTop: '3px', fontFamily: "'DM Mono', monospace" }}>{field.hint}</div>
              </div>
            ))}
            {(salaries.salary_min || salaries.salary_max) && (
              <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#8b8a99', marginBottom: '6px', fontFamily: "'DM Mono', monospace" }}>PREVIEW</div>
                <div style={{ fontSize: '13px', color: '#e8e6f0' }}>
                  Target: <span style={{ color: '#a594f9', fontWeight: 500 }}>
                    SGD {salaries.salary_min ? parseInt(String(salaries.salary_min)).toLocaleString() : '—'} – {salaries.salary_max ? parseInt(String(salaries.salary_max)).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            )}
            <button onClick={saveSalaries} style={{
              width: '100%', padding: '11px', borderRadius: '8px',
              background: '#7c6af5', color: '#fff', border: 'none',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Save Salary Targets
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CVFileCard({ file }: { file: CVFile }) {
  const typeColors = { base: '#2dd4bf', tailored: '#7c6af5', best_practice: '#fbbf24' }
  const typeLabels = { base: 'Base CV', tailored: 'Tailored', best_practice: 'Best Practice' }
  const score       = (file.parsed_content as any)?.score
  const suggestions = (file.parsed_content as any)?.suggestions?.length || 0
  return (
    <div style={{
      background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', padding: '14px', marginBottom: '8px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: `${typeColors[file.type]}18`, border: `1px solid ${typeColors[file.type]}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', flexShrink: 0,
      }}>
        {file.type === 'base' ? '◈' : file.type === 'tailored' ? '⬡' : '✦'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{file.label || typeLabels[file.type]}</div>
        <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '2px' }}>
          {new Date(file.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
          {score ? ` · Score: ${score}/100` : ''}
          {suggestions > 0 ? ` · ${suggestions} suggestions` : ''}
        </div>
      </div>
      <span style={{
        fontSize: '10px', padding: '2px 8px', borderRadius: '9px',
        background: `${typeColors[file.type]}18`, color: typeColors[file.type],
        fontFamily: "'DM Mono', monospace",
      }}>{typeLabels[file.type]}</span>
      {file.is_base && <span style={{ fontSize: '10px', color: '#4a4958', fontFamily: "'DM Mono', monospace" }}>🔒 locked</span>}
    </div>
  )
}
