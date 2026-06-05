// supabase/functions/screenshot-ocr/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageUrl, imageBase64, mediaType } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

    const imageContent = imageBase64
      ? { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
      : { type: 'url', url: imageUrl }

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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: imageContent
            },
            {
              type: 'text',
              text: `This is a screenshot of an interview confirmation message (from WhatsApp, email, LinkedIn, or similar).

Extract all interview details and return ONLY a JSON object:
{
  "company": "company name",
  "role": "job title / role",
  "date": "YYYY-MM-DD format",
  "time": "HH:MM in 24h format, Singapore time",
  "format": "Video Call | Phone | In-Person | Take-Home",
  "interviewer": "interviewer name and title if mentioned",
  "meeting_link": "zoom/teams/google meet link if present",
  "notes": "any other relevant details",
  "confidence": "high | medium | low"
}

If a field is not found, use null. Output ONLY the JSON.`
            }
          ]
        }]
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
