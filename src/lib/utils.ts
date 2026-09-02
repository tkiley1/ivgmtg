export function formatDateTime(date: string | Date, timeZone = 'America/New_York'): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(date: string | Date, timeZone = 'America/New_York'): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone,
    dateStyle: 'medium',
  })
}

function dateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

export function localDateTimeInZone(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error('Choose a valid start date and time.')
  const [, year, month, day, hour, minute] = match.map(Number)
  const intendedUtc = Date.UTC(year, month - 1, day, hour, minute)
  const offsetAt = (instant: Date) => {
    const parts = dateTimeParts(instant, timeZone)
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime()
  }
  const firstGuess = new Date(intendedUtc)
  const secondGuess = new Date(intendedUtc - offsetAt(firstGuess))
  const result = new Date(intendedUtc - offsetAt(secondGuess))
  const resolved = dateTimeParts(result, timeZone)
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day || resolved.hour !== hour || resolved.minute !== minute) {
    throw new Error('That local time does not exist in the selected time zone.')
  }
  return result
}

const statusLabels: Record<string, string> = {
  draft: 'draft',
  registration: 'registration open',
  check_in: 'check-in',
  pending: 'scheduled',
  active: 'active',
  round_active: 'round active',
  between_rounds: 'between rounds',
  top_cut: 'top cut',
  completed: 'completed',
  cancelled: 'cancelled',
}

export function displayStatus(status: string): string {
  return statusLabels[status] ?? status
}

export function statusBadgeClass(status: string): string {
  if (status === 'registration' || status === 'check_in' || status === 'draft') return 'badge-scheduled'
  if (status === 'pending') return 'badge-scheduled'
  return `badge-${status}`
}
