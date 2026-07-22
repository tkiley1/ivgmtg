import Link from 'next/link'
import { requireCurrentUser } from '@/lib/auth/session'
import { ResendVerificationForm } from '@/components/AuthStatusForm'
import { listPublicTournaments } from '@/lib/tournaments/queries'
import { displayStatus, formatDateTime, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const tournaments = await listPublicTournaments(12)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {!user.emailVerifiedAt && <section className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-warning">Verify your email address</p><p className="text-sm text-muted">Account recovery and organizer communications depend on a verified address.</p></div><ResendVerificationForm compact /></section>}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Welcome back, {user.username}</p>
          <h1 className="text-3xl sm:text-4xl font-bold mt-2">Your table is ready.</h1>
          <p className="text-muted mt-2">Create an event, find a seat, or pick up where the last round left off.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/tournaments/create" className="btn-primary">Create an event</Link>
          <Link href="/tournaments/join" className="btn-secondary">Join with key</Link>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold">Events to join</h2>
          <Link href="/tournaments" className="text-sm text-accent hover:underline">Browse all</Link>
        </div>
        {tournaments.length === 0 ? (
          <div className="card text-center py-14"><p className="font-medium">No public events yet.</p><p className="text-sm text-muted mt-2">Be the organizer who starts the next one.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tournaments.map((event) => (
              <Link key={event.id} href={`/tournaments/${event.id}`} className="card group hover:-translate-y-0.5 transition-transform">
                <div className="flex justify-between gap-3 mb-4">
                  <span className={`badge badge-${event.format}`}>{event.format === 'commander' && event.commanderMode === 'pods' ? 'Commander pods' : event.format}</span>
                  <span className={`badge ${statusBadgeClass(event.status)}`}>{displayStatus(event.status)}</span>
                </div>
                <h3 className="font-bold text-lg group-hover:text-accent transition-colors">{event.name}</h3>
                <p className="text-sm text-muted mt-2 line-clamp-2 min-h-10">{event.description || 'Tournament details coming from the organizer.'}</p>
                <div className="pt-4 mt-4 border-t border-border text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
                  <span>{event.roundCount} rounds</span>
                  <span>{event.format === 'commander' && event.commanderMode === 'pods' ? `${event.podSize}-player pods` : `Best of ${event.gamesPerMatch}`}</span>
                  {event.scheduledAt && <span>{formatDateTime(event.scheduledAt)}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
