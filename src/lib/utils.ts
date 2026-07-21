export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
  })
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
