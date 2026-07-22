'use client'

import { useActionState } from 'react'
import { removeParticipantAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function ParticipantAdminList({ tournamentId, participants }: { tournamentId: string; participants: Array<{ userId: string; username: string; status: string }> }) {
  const [state, action, pending] = useActionState(removeParticipantAction, initialState)
  const removable = participants.filter((participant) => !['dropped', 'disqualified'].includes(participant.status))
  if (!removable.length) return null
  return <section className="card"><h2 className="mb-1 text-xl font-bold">Participant list</h2><p className="mb-4 text-sm text-muted">Remove no-shows or release a seat before a round starts, then promote the waitlist.</p>{state.error && <p role="alert" className="mb-3 text-sm text-danger">{state.error}</p>}<div className="space-y-2">{removable.map((participant) => <div key={participant.userId} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"><div><span>@{participant.username}</span><span className="ml-2 text-xs capitalize text-muted">{participant.status.replace('_', ' ')}</span></div><form action={action}><input type="hidden" name="tournamentId" value={tournamentId} /><input type="hidden" name="participantUserId" value={participant.userId} /><button type="submit" disabled={pending} className="text-sm text-danger hover:underline">Remove</button></form></div>)}</div></section>
}
