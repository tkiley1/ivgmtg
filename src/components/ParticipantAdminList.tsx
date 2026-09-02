'use client'

import { useActionState } from 'react'
import { addWalkInAction, removeParticipantAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function ParticipantAdminList({ tournamentId, participants }: { tournamentId: string; participants: Array<{ id: string; userId: string | null; username: string | null; displayName: string; isGuest: boolean; status: string }> }) {
  const [state, action, pending] = useActionState(removeParticipantAction, initialState)
  const [walkInState, walkInAction, walkInPending] = useActionState(addWalkInAction, initialState)
  const removable = participants.filter((participant) => !['dropped', 'disqualified'].includes(participant.status))
  return <section className="card"><h2 className="mb-1 text-xl font-bold">Participant list</h2><p className="mb-4 text-sm text-muted">Add walk-ins without an account, remove no-shows, or release a seat between rounds.</p><form action={walkInAction} className="mb-5 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="tournamentId" value={tournamentId} /><label className="sr-only" htmlFor="guestName">Walk-in player name</label><input id="guestName" name="guestName" className="input" maxLength={80} required placeholder="Walk-in player name" /><button type="submit" disabled={walkInPending} className="btn-primary shrink-0">{walkInPending ? 'Adding…' : 'Add walk-in'}</button></form>{(state.error || walkInState.error) && <p role="alert" className="mb-3 text-sm text-danger">{state.error || walkInState.error}</p>}<div className="space-y-2">{removable.map((participant) => <div key={participant.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"><div><span>{participant.displayName}</span>{participant.username && <span className="ml-1 text-muted">@{participant.username}</span>}{participant.isGuest && <span className="ml-2 text-xs text-accent">walk-in</span>}<span className="ml-2 text-xs capitalize text-muted">{participant.status.replace('_', ' ')}</span></div><form action={action}><input type="hidden" name="tournamentId" value={tournamentId} /><input type="hidden" name="participantId" value={participant.id} /><button type="submit" disabled={pending} className="text-sm text-danger hover:underline">Remove</button></form></div>)}</div></section>
}
