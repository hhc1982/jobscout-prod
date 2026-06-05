// supabase/functions/daily-crawl/index.ts
// Schedule: every day at 6am SGT (10pm UTC)
// Set in Supabase Dashboard → Edge Functions → Schedule
// Cron: 0 22 * * *

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const ADZUNA_APP_ID = Deno.env.get('ADZUNA_APP_ID')!
  const ADZUNA_APP_KEY = Deno.env.get('ADZUNA_APP_KEY')!
  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!

  const results = { users: 0, jobs_fetched: 0, jobs_scored: 0, emails_sent: 0, errors: [] as string[] }

  try {
    // 1. Fetch all active users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('subscription_status', ['trial', 'active'])
      .eq('notify_daily_digest', true)

    if (!profiles?.length) {
      return new Response(JSON.stringify({ message: 'No active users', results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    results.users = profiles.length

    // 2. Fetch jobs from Adzuna (Singapore)
    const queries = ['VP Sales technology Singapore', 'General Manager SaaS Singapore',
      'Regional Director software Singapore', 'Country Manager tech Singapore',
      'Head of Sales enterprise Singapore', 'Chief Revenue Officer Singapore']

    const fetchedJobs: any[] = []
    const seenIds = new Set<string>()

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          app_id: ADZUNA_APP_ID,
          app_key: ADZUNA_APP_KEY,
          results_per_page: '10',
          what: query,
          where: 'Singapore',
        })
        const url = `https://api.adzuna.com/v1/api/jobs/sg/search/1?${params}`
        const res = await fetch(url, { headers: { 'User-Agent': 'JobScout/1.0' } })
        if (!res.ok) continue
        const data = await res.json()
        for (const job of (data.results || [])) {
          if (!seenIds.has(job.id)) {
            seenIds.add(job.id)
            fetchedJobs.push(job)
          }
        }
      } catch (e) { results.errors.push(`Adzuna query failed: ${query}`) }
    }

    // 3. Fetch from MyCareersFuture API
    try {
      const mcfQueries = ['VP Sales', 'General Manager', 'Regional Director', 'Head of Sales']
      for (const q of mcfQueries) {
        const res = await fetch(
          `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(q)}&limit=10`,
          { headers: { 'Accept': 'application/json' } }
        )
        if (!res.ok) continue
        const data = await res.json()
        for (const job of (data.results || [])) {
          const id = `mcf_${job.uuid}`
          if (!seenIds.has(id)) {
            seenIds.add(id)
            fetchedJobs.push({
              id, source: 'mcf',
              title: job.title,
              company: job.postedCompany?.name,
              location: 'Singapore',
              description: job.description,
              url: `https://www.mycareersfuture.gov.sg/job/${job.uuid}`,
              salary_min: job.salary?.minimum,
              salary_max: job.salary?.maximum,
            })
          }
        }
      }
    } catch (e) { results.errors.push('MCF fetch failed') }

    results.jobs_fetched = fetchedJobs.length

    // 4. Upsert jobs to DB
    const jobsToInsert = fetchedJobs.map(j => ({
      external_id: String(j.id),
      source: j.source || 'adzuna',
      title: j.title || j.__CLASS__,
      company: j.company?.display_name || j.company || 'Unknown',
      location: j.location?.display_name || j.location || 'Singapore',
      description: (j.description || '').slice(0, 5000),
      url: j.redirect_url || j.url || '',
      salary_min: j.salary_min || j.salary?.minimum || null,
      salary_max: j.salary_max || j.salary?.maximum || null,
      tags: j.category ? [j.category.label] : [],
      posted_at: j.created || null,
    }))

    if (jobsToInsert.length) {
      await supabase.from('jobs').upsert(jobsToInsert, { onConflict: 'external_id,source', ignoreDuplicates: true })
    }

    // 5. Score jobs for each user using Claude
    for (const profile of profiles) {
      try {
        const scorePrompt = `Score these ${fetchedJobs.length} jobs for a candidate.

Candidate profile:
- Target roles: ${(profile.cv_target_roles || []).join(', ')}
- Skills: ${(profile.cv_skills || []).join(', ')}
- Locations: ${(profile.cv_locations || []).join(', ')}
- Industries: ${(profile.cv_industries || []).join(', ')}
- Salary target: SGD ${profile.salary_min?.toLocaleString() || 'N/A'} – ${profile.salary_max?.toLocaleString() || 'N/A'}

Jobs (JSON array):
${JSON.stringify(fetchedJobs.slice(0, 30).map(j => ({
  id: j.id,
  title: j.title || j.__CLASS__,
  company: j.company?.display_name || j.company,
  description: (j.description || '').slice(0, 300),
  salary_min: j.salary_min,
  salary_max: j.salary_max,
})))}

Return ONLY a JSON array of the top 10 matches:
[{"job_id": "id", "score": 85, "reasons": ["reason1", "reason2"]}]
Sorted by score descending. Output ONLY the JSON array.`

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', // cheaper model for bulk scoring
            max_tokens: 1000,
            messages: [{ role: 'user', content: scorePrompt }]
          })
        })

        const aiData = await aiRes.json()
        const scored = JSON.parse(aiData.content[0].text.replace(/```json|```/g, '').trim())
        results.jobs_scored += scored.length

        // Get DB job IDs
        const externalIds = scored.map((s: any) => String(s.job_id))
        const { data: dbJobs } = await supabase
          .from('jobs')
          .select('id, external_id')
          .in('external_id', externalIds)

        const idMap = new Map(dbJobs?.map(j => [j.external_id, j.id]) || [])

        // Insert shortlisted jobs
        const shortlisted = scored
          .filter((s: any) => idMap.has(String(s.job_id)) && s.score >= 60)
          .map((s: any) => ({
            user_id: profile.id,
            job_id: idMap.get(String(s.job_id)),
            match_score: s.score,
            match_reasons: s.reasons || [],
            batch_date: new Date().toISOString().slice(0, 10),
          }))

        if (shortlisted.length) {
          await supabase.from('shortlisted_jobs')
            .upsert(shortlisted, { onConflict: 'user_id,job_id,batch_date', ignoreDuplicates: true })
        }

        // 6. Send daily digest email
        if (profile.email && RESEND_KEY && shortlisted.length > 0) {
          const jobDetails = fetchedJobs
            .filter(j => externalIds.slice(0, 5).includes(String(j.id)))
            .slice(0, 5)

          const emailHtml = buildDigestEmail(profile, jobDetails, scored)

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: Deno.env.get('DIGEST_FROM_EMAIL') || 'digest@jobscout.app',
              to: profile.email,
              subject: `✦ ${shortlisted.length} new jobs matched your profile today`,
              html: emailHtml,
            })
          })

          await supabase.from('digest_log').insert({
            user_id: profile.id,
            job_count: shortlisted.length,
          })

          results.emails_sent++
        }
      } catch (e: any) {
        results.errors.push(`User ${profile.id} scoring failed: ${e.message}`)
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, results }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildDigestEmail(profile: any, jobs: any[], scored: any[]): string {
  const scoreMap = new Map(scored.map((s: any) => [String(s.job_id), s.score]))
  const today = new Date().toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const name = profile.full_name?.split(' ')[0] || 'there'

  const cards = jobs.map(j => {
    const score = scoreMap.get(String(j.id)) || 75
    const company = j.company?.display_name || j.company || 'Company'
    const title = j.title || 'Role'
    const loc = j.location?.display_name || j.location || 'Singapore'
    const url = j.redirect_url || j.url || '#'
    const sal = j.salary_min && j.salary_max
      ? `SGD ${j.salary_min.toLocaleString()} – ${j.salary_max.toLocaleString()}`
      : ''
    return `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${title}</p>
          <p style="margin:3px 0 0;font-size:12px;color:#6b7280;">🏢 ${company} &nbsp;·&nbsp; 📍 ${loc}</p>
          ${sal ? `<p style="margin:3px 0 0;font-size:12px;color:#059669;">💰 ${sal}</p>` : ''}
        </div>
        <span style="background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${score}% match</span>
      </div>
      <a href="${url}" style="display:inline-block;margin-top:12px;background:#7c6af5;color:#fff;font-size:12px;padding:7px 16px;border-radius:6px;text-decoration:none;">View & Apply →</a>
    </div>`
  }).join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif;">
  <div style="max-width:600px;margin:28px auto;padding:0 16px 28px;">
    <div style="background:#7c6af5;border-radius:10px 10px 0 0;padding:22px 26px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">JobScout Daily Digest</h1>
      <p style="margin:5px 0 0;color:#c4b5fd;font-size:12px;">${today}</p>
    </div>
    <div style="background:#fff;border-radius:0 0 10px 10px;padding:22px 26px;">
      <p style="font-size:14px;color:#374151;margin-bottom:18px;">Good morning ${name}, here are your top matches today:</p>
      ${cards}
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px;">
        <a href="${Deno.env.get('VITE_APP_URL') || 'https://jobscout.app'}" style="color:#7c6af5;">Open JobScout</a> to view all matches and track applications
      </p>
    </div>
  </div></body></html>`
}
