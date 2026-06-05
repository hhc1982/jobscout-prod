import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Application, Interview, ShortlistedJob, CVFile } from '../types'

interface AppStore {
  // Auth
  user: { id: string; email: string } | null
  profile: Profile | null
  setUser: (user: AppStore['user']) => void
  setProfile: (profile: Profile | null) => void

  // Data
  applications: Application[]
  interviews: Interview[]
  shortlistedJobs: ShortlistedJob[]
  cvFiles: CVFile[]
  setApplications: (apps: Application[]) => void
  setInterviews: (interviews: Interview[]) => void
  setShortlistedJobs: (jobs: ShortlistedJob[]) => void
  setCVFiles: (files: CVFile[]) => void

  // UI
  activePanel: string
  setActivePanel: (panel: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Actions
  addApplication: (app: Application) => void
  updateApplication: (id: string, updates: Partial<Application>) => void
  addInterview: (interview: Interview) => void
  dismissShortlisted: (id: string) => void
  actionShortlisted: (id: string) => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),

      applications: [],
      interviews: [],
      shortlistedJobs: [],
      cvFiles: [],
      setApplications: (applications) => set({ applications }),
      setInterviews: (interviews) => set({ interviews }),
      setShortlistedJobs: (shortlistedJobs) => set({ shortlistedJobs }),
      setCVFiles: (cvFiles) => set({ cvFiles }),

      activePanel: 'dashboard',
      setActivePanel: (activePanel) => set({ activePanel }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),

      addApplication: (app) => set((s) => ({ applications: [app, ...s.applications] })),
      updateApplication: (id, updates) => set((s) => ({
        applications: s.applications.map(a => a.id === id ? { ...a, ...updates } : a)
      })),
      addInterview: (interview) => set((s) => ({ interviews: [interview, ...s.interviews] })),
      dismissShortlisted: (id) => set((s) => ({
        shortlistedJobs: s.shortlistedJobs.map(j => j.id === id ? { ...j, dismissed: true } : j)
      })),
      actionShortlisted: (id) => set((s) => ({
        shortlistedJobs: s.shortlistedJobs.map(j => j.id === id ? { ...j, actioned: true } : j)
      })),
    }),
    {
      name: 'jobscout-store',
      partialize: (s) => ({ activePanel: s.activePanel }),
    }
  )
)
