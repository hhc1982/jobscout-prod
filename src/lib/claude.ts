// ═══════════════════════════════════════════════════════
//  JobScout — Claude AI Service
//  All AI calls go through Supabase Edge Functions
//  so the API key is never exposed in the browser
// ═══════════════════════════════════════════════════════

import { supabase } from './supabase'
import type {
  CVParsedContent, Profile, ResearchRequest,
  CoverLetterRequest, ScreenshotParseResult, Research
} from '../types'

// ── CV Parsing ────────────────────────────────────────────────

export const parseCV = async (fileUrl: string, fileText?: string): Promise<CVParsedContent> => {
  const { data, error } = await supabase.functions.invoke('parse-cv', {
    body: { fileUrl, fileText }
  })
  if (error) throw error
  return data
}

// ── Job Scoring ───────────────────────────────────────────────

export const scoreJobs = async (
  jobs: any[],
  profile: Profile,
  cvContent?: CVParsedContent
): Promise<Array<{ jobId: string; score: number; reasons: string[] }>> => {
  const { data, error } = await supabase.functions.invoke('score-jobs', {
    body: { jobs, profile, cvContent }
  })
  if (error) throw error
  return data
}

// ── Interview Research ────────────────────────────────────────

export const generateResearch = async (req: ResearchRequest): Promise<Research> => {
  const { data, error } = await supabase.functions.invoke('research', {
    body: req
  })
  if (error) throw error
  return data
}

// ── Cover Letter ──────────────────────────────────────────────

export const generateCoverLetter = async (req: CoverLetterRequest): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('cover-letter', {
    body: req
  })
  if (error) throw error
  return data.cover_letter
}

// ── CV Best Practice Suggestions ─────────────────────────────

export const generateBestPracticeCV = async (
  cvContent: CVParsedContent,
  profile: Profile
): Promise<{ sections: BestPracticeSuggestion[]; overall_score: number; summary: string }> => {
  const { data, error } = await supabase.functions.invoke('best-practice-cv', {
    body: { cvContent, profile }
  })
  if (error) throw error
  return data
}

export interface BestPracticeSuggestion {
  section: string
  original: string
  suggested: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

// ── Tailored CV ───────────────────────────────────────────────

export const generateTailoredCV = async (
  cvContent: CVParsedContent,
  jobTitle: string,
  company: string,
  jobDescription: string
): Promise<CVParsedContent> => {
  const { data, error } = await supabase.functions.invoke('tailor-cv', {
    body: { cvContent, jobTitle, company, jobDescription }
  })
  if (error) throw error
  return data
}

// ── Screenshot OCR → Calendar ─────────────────────────────────

export const parseScreenshot = async (imageUrl: string): Promise<ScreenshotParseResult> => {
  const { data, error } = await supabase.functions.invoke('screenshot-ocr', {
    body: { imageUrl }
  })
  if (error) throw error
  return data
}

// ── Salary Intelligence ───────────────────────────────────────

export const getSalaryIntel = async (
  role: string,
  company: string,
  location: string = 'Singapore'
): Promise<{ min: number; max: number; median: number; source: string; confidence: string; context: string }> => {
  const { data, error } = await supabase.functions.invoke('salary-intel', {
    body: { role, company, location }
  })
  if (error) throw error
  return data
}
