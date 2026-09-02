'use client'

import { useActionState } from 'react'
import { swapActiveRoundPlayersAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function PairingRepairForm({ tournamentId, players }: { tournamentId: string; players: Array<{ id: string; tableNumber: number | null; displayName: string }> }) {
  const [state, action, pending] = useActionState(swapActiveRoundPlayersAction, initialState)
  if (players.length < 2) return null
  return <details className="mt-5 rounded-lg border border-border bg-background/30 p-4"><summary className="cursor-pointer font-semibold">Repair pairings</summary><p className="mt-2 text-sm text-muted">Swap two players at different tables before either table reports a result.</p><form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="tournamentId" value={tournamentId} /><label className="text-sm text-muted">First player<select name="firstMatchPlayerId" className="input mt-1" required defaultValue=""><option value="" disabled>Choose player</option>{players.map((player) => <option key={player.id} value={player.id}>Table {player.tableNumber ?? 'Bye'} · {player.displayName}</option>)}</select></label><label className="text-sm text-muted">Second player<select name="secondMatchPlayerId" className="input mt-1" required defaultValue=""><option value="" disabled>Choose player</option>{players.map((player) => <option key={player.id} value={player.id}>Table {player.tableNumber ?? 'Bye'} · {player.displayName}</option>)}</select></label><button className="btn-secondary self-end" disabled={pending}>{pending ? 'Swapping…' : 'Swap players'}</button></form>{state.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}</details>
}
