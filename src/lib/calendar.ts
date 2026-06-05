import type { Interview } from '../types'

// Creates a Google Calendar event URL (deep link — no OAuth needed)
export const buildGCalUrl = (interview: Interview): string => {
  const title = encodeURIComponent(`Interview: ${interview.role} @ ${interview.company}`)

  const dateStr = interview.interview_date?.replace(/-/g, '') || ''
  const timeStr = interview.interview_time?.replace(':', '') + '00' || '100000'
  const endTime = (parseInt(timeStr) + 10000).toString().padStart(6, '0')

  const details = encodeURIComponent(
    [
      `Stage: ${interview.stage}`,
      `Format: ${interview.format}`,
      interview.interviewer ? `Interviewer: ${interview.interviewer}` : '',
      interview.notes ? `Notes: ${interview.notes}` : '',
      '',
      'Added via JobScout – AI Job Tracker',
    ].filter(Boolean).join('\n')
  )

  const location = encodeURIComponent(
    interview.format === 'In-Person' ? interview.notes || 'TBC' : interview.format || ''
  )

  return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${dateStr}T${timeStr}/${dateStr}T${endTime}` +
    `&details=${details}` +
    `&location=${location}` +
    `&sf=true&output=xml`
}

// Opens GCal in a new tab
export const addToGoogleCalendar = (interview: Interview): void => {
  window.open(buildGCalUrl(interview), '_blank')
}

// Builds a reminder URL with a 1-day-before reminder
export const buildGCalUrlWithReminder = (interview: Interview): string => {
  return buildGCalUrl(interview) + '&crm=ALERT&crt=1440' // 1440 mins = 24 hours before
}

// Format interview date/time for display
export const formatInterviewDateTime = (date?: string, time?: string): string => {
  if (!date) return 'Date TBC'
  const d = new Date(`${date}T${time || '00:00'}`)
  return d.toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }) + (time ? ` · ${time}` : '')
}
