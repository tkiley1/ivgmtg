'use client'

import { useActionState } from 'react'
import {
  completeDraftAction,
  generateDraftSeatingAction,
  startDeckBuildingAction,
  startRoundAction,
  type TournamentActionState,
} from '@/app/tournaments/actions'
import { RoundTimer } from './RoundTimer'

const initialState: TournamentActionState = {}

type DraftPod = {
  id: string
  podNumber: number
  seats: Array<{ seat: number; participantId: string; displayName: string; username: string | null; isGuest: boolean }>
}

export function DraftWorkspace({
  tournamentId,
  status,
  endsAt,
  pods,
  isOrganizer,
}: {
  tournamentId: string
  status: 'not_started' | 'seating' | 'drafting' | 'deck_building' | 'complete'
  endsAt: string | null
  pods: DraftPod[]
  isOrganizer: boolean
}) {
  const [seatState, seatAction, seating] = useActionState(generateDraftSeatingAction, initialState)
  const [buildState, buildAction, startingBuild] = useActionState(startDeckBuildingAction, initialState)
  const [roundState, roundAction, startingRound] = useActionState(startRoundAction, initialState)
  const [skipState, skipAction, skipping] = useActionState(completeDraftAction, initialState)
  const error = seatState.error || buildState.error || roundState.error || skipState.error
  const readyToDraft = status === 'seating' || status === 'drafting'

  return (
    <section className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Physical draft</p>
          <h2 className="mt-1 text-2xl font-bold">
            {status === 'not_started' && 'Seat the draft pods'}
            {readyToDraft && 'Draft seating'}
            {status === 'deck_building' && 'Deck building'}
            {status === 'complete' && 'Draft complete'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {status === 'not_started' && 'Generate randomized pods when registration and check-in are settled.'}
            {readyToDraft && 'Run the draft at the table, then start deck building when the final cards have been picked.'}
            {status === 'deck_building' && 'Build a minimum 40-card deck, including basic lands. Start round one when everyone is ready.'}
            {status === 'complete' && 'Draft setup is complete. Round pairings are ready or can be generated from organizer controls.'}
          </p>
        </div>
        {status === 'deck_building' && <RoundTimer endsAt={endsAt} />}
      </div>

      {pods.length > 0 && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {pods.map((pod) => (
            <div key={pod.id} className="rounded-lg border border-border bg-background/40 p-4">
              <h3 className="font-semibold">Pod {pod.podNumber}</h3>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {pod.seats.map((seat) => (
                  <li key={seat.participantId} className="text-sm">
                    <span className="mr-2 font-mono text-muted">{seat.seat}.</span>
                    {seat.displayName}
                    {seat.username && <span className="ml-1 text-muted">@{seat.username}</span>}
                    {seat.isGuest && <span className="ml-2 text-xs text-accent">walk-in</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {isOrganizer && status !== 'complete' && (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
          {(status === 'not_started' || status === 'seating') && (
            <form action={seatAction}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <button className="btn-secondary" disabled={seating}>
                {seating ? 'Seating…' : status === 'seating' ? 'Reseat pods' : 'Generate seating'}
              </button>
            </form>
          )}
          {readyToDraft && (
            <form action={buildAction}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <button className="btn-primary" disabled={startingBuild}>
                {startingBuild ? 'Starting…' : 'Start deck building'}
              </button>
            </form>
          )}
          {status === 'deck_building' && (
            <form action={roundAction}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <button className="btn-primary" disabled={startingRound}>
                {startingRound ? 'Generating…' : 'Generate pairings & start round 1'}
              </button>
            </form>
          )}
          {status === 'not_started' && (
            <form action={skipAction} onSubmit={(event) => { if (!window.confirm('Skip draft seating for this event?')) event.preventDefault() }}>
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <button className="btn-secondary" disabled={skipping}>Skip draft seating</button>
            </form>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
    </section>
  )
}
