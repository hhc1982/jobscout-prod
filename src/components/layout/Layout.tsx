import { useStore } from '../../stores/app.store'
import { signOut } from '../../lib/supabase'
import DashboardPanel from '../dashboard/DashboardPanel'
import ShortlistedPanel from '../shortlisted/ShortlistedPanel'
import CVPanel from '../cv/CVPanel'
import TrackerPanel from '../tracker/TrackerPanel'
import InterviewsPanel from '../interviews/InterviewsPanel'
import ResearchPanel from '../research/ResearchPanel'
import toast from 'react-hot-toast'

const NAV = [
  { id: 'dashboard',   icon: '⬡', label: 'Dashboard',         group: 'MAIN' },
  { id: 'shortlisted', icon: '★', label: 'Shortlisted Jobs',   group: 'MAIN', badge: 'shortlisted' },
  { id: 'search',      icon: '◎', label: 'Job Search',         group: 'MAIN' },
  { id: 'cv',          icon: '◈', label: 'My CV Profile',      group: 'MAIN' },
  { id: 'tracker',     icon: '▦', label: 'Application Board',  group: 'TRACK', badge: 'apps' },
  { id: 'interviews',  icon: '◷', label: 'Interviews',         group: 'TRACK', badge: 'interviews' },
  { id: 'research',    icon: '✦', label: 'Interview Research', group: 'PREPARE' },
]

export default function Layout() {
  const { activePanel, setActivePanel, sidebarOpen, setSidebarOpen, profile, applications, interviews, shortlistedJobs } = useStore()

  const badges: Record<string, number> = {
    shortlisted: shortlistedJobs.filter(j => !j.actioned && !j.dismissed).length,
    apps: applications.length,
    interviews: interviews.filter(i => i.interview_date && new Date(i.interview_date) >= new Date()).length,
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
  }

  const groups = ['MAIN', 'TRACK', 'PREPARE']

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#0f0f12', fontFamily: "'DM Sans', sans-serif" }}>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      <aside style={{
        width: '220px', flexShrink: 0,
        background: '#17171d', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        position: window.innerWidth <= 768 ? 'fixed' : 'relative',
        top: 0, left: 0, height: '100%', zIndex: 50,
        transform: window.innerWidth <= 768 ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.25s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.5px', color: '#e8e6f0' }}>
            Job<span style={{ color: '#a594f9' }}>Scout</span>
          </div>
          <div style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#4a4958', marginTop: '2px' }}>
            AI Job Tracker · Free
          </div>
        </div>

        {/* Nav */}
        {groups.map(group => (
          <div key={group}>
            <div style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#4a4958', padding: '8px 20px 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {group}
            </div>
            {NAV.filter(n => n.group === group).map(item => (
              <div
                key={item.id}
                onClick={() => { setActivePanel(item.id); setSidebarOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '8px 20px', fontSize: '13px', cursor: 'pointer',
                  borderLeft: `2px solid ${activePanel === item.id ? '#a594f9' : 'transparent'}`,
                  background: activePanel === item.id ? 'rgba(124,106,245,0.07)' : 'transparent',
                  color: activePanel === item.id ? '#e8e6f0' : '#8b8a99',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: '14px', width: '16px', textAlign: 'center', opacity: 0.8 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badges[item.badge] > 0 && (
                  <span style={{
                    background: '#7c6af5', color: '#fff', fontSize: '10px',
                    padding: '1px 6px', borderRadius: '10px', fontFamily: "'DM Mono', monospace",
                  }}>{badges[item.badge]}</span>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Footer — user info + sign out only */}
        <div style={{ marginTop: 'auto', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '10px', color: '#34d399', marginBottom: '8px', fontFamily: "'DM Mono', monospace" }}>
            ✓ Free
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c6af5, #2dd4bf)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 600, color: '#fff', flexShrink: 0,
            }}>
              {profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e8e6f0' }}>
                {profile?.full_name || 'User'}
              </div>
              <button
                onClick={handleSignOut}
                style={{ fontSize: '10px', color: '#4a4958', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {window.innerWidth <= 768 && (
          <div style={{
            padding: '12px 16px', background: '#17171d',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: '#8b8a99', fontSize: '20px', cursor: 'pointer', padding: '2px' }}
            >
              ☰
            </button>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6f0' }}>
              Job<span style={{ color: '#a594f9' }}>Scout</span>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activePanel === 'dashboard'   && <div style={{ height: '100%', overflowY: 'auto' }}><DashboardPanel /></div>}
          {activePanel === 'shortlisted' && <div style={{ height: '100%', overflowY: 'auto' }}><ShortlistedPanel /></div>}
          {activePanel === 'cv'          && <div style={{ height: '100%', overflowY: 'auto' }}><CVPanel /></div>}
          {activePanel === 'tracker'     && <div style={{ height: '100%', overflowY: 'auto' }}><TrackerPanel /></div>}
          {activePanel === 'interviews'  && <div style={{ height: '100%', overflowY: 'auto' }}><InterviewsPanel /></div>}
          {activePanel === 'research'    && <div style={{ height: '100%', overflowY: 'auto' }}><ResearchPanel /></div>}
          {activePanel === 'search'      && <div style={{ height: '100%', overflowY: 'auto' }}><JobSearchPanel /></div>}
        </div>
      </main>
    </div>
  )
}

function JobSearchPanel() {
  const { shortlistedJobs, setActivePanel } = useStore()
  return (
    <div style={{ padding: '20px 24px', fontFamily: "'DM Sans', sans-serif", color: '#e8e6f0' }}>
      <div style={{ padding: '16px 0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600 }}>Job Search</div>
        <div style={{ fontSize: '11px', color: '#8b8a99', marginTop: '1px' }}>LinkedIn · MyCareersFuture · JobsDB · Adzuna · Indeed</div>
      </div>
      <div style={{
        background: 'rgba(124,106,245,0.07)', border: '1px solid rgba(124,106,245,0.15)',
        borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#8b8a99', fontSize: '13px', lineHeight: 1.7,
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>★</div>
        <div style={{ fontWeight: 500, color: '#e8e6f0', marginBottom: '6px' }}>Your daily matches are in Shortlisted Jobs</div>
        <div>Jobs are automatically fetched and scored against your CV every morning at 6 AM SGT.</div>
        <button
          onClick={() => setActivePanel('shortlisted')}
          style={{
            marginTop: '14px', background: '#7c6af5', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          View Shortlisted Jobs ({shortlistedJobs.filter(j => !j.actioned && !j.dismissed).length} new)
        </button>
      </div>
    </div>
  )
}
