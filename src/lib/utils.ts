export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
  })
}

const statusLabels: Record<string, string> = {
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
  if (status === 'pending') return 'badge-scheduled'
  return `badge-${status}`
}
