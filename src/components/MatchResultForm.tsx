'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  confirmMatchAction,
  correctMatchAction,
  reportMatchAction,
  type TournamentActionState,
} from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

type Player = { participantId: string; userId: string | null; username: string | null; displayName: string; gamesWon: number; gamesDrawn: number; placement: number | null }

export function MatchResultForm({
  tournamentId,
  matchId,
  kind,
  players,
  canReport,
  status,
  canCorrect,
}: {
  tournamentId: string
  matchId: string
  kind: 'head_to_head' | 'commander_pod'
  players: Player[]
  canReport: boolean
  status: string
  canCorrect: boolean
}) {
  const [state, formAction, pending] = useActionState(reportMatchAction, initialState)
  const [correctionState, correctionAction, correcting] = useActionState(correctMatchAction, initialState)
  const [confirmState, confirmAction, confirming] = useActionState(confirmMatchAction, initialState)
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(players.map((player) => [player.participantId, player.gamesWon])))
  const [draws, setDraws] = useState(players[0]?.gamesDrawn ?? 0)
  const [placements, setPlacements] = useState<Record<string, number>>(() => Object.fromEntries(players.map((player, index) => [player.participantId, player.placement ?? index + 1])))
  const result = useMemo(() => JSON.stringify({
    tournamentId,
    matchId,
    players: players.map((player) => ({
      participantId: player.participantId,
      gamesWon: scores[player.participantId] ?? 0,
      gamesDrawn: kind === 'head_to_head' ? draws : 0,
      placement: kind === 'commander_pod' ? placements[player.participantId] : null,
    })),
  }), [draws, kind, matchId, placements, players, scores, tournamentId])

  if (status === 'complete' && !canCorrect) return <p className="text-sm text-success">Result confirmed and final.</p>

  return (
    <div className="space-y-5">
      {status === 'complete' && <p className="text-sm text-success">Result confirmed and final. Organizers may correct it below.</p>}
      {(canReport || canCorrect) && <form action={status === 'complete' ? correctionAction : formAction} className="space-y-4">
        <input type="hidden" name="result" value={result} />
        {kind === 'head_to_head' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            {players.map((player) => <label key={player.participantId} className="text-sm text-muted">{player.displayName}<input aria-label={`${player.displayName} games won`} type="number" min={0} className="input mt-1" value={scores[player.participantId] ?? 0} onChange={(event) => setScores((current) => ({ ...current, [player.participantId]: Number(event.target.value) }))} /></label>)}
            <label className="text-sm text-muted">Drawn games<input aria-label="Drawn games" type="number" min={0} className="input mt-1" value={draws} onChange={(event) => setDraws(Number(event.target.value))} /></label>
          </div>
        ) : (
          <div className="space-y-3">{players.map((player) => <label key={player.participantId} className="flex items-center justify-between gap-4 text-sm"><span>{player.displayName}{player.username && <span className="ml-1 text-muted">@{player.username}</span>}</span><select className="input max-w-28" value={placements[player.participantId]} onChange={(event) => setPlacements((current) => ({ ...current, [player.participantId]: Number(event.target.value) }))}>{players.map((_, index) => <option key={index} value={index + 1}>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</option>)}</select></label>)}</div>
        )}
        <button type="submit" disabled={pending || correcting} className="btn-primary">{pending || correcting ? 'Saving…' : status === 'complete' ? 'Correct final result' : 'Submit result'}</button>
      </form>}
      {status === 'reported' && <form action={confirmAction}><input type="hidden" name="matchId" value={matchId} /><input type="hidden" name="tournamentId" value={tournamentId} /><button type="submit" disabled={confirming} className="btn-secondary">{confirming ? 'Confirming…' : 'Confirm reported result'}</button></form>}
      {(state.error || correctionState.error || confirmState.error) && <p role="alert" className="text-sm text-danger">{state.error || correctionState.error || confirmState.error}</p>}
      {status === 'pending' && !canReport && <p className="text-sm text-muted">Only a player assigned to this table or an organizer can report the result.</p>}
    </div>
  )
}
