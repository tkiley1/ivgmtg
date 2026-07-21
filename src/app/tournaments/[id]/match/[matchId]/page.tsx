import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MatchResultForm } from '@/components/MatchResultForm'
import { getCurrentUser } from '@/lib/auth/session'
import { getTournamentOverview } from '@/lib/tournaments/queries'

export const dynamic = 'force-dynamic'

export default async function MatchPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id, matchId } = await params
  const user = await getCurrentUser()
  const overview = await getTournamentOverview(id, user?.id)
  const match = overview?.matches.find((entry) => entry.id === matchId)
  if (!overview || !match) notFound()
  const isPlayer = Boolean(user && match.players.some((player) => player.userId === user.id))

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href={`/tournaments/${id}`} className="text-sm text-muted hover:text-foreground">← Back to event</Link>
      <section className="card mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Table {match.tableNumber ?? '—'}</p>
        <h1 className="text-3xl font-bold mt-2">{match.kind === 'commander_pod' ? 'Commander pod' : 'Match result'}</h1>
        <div className="my-7 space-y-3">{match.players.map((player) => <div key={player.userId} className="rounded-lg border border-border bg-background/40 p-4 flex justify-between"><span className="font-medium">{player.displayName}</span><span className="text-muted">@{player.username}</span></div>)}</div>
        <MatchResultForm tournamentId={id} matchId={matchId} kind={match.kind} players={match.players} canReport={Boolean(user && (isPlayer || overview.isOrganizer))} status={match.status} />
      </section>
    </div>
  )
}
