import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JoinPublicTournamentButton } from '@/components/JoinPublicTournamentButton'
import { StandardDeckRegistration } from '@/components/StandardDeckRegistration'
import { TournamentCheckInButton } from '@/components/TournamentCheckInButton'
import { getCurrentUser } from '@/lib/auth/session'
import { getTournamentOverview, listUserStandardDecks } from '@/lib/tournaments/queries'
import { displayStatus, formatDateTime, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const overview = await getTournamentOverview(id, user?.id)
  if (!overview) notFound()
  const { tournament, participants, rounds, matches, standings, isOrganizer, isParticipant, viewerParticipant, viewerDeckList } = overview
  const activeRound = rounds.find((round) => round.status === 'active')
  const activeMatches = activeRound ? matches.filter((match) => match.roundId === activeRound.id) : []
  const registered = participants.filter((participant) => !['dropped', 'disqualified', 'waitlisted'].includes(participant.status))
  const waitlisted = participants.filter((participant) => participant.status === 'waitlisted')
  const libraryDecks = user && tournament.format === 'standard' && viewerParticipant?.status !== 'waitlisted' ? await listUserStandardDecks(user.id) : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-7">
      <section className="card overflow-hidden relative">
        <div className="absolute right-0 top-0 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`badge badge-${tournament.format}`}>{tournament.format === 'commander' && tournament.commanderMode === 'pods' ? 'Commander pods' : tournament.format}</span>
              <span className={`badge ${statusBadgeClass(tournament.status)}`}>{displayStatus(tournament.status)}</span>
              {tournament.venue && <span className="text-sm text-muted">{tournament.venue}</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">{tournament.name}</h1>
            {tournament.description && <p className="text-muted mt-3 leading-relaxed">{tournament.description}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted mt-5">
              <span>{registered.length}{tournament.capacity ? ` / ${tournament.capacity}` : ''} players{waitlisted.length ? ` · ${waitlisted.length} waitlisted` : ''}</span>
              <span>{tournament.roundCount} Swiss rounds</span>
              <span>{tournament.format === 'commander' && tournament.commanderMode === 'pods' ? `${tournament.podSize}-player tables` : `Best of ${tournament.gamesPerMatch}`}</span>
              {tournament.scheduledAt && <span>{formatDateTime(tournament.scheduledAt)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            {isOrganizer && <Link href={`/tournaments/${id}/manage`} className="btn-primary">Organizer controls</Link>}
            {!isParticipant && tournament.status === 'registration' && (user ? <JoinPublicTournamentButton tournamentId={id} /> : <Link href={`/auth/login?redirect=/tournaments/${id}`} className="btn-primary">Sign in to join</Link>)}
            {viewerParticipant?.status === 'registered' && <span className="btn-secondary cursor-default">You&apos;re registered</span>}
            {viewerParticipant?.status === 'checked_in' && <span className="btn-secondary cursor-default">You&apos;re checked in</span>}
            {viewerParticipant?.status === 'waitlisted' && <span className="btn-secondary cursor-default">You&apos;re waitlisted</span>}
            {viewerParticipant?.status === 'registered' && tournament.status === 'check_in' && <TournamentCheckInButton tournamentId={id} />}
          </div>
        </div>
      </section>

      {activeRound && (
        <section className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Now playing</p><h2 className="text-2xl font-bold mt-1">Round {activeRound.roundNumber}</h2></div>
            {activeRound.endsAt && <p className="text-sm text-muted">Round ends {formatDateTime(activeRound.endsAt)}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeMatches.map((match) => (
              <Link key={match.id} href={`/tournaments/${id}/match/${match.id}`} className="rounded-lg border border-border bg-background/40 p-4 hover:border-accent transition-colors">
                <div className="flex justify-between text-xs text-muted mb-3"><span>Table {match.tableNumber ?? '—'}</span><span className="uppercase">{match.status}</span></div>
                <div className="space-y-1">
                  {match.players.map((player) => <p key={player.userId} className="font-medium">{player.displayName} <span className="text-muted font-normal">@{player.username}</span></p>)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tournament.format === 'standard' && user && isParticipant && viewerParticipant?.status !== 'waitlisted' && (
        <StandardDeckRegistration tournamentId={id} required={tournament.deckListsRequired} existing={viewerDeckList} libraryDecks={libraryDecks} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-7">
        <section className="card">
          <h2 className="text-xl font-bold mb-5">Standings</h2>
          {standings.length === 0 ? <p className="text-muted text-sm">Standings will appear after the first result is confirmed.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-muted text-left"><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Player</th><th className="py-2 pr-3">Pts</th><th className="py-2 pr-3">Record</th><th className="py-2">OMW%</th></tr></thead><tbody>{standings.map((standing) => <tr key={standing.userId} className="border-b border-border/50"><td className="py-3 pr-3 font-mono">{standing.rank}</td><td className="py-3 pr-3"><Link href={`/profile/${standing.username}`} className="hover:text-accent">@{standing.username}</Link></td><td className="py-3 pr-3 font-bold">{standing.matchPoints}</td><td className="py-3 pr-3 font-mono">{standing.matchWins}-{standing.matchLosses}-{standing.matchDraws}</td><td className="py-3 font-mono">{(standing.opponentMatchWinPercentage * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
          )}
        </section>
        <section className="card">
          <h2 className="text-xl font-bold mb-5">Players <span className="text-muted font-normal">({registered.length})</span></h2>
          {registered.length === 0 ? <p className="text-sm text-muted">Be the first player to join.</p> : <div className="space-y-2">{registered.map((player) => <Link key={player.id} href={`/profile/${player.username}`} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 hover:bg-card-hover"><span>@{player.username}</span><span className="text-xs text-muted">{player.status.replace('_', ' ')}</span></Link>)}</div>}
          {isOrganizer && <div className="mt-5 pt-4 border-t border-border text-sm text-muted">Access key: <span className="font-mono text-accent">{tournament.accessKey}</span></div>}
        </section>
      </div>
    </div>
  )
}
