'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  confirmMatchAction,
  reportMatchAction,
  type TournamentActionState,
} from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

type Player = { userId: string; username: string; displayName: string }

export function MatchResultForm({
  tournamentId,
  matchId,
  kind,
  players,
  canReport,
  status,
}: {
  tournamentId: string
  matchId: string
  kind: 'head_to_head' | 'commander_pod'
  players: Player[]
  canReport: boolean
  status: string
}) {
  const [state, formAction, pending] = useActionState(reportMatchAction, initialState)
  const [confirmState, confirmAction, confirming] = useActionState(confirmMatchAction, initialState)
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(players.map((player) => [player.userId, 0])))
  const [draws, setDraws] = useState(0)
  const [placements, setPlacements] = useState<Record<string, number>>(() => Object.fromEntries(players.map((player, index) => [player.userId, index + 1])))
  const result = useMemo(() => JSON.stringify({
    tournamentId,
    matchId,
    players: players.map((player) => ({
      userId: player.userId,
      gamesWon: scores[player.userId] ?? 0,
      gamesDrawn: kind === 'head_to_head' ? draws : 0,
      placement: kind === 'commander_pod' ? placements[player.userId] : null,
    })),
  }), [draws, kind, matchId, placements, players, scores, tournamentId])

  if (status === 'complete') return <p className="text-sm text-success">Result confirmed and final.</p>

  return (
    <div className="space-y-5">
      {canReport && <form action={formAction} className="space-y-4">
        <input type="hidden" name="result" value={result} />
        {kind === 'head_to_head' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            {players.map((player) => <label key={player.userId} className="text-sm text-muted">{player.displayName}<input aria-label={`${player.displayName} games won`} type="number" min={0} className="input mt-1" value={scores[player.userId] ?? 0} onChange={(event) => setScores((current) => ({ ...current, [player.userId]: Number(event.target.value) }))} /></label>)}
            <label className="text-sm text-muted">Drawn games<input aria-label="Drawn games" type="number" min={0} className="input mt-1" value={draws} onChange={(event) => setDraws(Number(event.target.value))} /></label>
          </div>
        ) : (
          <div className="space-y-3">{players.map((player) => <label key={player.userId} className="flex items-center justify-between gap-4 text-sm"><span>{player.displayName} <span className="text-muted">@{player.username}</span></span><select className="input max-w-28" value={placements[player.userId]} onChange={(event) => setPlacements((current) => ({ ...current, [player.userId]: Number(event.target.value) }))}>{players.map((_, index) => <option key={index} value={index + 1}>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</option>)}</select></label>)}</div>
        )}
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Submitting…' : 'Submit result'}</button>
      </form>}
      {status === 'reported' && <form action={confirmAction}><input type="hidden" name="matchId" value={matchId} /><input type="hidden" name="tournamentId" value={tournamentId} /><button type="submit" disabled={confirming} className="btn-secondary">{confirming ? 'Confirming…' : 'Confirm reported result'}</button></form>}
      {(state.error || confirmState.error) && <p role="alert" className="text-sm text-danger">{state.error || confirmState.error}</p>}
      {status === 'pending' && !canReport && <p className="text-sm text-muted">Only a player assigned to this table or an organizer can report the result.</p>}
    </div>
  )
}
