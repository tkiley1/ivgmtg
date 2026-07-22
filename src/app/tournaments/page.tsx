import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { listPublicTournaments } from '@/lib/tournaments/queries'
import { displayStatus, formatDateTime, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TournamentsPage() {
  const [user, tournaments] = await Promise.all([getCurrentUser(), listPublicTournaments()])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="hero-surface rise-in flex flex-col sm:flex-row gap-4 sm:items-end justify-between mb-9">
        <div>
          <p className="page-eyebrow"><span className="status-dot" />Event directory</p>
          <h1 className="page-heading">Find your next table.</h1>
          <p className="page-subtitle">Public Magic events, from draft night to multiplayer Commander pods.</p>
        </div>
        <Link href={user ? '/tournaments/create' : '/auth/register'} className="btn-primary">Create an event</Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="card text-center py-16"><p className="font-semibold">No public events found.</p><p className="text-sm text-muted mt-2">Create the first one and invite your playgroup.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tournaments.map((event) => (
            <Link key={event.id} href={`/tournaments/${event.id}`} className="event-card interactive-card group">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className={`badge badge-${event.format}`}>{event.format === 'commander' && event.commanderMode === 'pods' ? 'Commander pods' : event.format}</span>
                <span className={`badge ${statusBadgeClass(event.status)}`}>{displayStatus(event.status)}</span>
              </div>
              <h2 className="font-bold text-lg group-hover:text-accent transition-colors">{event.name}</h2>
              {event.description && <p className="text-sm text-muted mt-2 line-clamp-2 min-h-10">{event.description}</p>}
              <div className="event-card__footer text-xs text-muted grid grid-cols-2 gap-2">
                <span>{event.roundCount} Swiss rounds</span>
                <span>{event.venue || 'Online / venue TBA'}</span>
                {event.scheduledAt && <span className="col-span-2">{formatDateTime(event.scheduledAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
