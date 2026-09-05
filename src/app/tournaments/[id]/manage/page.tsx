import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { OrganizerRoundControls } from '@/components/OrganizerRoundControls'
import { OrganizerEventSettings } from '@/components/OrganizerEventSettings'
import { PairingRepairForm } from '@/components/PairingRepairForm'
import { ParticipantAdminList } from '@/components/ParticipantAdminList'
import { LiveTournamentRefresh } from '@/components/LiveTournamentRefresh'
import { RoundTimer } from '@/components/RoundTimer'
import { requireCurrentUser } from '@/lib/auth/session'
import { getTournamentOverview } from '@/lib/tournaments/queries'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ManageTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireCurrentUser()
  const overview = await getTournamentOverview(id, user.id)
  if (!overview) notFound()
  if (!overview.isOrganizer) redirect(`/tournaments/${id}`)

  const { tournament, participants, rounds, matches } = overview
  const activeRound = rounds.find((round) => round.status === 'active')
  const activeMatches = activeRound ? matches.filter((match) => match.roundId === activeRound.id) : []
  const pendingMatches = activeMatches.filter((match) => match.status !== 'complete')
  const completedRounds = rounds.filter((round) => round.status === 'completed' && !round.isTopCut).length
  const checkedIn = participants.filter((player) => player.status === 'checked_in').length
  const waitlisted = participants.filter((player) => player.status === 'waitlisted').length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-7">
      <LiveTournamentRefresh enabled={Boolean(activeRound || ['seating', 'drafting', 'deck_building'].includes(tournament.draftStatus))} />
      <div className="flex items-center justify-between gap-4">
        <div><Link href={`/tournaments/${id}`} className="text-sm text-muted hover:text-foreground">← Back to event</Link><h1 className="text-3xl font-bold mt-3">Organizer controls</h1></div>
        <span className={`badge ${statusBadgeClass(tournament.status)}`}>{displayStatus(tournament.status)}</span>
      </div>

      <section className="card">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Round control</p>
        <h2 className="text-2xl font-bold mt-2 mb-2">{tournament.name}</h2>
        <p className="text-muted mb-5">{participants.filter((player) => player.status === 'active' || player.status === 'registered' || player.status === 'checked_in').length} registered · {checkedIn} checked in · {waitlisted} waitlisted · {completedRounds} / {tournament.roundCount} Swiss rounds complete</p>
        <OrganizerRoundControls tournamentId={id} hasActiveRound={Boolean(activeRound)} completedRounds={completedRounds} roundCount={tournament.roundCount} status={tournament.status} hasWaitlist={waitlisted > 0} draftReadyForPairings={tournament.format !== 'draft' || ['deck_building', 'complete'].includes(tournament.draftStatus)} />
        {activeRound?.endsAt && <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-background/40 p-4"><span className="text-sm text-muted">Round time remaining</span><RoundTimer endsAt={activeRound.endsAt.toISOString()} /></div>}
      </section>

      {activeRound && <section className="card">
        <div className="flex justify-between gap-4 mb-5"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Round {activeRound.roundNumber}</p><h2 className="text-xl font-bold mt-1">{pendingMatches.length ? `${pendingMatches.length} result${pendingMatches.length === 1 ? '' : 's'} remaining` : 'All results are in'}</h2></div><span className="text-sm text-muted">{activeMatches.length} tables</span></div>
        <div className="space-y-2">{activeMatches.map((match) => <Link key={match.id} href={`/tournaments/${id}/match/${match.id}`} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3 hover:border-accent"><span>{match.players.map((player) => player.username ? `@${player.username}` : player.displayName).join(' · ')}</span><span className="text-sm text-muted uppercase">{match.status}</span></Link>)}</div>
        <PairingRepairForm tournamentId={id} players={activeMatches.flatMap((match) => match.players.map((player) => ({ id: player.id, tableNumber: match.tableNumber, displayName: player.displayName })))} />
      </section>}

      {!activeRound && <ParticipantAdminList tournamentId={id} participants={participants} />}

      <OrganizerEventSettings tournament={tournament} />

      <section className="card"><h2 className="text-xl font-bold mb-2">Event operations</h2><p className="text-sm text-muted">Open check-in when you are ready. Checked-in players are the only players paired when the first round starts. Capacity is enforced automatically, and the waitlist can be promoted when a seat opens.</p></section>
    </div>
  )
}
