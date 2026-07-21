'use client'

import { useActionState } from 'react'
import {
  completeRoundAction,
  startRoundAction,
  type TournamentActionState,
} from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function OrganizerRoundControls({
  tournamentId,
  hasActiveRound,
  completedRounds,
  roundCount,
}: {
  tournamentId: string
  hasActiveRound: boolean
  completedRounds: number
  roundCount: number
}) {
  const [startState, startAction, startPending] = useActionState(startRoundAction, initialState)
  const [completeState, completeAction, completePending] = useActionState(completeRoundAction, initialState)
  const canStart = !hasActiveRound && completedRounds < roundCount

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {canStart && <form action={startAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={startPending} className="btn-primary">{startPending ? 'Generating…' : `Start round ${completedRounds + 1}`}</button></form>}
        {hasActiveRound && <form action={completeAction}><input type="hidden" name="tournamentId" value={tournamentId} /><button disabled={completePending} className="btn-secondary">{completePending ? 'Completing…' : 'Complete active round'}</button></form>}
      </div>
      {(startState.error || completeState.error) && <p role="alert" className="text-sm text-danger">{startState.error || completeState.error}</p>}
      {hasActiveRound && <p className="text-sm text-muted">The round can close once every score is confirmed or an organizer overrides the remaining result.</p>}
    </div>
  )
}
