// supabase/functions/parse-cv/index.ts
// Deploy: supabase functions deploy parse-cv

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { fileUrl, fileText } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

    const prompt = `You are a professional CV parser. Extract all information from this CV and return a structured JSON object.

${fileText ? `CV TEXT:\n${fileText}` : `CV URL: ${fileUrl}`}

Return ONLY a JSON object with this exact structure:
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "summary": "professional summary or objective",
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "start_date": "MMM YYYY",
      "end_date": "MMM YYYY or Present",
      "location": "city, country",
      "description": "role description",
      "achievements": ["achievement 1 with numbers", "achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "university name",
      "degree": "degree type",
      "field": "field of study",
      "year": "graduation year"
    }
  ],
  "skills": ["skill1", "skill2"],
  "certifications": ["cert1"],
  "languages": ["English", "Mandarin"]
}

Be thorough. Preserve all original content exactly. Output ONLY the JSON, no markdown.`

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
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await res.json()
    const text = data.content[0].text.replace(/```json|```/g, '').trim()
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
