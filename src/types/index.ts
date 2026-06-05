// ═══════════════════════════════════════════════════════
//  JobScout Types
// ═══════════════════════════════════════════════════════

export type ApplicationStage = 'wishlist' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn'
export type CVType = 'base' | 'tailored' | 'best_practice'
export type JobSource = 'adzuna' | 'mcf' | 'jobsdb' | 'linkedin' | 'indeed' | 'manual'
export type ApplyLevel = 1 | 2 | 3
export type InterviewStage = 'Phone Screen' | 'Recruiter Screen' | 'Technical Round' | 'Case Study' | 'Panel Interview' | 'Final Round' | 'Culture Fit'
export type InterviewFormat = 'Video Call' | 'Phone' | 'In-Person' | 'Take-Home'
export type SalarySource = 'glassdoor' | 'linkedin' | 'mom' | 'levels_fyi' | 'claude_estimate'
export type Confidence = 'high' | 'medium' | 'low'
export type Seniority = 'junior' | 'mid' | 'senior' | 'director' | 'vp' | 'c-suite'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  cv_headline?: string
  cv_target_roles: string[]
  cv_skills: string[]
  cv_locations: string[]
  cv_industries: string[]
  salary_current?: number
  salary_min?: number
  salary_max?: number
  salary_ask?: number
  notify_daily_digest: boolean
  notify_new_matches: boolean
  digest_time: string
  job_search_queries: string[]
  created_at: string
  updated_at: string
}

export interface CVFile {
  id: string
  user_id: string
  type: CVType
  label?: string
  file_url?: string
  file_name?: string
  parsed_content?: CVParsedContent
  job_id?: string
  is_base: boolean
  created_at: string
}

export interface CVParsedContent {
  name?: string
  email?: string
  phone?: string
  summary?: string
  experience: CVExperience[]
  education: CVEducation[]
  skills: string[]
  certifications?: string[]
  languages?: string[]
  raw_text?: string
}

export interface CVExperience {
  company: string
  title: string
  start_date: string
  end_date?: string
  location?: string
  description: string
  achievements: string[]
}

export interface CVEducation {
  institution: string
  degree: string
  field?: string
  year?: string
}

export interface Job {
  id: string
  external_id?: string
  source: JobSource
  title: string
  company: string
  location: string
  description?: string
  url?: string
  salary_min?: number
  salary_max?: number
  salary_currency: string
  tags: string[]
  posted_at?: string
  fetched_at: string
}

export interface ShortlistedJob {
  id: string
  user_id: string
  job_id: string
  job: Job
  match_score: number
  match_reasons: string[]
  batch_date: string
  dismissed: boolean
  actioned: boolean
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  job_id?: string
  job?: Job
  company: string
  role: string
  job_url?: string
  notes?: string
  stage: ApplicationStage
  match_score?: number
  cv_file_id?: string
  cover_letter?: string
  apply_level?: ApplyLevel
  applied_at?: string
  applied_via?: string
  date_saved: string
  created_at: string
  updated_at: string
}

export interface Interview {
  id: string
  user_id: string
  application_id?: string
  company: string
  role: string
  interview_date?: string
  interview_time?: string
  stage: InterviewStage
  format: InterviewFormat
  interviewer?: string
  notes?: string
  gcal_event_id?: string
  reminder_sent: boolean
  screenshot_url?: string
  created_at: string
}

export interface Research {
  id: string
  user_id: string
  interview_id?: string
  company: string
  role: string
  company_overview?: string
  company_recent?: string
  role_breakdown?: string
  role_looking_for?: string
  domain_context?: string
  interview_questions?: string
  talking_points?: string
  salary_intel?: string
  generated_at: string
}

export interface SalaryIntel {
  id: string
  role_title: string
  company?: string
  location: string
  seniority: Seniority
  salary_min: number
  salary_max: number
  salary_median: number
  currency: string
  source: SalarySource
  confidence: Confidence
  last_updated: string
}

export interface DashboardStats {
  applied: number
  interviewing: number
  newMatches: number
  responseRate: number
  offers: number
}

export interface ApplyAction {
  level: ApplyLevel
  jobId: string
  applicationId?: string
}

export interface ScreenshotParseResult {
  company?: string
  role?: string
  date?: string
  time?: string
  format?: string
  interviewer?: string
  notes?: string
  confidence: Confidence
}

export interface CoverLetterRequest {
  jobTitle: string
  company: string
  jobDescription: string
  cvContent: CVParsedContent
  userProfile: Profile
  tone?: 'formal' | 'conversational' | 'confident'
}

export interface ResearchRequest {
  company: string
  role: string
  interviewDate?: string
  interviewStage?: string
  userProfile: Profile
  cvContent?: CVParsedContent
}
