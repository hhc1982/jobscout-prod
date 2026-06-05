// supabase/functions/research/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company, role, interviewStage, userProfile, cvContent } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

    const candidateBg = userProfile ? `
Candidate: ${userProfile.full_name}
Headline: ${userProfile.cv_headline || 'Senior Professional'}
Skills: ${(userProfile.cv_skills || []).join(', ')}
Target salary: SGD ${userProfile.salary_min?.toLocaleString() || 'N/A'} – ${userProfile.salary_max?.toLocaleString() || 'N/A'}
Ask salary: SGD ${userProfile.salary_ask?.toLocaleString() || 'N/A'}
` : ''

    const prompt = `You are a world-class executive career coach preparing a senior professional for a job interview.

Company: ${company}
Role: ${role}
Interview stage: ${interviewStage || 'Not specified'}
${candidateBg}

Generate comprehensive interview preparation materials. Return ONLY a JSON object:
{
  "company_overview": "3-4 paragraphs: founding, business model, scale, revenue, headcount, Singapore/APAC presence, key products",
  "company_recent": "5-6 bullet points of recent news/developments in last 12 months. Each bullet starts with • and includes date",
  "role_breakdown": "Detailed breakdown: day-to-day responsibilities, team structure, reporting line, key deliverables, 90-day expectations",
  "role_looking_for": "6-7 specific things hiring manager wants. Each point starts with ✦ and is bolded",
  "domain_context": "Industry dynamics, market size, competitors, key trends, buyer personas, Singapore/APAC context",
  "interview_questions": "8 likely questions numbered 1-8. Bold each question. Include behavioural, situational, and technical",
  "talking_points": "6 specific story angles the candidate should prepare based on their background. Each starts with ✦",
  "salary_intel": "Market salary range for this role in Singapore based on public data. Include: typical range, what affects it, negotiation tips, whether candidate's ask is positioned well"
}

Be highly specific to ${company} and ${role}. Reference real facts about the company. Output ONLY JSON.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await res.json()
    const textBlock = data.content.find((b: any) => b.type === 'text')
    const text = textBlock?.text?.replace(/```json|```/g, '').trim() || '{}'
    const parsed = JSON.parse(text)

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
