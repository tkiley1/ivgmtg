'use client'

import { useActionState } from 'react'
import { checkInAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function TournamentCheckInButton({ tournamentId }: { tournamentId: string }) {
  const [state, action, pending] = useActionState(checkInAction, initialState)
  return <form action={action} className="flex flex-col items-end gap-2"><input type="hidden" name="tournamentId" value={tournamentId} /><button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Checking in…' : 'Check in now'}</button>{state.error && <p className="max-w-xs text-right text-sm text-danger">{state.error}</p>}</form>
}
