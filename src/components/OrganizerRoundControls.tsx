'use client'

import { useActionState } from 'react'
import {
  completeRoundAction,
  openCheckInAction,
  promoteWaitlistAction,
  startRoundAction,
  type TournamentActionState,
} from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function OrganizerRoundControls({
  tournamentId,
  hasActiveRound,
  completedRounds,
  roundCount,
  status,
  hasWaitlist,
}: {
  tournamentId: string
  hasActiveRound: boolean
  completedRounds: number
  roundCount: number
  status: 'registration' | 'check_in' | 'active' | 'top_cut' | 'completed' | 'draft' | 'cancelled'
  hasWaitlist: boolean
}) {
  const [startState, startAction, startPending] = useActionState(startRoundAction, initialState)
  const [completeState, completeAction, completePending] = useActionState(completeRoundAction, initialState)
  const [checkInState, checkInAction, checkInPending] = useActionState(openCheckInAction, initialState)
  const [waitlistState, waitlistAction, waitlistPending] = useActionState(promoteWaitlistAction, initialState)
  const canStart = !hasActiveRound && (completedRounds < roundCount || status === 'top_cut')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status === 'registration' && <form action={checkInAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={checkInPending} className="btn-secondary">{checkInPending ? 'Opening…' : 'Open check-in'}</button></form>}
        {hasWaitlist && <form action={waitlistAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={waitlistPending} className="btn-secondary">{waitlistPending ? 'Promoting…' : 'Promote waitlist'}</button></form>}
        {canStart && <form action={startAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={startPending} className="btn-primary">{startPending ? 'Generating…' : `Start round ${completedRounds + 1}`}</button></form>}
        {hasActiveRound && <form action={completeAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={completePending} className="btn-secondary">{completePending ? 'Completing…' : 'Complete active round'}</button></form>}
      </div>
      {(startState.error || completeState.error || checkInState.error || waitlistState.error) && <p role="alert" className="text-sm text-danger">{startState.error || completeState.error || checkInState.error || waitlistState.error}</p>}
      {hasActiveRound && <p className="text-sm text-muted">The round can close once every score is confirmed or an organizer overrides the remaining result.</p>}
    </div>
  )
}
