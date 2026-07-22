import Link from 'next/link'
import { requireCurrentUser } from '@/lib/auth/session'
import { listUserTournaments } from '@/lib/tournaments/queries'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function MyTournamentsPage() {
  const user = await requireCurrentUser()
  const { playing, organizing } = await listUserTournaments(user.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div className="hero-surface rise-in"><p className="page-eyebrow">Player profile</p><h1 className="page-heading">Your events</h1><p className="page-subtitle">One place to manage the events you&apos;re organizing and the tables you&apos;re joining.</p></div>
      <EventSection title="Playing" empty="You have not joined an event yet." events={playing.map((entry) => ({ ...entry.tournament, detail: entry.participantStatus }))} />
      <EventSection title="Organizing" empty="You are not organizing any events yet." events={organizing.map((entry) => ({ ...entry.tournament, detail: entry.role }))} organizer />
    </div>
  )
}

function EventSection({
  title,
  empty,
  events,
  organizer = false,
}: {
  title: string
  empty: string
  events: Array<{ id: string; name: string; format: string; status: string; roundCount: number; detail: string }>
  organizer?: boolean
}) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {events.length === 0 ? (
        <div className="card text-muted text-center py-9">{empty}</div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="card interactive-card flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <Link href={`/tournaments/${event.id}`} className="min-w-0">
                <div className="flex flex-wrap gap-2 mb-2"><span className={`badge badge-${event.format}`}>{event.format}</span><span className={`badge ${statusBadgeClass(event.status)}`}>{displayStatus(event.status)}</span></div>
                <h3 className="font-bold text-lg truncate">{event.name}</h3>
                <p className="text-sm text-muted mt-1">{event.roundCount} rounds · {event.detail}</p>
              </Link>
              {organizer && <Link href={`/tournaments/${event.id}/manage`} className="btn-secondary shrink-0">Manage</Link>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
