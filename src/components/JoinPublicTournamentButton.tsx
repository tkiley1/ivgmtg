'use client'

import { useActionState } from 'react'
import { joinPublicTournamentAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function JoinPublicTournamentButton({ tournamentId }: { tournamentId: string }) {
  const [state, formAction, pending] = useActionState(joinPublicTournamentAction, initialState)
  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Joining…' : 'Join event'}</button>
      {state.error && <p role="alert" className="text-sm text-danger max-w-64 text-right">{state.error}</p>}
    </form>
  )
}
