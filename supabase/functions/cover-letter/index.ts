// supabase/functions/cover-letter/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { jobTitle, company, jobDescription, cvContent, userProfile, tone = 'confident' } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

    const experience = cvContent?.experience?.slice(0, 3).map((e: any) =>
      `${e.title} at ${e.company} (${e.start_date}–${e.end_date || 'Present'}): ${e.achievements?.slice(0, 2).join('; ')}`
    ).join('\n') || ''

    const prompt = `You are an expert career coach writing a cover letter for a senior professional.

ROLE: ${jobTitle} at ${company}
CANDIDATE: ${userProfile?.full_name || 'The candidate'}
HEADLINE: ${userProfile?.cv_headline || 'Senior Professional'}
TONE: ${tone}

JOB DESCRIPTION:
${jobDescription?.slice(0, 1500) || 'Not provided'}

CANDIDATE EXPERIENCE (top 3 roles):
${experience}

KEY SKILLS: ${(userProfile?.cv_skills || cvContent?.skills || []).slice(0, 8).join(', ')}

Write a compelling, personalised cover letter that:
1. Opens with a strong hook specific to ${company}
2. Connects candidate's experience directly to the role requirements
3. Includes 2-3 specific quantified achievements
4. Shows genuine knowledge of ${company}'s business
5. Closes with a confident call to action
6. Is 3-4 paragraphs, max 350 words
7. Sounds human and ${tone}, not generic AI

Return ONLY the cover letter text, no subject line, no JSON, no markdown.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await res.json()
    const coverLetter = data.content[0].text.trim()

    return new Response(JSON.stringify({ cover_letter: coverLetter }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
