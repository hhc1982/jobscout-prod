import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase, uploadCV, updateProfile } from '../../lib/supabase'
import { useStore } from '../../stores/app.store'
import { parseCV, generateBestPracticeCV } from '../../lib/claude'
import toast from 'react-hot-toast'
import type { CVFile } from '../../types'

const SALARY_FIELDS = [
  { key: 'salary_current', label: 'Current Salary (SGD)', hint: 'Private — used to filter out step-down roles', private: true },
  { key: 'salary_min', label: 'Target Range — Min (SGD)', hint: 'Used to match job listings', private: false },
  { key: 'salary_max', label: 'Target Range — Max (SGD)', hint: 'Used to match job listings', private: false },
  { key: 'salary_ask', label: 'Ask Salary (SGD)', hint: 'Your opening number in negotiation — shown only in interview research', private: true },
]

export default function CVPanel() {
  const { user, profile, setProfile, cvFiles, setCVFiles } = useStore()
  const [tab, setTab] = useState<'profile' | 'versions' | 'salary'>('profile')
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [salaries, setSalaries] = useState({
    salary_current: profile?.salary_current || '',
    salary_min: profile?.salary_min || '',
    salary_max: profile?.salary_max || '',
    salary_ask: profile?.salary_ask || '',
  })

  useEffect(() => { if (user) fetchCVFiles() }, [user])

  const fetchCVFiles = async () => {
    const { data } = await supabase.from('cv_files').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
    setCVFiles(data || [])
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    onDrop: async (files) => {
      if (!files[0]) return
      setUploading(true)
      toast.loading('Uploading and parsing CV…', { id: 'cv-upload' })
      try {
        const url = await uploadCV(user!.id, files[0])
        const reader = new FileReader()
        reader.onload = async (e) => {
          const text = e.target?.result as string || ''
          const parsed = await parseCV(url, text)

          // Save CV file record
          const { data: cvRecord } = await supabase.from('cv_files').insert({
            user_id: user!.id,
            type: 'base',
            label: 'Base CV',
            file_url: url,
            file_name: files[0].name,
            parsed_content: parsed,
            is_base: true,
          }).select().single()

          // Update profile with extracted info
          const updates = {
            cv_headline: `${parsed.experience?.[0]?.title || ''} · ${parsed.experience?.length || 0}+ yrs exp`.trim(),
            cv_skills: parsed.skills?.slice(0, 12) || [],
          }
          await updateProfile(user!.id, updates)
          setProfile({ ...profile!, ...updates })

          if (cvRecord) setCVFiles([cvRecord, ...cvFiles.filter(f => !f.is_base)])
          toast.success('CV uploaded and parsed!', { id: 'cv-upload' })
        }
        reader.readAsText(files[0])
      } catch (err: any) {
        toast.error(err.message || 'Upload failed', { id: 'cv-upload' })
      } finally {
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
        user_id: user!.id,
        type: 'best_practice',
        label: `Best Practice v${cvFiles.filter(f => f.type === 'best_practice').length + 1}`,
        parsed_content: { suggestions: result.sections, score: result.overall_score, summary: result.summary },
        is_base: false,
      }).select().single()
      if (data) setCVFiles([data, ...cvFiles])
      toast.success(`CV scored ${result.overall_score}/100 — ${result.sections.length} suggestions ready`, { id: 'bp' })
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

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      {/* Topbar */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#17171d', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600 }}>My CV Profile</div>
        <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>Upload, tailor and generate best-practice versions</div>
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

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <>
            {/* Upload zone */}
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#7c6af5' : 'rgba(255,255,255,0.11)'}`,
              borderRadius: '12px', padding: '32px', textAlign: 'center',
              cursor: 'pointer', marginBottom: '20px',
              background: isDragActive ? 'rgba(124,106,245,0.04)' : 'transparent',
              transition: 'all 0.15s',
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {uploading ? '⟳' : baseCV ? '✓' : '⬆'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: baseCV ? '#34d399' : '#e8e6f0' }}>
                {uploading ? 'Uploading…' : baseCV ? `Base CV: ${baseCV.file_name}` : 'Drop your CV here or click to upload'}
              </div>
              <div style={{ fontSize: '12px', color: '#8b8a99' }}>
                {baseCV ? 'Click to replace · PDF, DOCX, TXT' : 'PDF, DOCX, TXT · AI extracts your profile automatically'}
              </div>
            </div>

            {/* Profile display */}
            {profile && (
              <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c6af5, #2dd4bf)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 600, color: '#fff', flexShrink: 0,
                  }}>
                    {profile.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{profile.full_name}</div>
                    <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '2px' }}>{profile.cv_headline}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <ProfileSection title="Target Roles" items={profile.cv_target_roles} highlight />
                  <ProfileSection title="Key Skills" items={profile.cv_skills} highlight />
                  <ProfileSection title="Preferred Locations" items={profile.cv_locations} />
                  <ProfileSection title="Industries" items={profile.cv_industries} />
                </div>
              </div>
            )}

            {/* Best practice button */}
            {baseCV && (
              <button
                onClick={generateBestPractice}
                disabled={generating}
                style={{
                  marginTop: '14px', width: '100%', padding: '11px',
                  background: 'rgba(124,106,245,0.1)', color: '#a594f9',
                  border: '1px solid rgba(124,106,245,0.25)', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {generating ? '✦ Analysing against best practices…' : '✦ Generate best-practice suggestions'}
              </button>
            )}
          </>
        )}

        {/* VERSIONS TAB */}
        {tab === 'versions' && (
          <div>
            <div style={{ fontSize: '12px', color: '#8b8a99', marginBottom: '14px', lineHeight: 1.6 }}>
              Your base CV is the source of truth and is never modified. Tailored CVs are generated automatically when you apply to a job. Best-practice versions show suggestions you can accept or reject section by section.
            </div>
            {cvFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b8a99', fontSize: '13px' }}>
                Upload your base CV to start generating versions
              </div>
            ) : cvFiles.map(f => (
              <CVFileCard key={f.id} file={f} />
            ))}
          </div>
        )}

        {/* SALARY TAB */}
        {tab === 'salary' && (
          <div>
            <div style={{ background: 'rgba(124,106,245,0.07)', border: '1px solid rgba(124,106,245,0.15)', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px', fontSize: '12px', color: '#8b8a99', lineHeight: 1.6 }}>
              <span style={{ color: '#a594f9' }}>✦</span> &nbsp;Your salary fields are private and never shared. They are used to match job listings to your target range and to provide negotiation context in interview research.
            </div>
            {SALARY_FIELDS.map(field => (
              <div key={field.key} style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#8b8a99', display: 'block', marginBottom: '5px' }}>
                  {field.label} {field.private && <span style={{ color: '#4a4958', fontSize: '10px' }}>· private</span>}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 180000"
                  value={(salaries as any)[field.key]}
                  onChange={e => setSalaries(s => ({ ...s, [field.key]: e.target.value }))}
                  style={{
                    width: '100%', background: '#1e1e27', border: '1px solid rgba(255,255,255,0.11)',
                    borderRadius: '8px', padding: '9px 12px', color: '#e8e6f0',
                    fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif",
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#4a4958', marginTop: '3px', fontFamily: "'DM Mono', monospace" }}>{field.hint}</div>
              </div>
            ))}

            {/* Preview */}
            {(salaries.salary_min || salaries.salary_max) && (
              <div style={{ background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#8b8a99', marginBottom: '6px', fontFamily: "'DM Mono', monospace" }}>PREVIEW</div>
                <div style={{ fontSize: '13px', color: '#e8e6f0' }}>
                  Target range: <span style={{ color: '#a594f9', fontWeight: 500 }}>
                    SGD {salaries.salary_min ? parseInt(String(salaries.salary_min)).toLocaleString() : '—'} – {salaries.salary_max ? parseInt(String(salaries.salary_max)).toLocaleString() : '—'}
                  </span>
                </div>
                {salaries.salary_ask && (
                  <div style={{ fontSize: '13px', color: '#8b8a99', marginTop: '4px' }}>
                    Ask: <span style={{ color: '#fbbf24' }}>SGD {parseInt(String(salaries.salary_ask)).toLocaleString()}</span>
                    <span style={{ fontSize: '10px', color: '#4a4958', marginLeft: '6px' }}>(private)</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={saveSalaries}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px',
                background: '#7c6af5', color: '#fff', border: 'none',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Save Salary Targets
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileSection({ title, items, highlight }: { title: string; items?: string[]; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#4a4958', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {(items || []).map(item => (
          <span key={item} style={{
            fontSize: '11px', padding: '3px 9px', borderRadius: '16px',
            background: highlight ? 'rgba(124,106,245,0.1)' : '#17171d',
            border: `1px solid ${highlight ? 'rgba(124,106,245,0.25)' : 'rgba(255,255,255,0.07)'}`,
            color: highlight ? '#a594f9' : '#e8e6f0',
          }}>{item}</span>
        ))}
      </div>
    </div>
  )
}

function CVFileCard({ file }: { file: CVFile }) {
  const typeColors = { base: '#2dd4bf', tailored: '#7c6af5', best_practice: '#fbbf24' }
  const typeLabels = { base: 'Base CV', tailored: 'Tailored', best_practice: 'Best Practice' }
  const score = (file.parsed_content as any)?.score
  const suggestions = (file.parsed_content as any)?.suggestions?.length || 0

  return (
    <div style={{
      background: '#1e1e27', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', padding: '14px', marginBottom: '8px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: `${typeColors[file.type]}18`,
        border: `1px solid ${typeColors[file.type]}30`,
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
      {file.is_base && (
        <span style={{ fontSize: '10px', color: '#4a4958', fontFamily: "'DM Mono', monospace" }}>🔒 locked</span>
      )}
    </div>
  )
}
