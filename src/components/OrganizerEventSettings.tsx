'use client'

import { useActionState } from 'react'
import { cancelTournamentAction, updateTournamentAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

type TournamentSettings = {
  id: string
  name: string
  description: string | null
  format: 'draft' | 'sealed' | 'commander' | 'standard'
  commanderMode: 'duel' | 'pods' | null
  scheduledAt: Date | null
  timezone: string
  venue: string | null
  capacity: number | null
  roundCount: number
  gamesPerMatch: number
  roundTimeLimitMinutes: number
  topCutSize: number | null
  isPublic: boolean
  deckListsRequired: boolean
  draftPickTimeSeconds: number
  draftPicksPerPack: number
  deckBuildingTimeMinutes: number
}

function localDateTimeValue(date: Date | null, timeZone: string) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function OrganizerEventSettings({ tournament }: { tournament: TournamentSettings }) {
  const [state, action, pending] = useActionState(updateTournamentAction, initialState)
  const [cancelState, cancelAction, cancelling] = useActionState(cancelTournamentAction, initialState)
  const isPodCommander = tournament.format === 'commander' && tournament.commanderMode === 'pods'

  return (
    <details className="card">
      <summary className="cursor-pointer list-none text-xl font-bold">
        Event settings <span className="ml-2 text-sm font-normal text-accent">Edit</span>
      </summary>

      <form action={action} className="mt-5 grid gap-4 border-t border-border pt-5">
        <input type="hidden" name="tournamentId" value={tournament.id} />
        <input type="hidden" name="draftPicksPerPack" value={tournament.draftPicksPerPack} />
        <input type="hidden" name="draftPickTimeSeconds" value={tournament.draftPickTimeSeconds} />

        <div>
          <label className="mb-1 block text-sm text-muted" htmlFor="settings-name">Event name</label>
          <input id="settings-name" name="name" className="input" defaultValue={tournament.name} maxLength={120} required />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted" htmlFor="settings-description">Description</label>
          <textarea id="settings-description" name="description" className="input" defaultValue={tournament.description ?? ''} maxLength={5000} rows={3} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-time">Start time</label>
            <input id="settings-time" name="scheduledAt" type="datetime-local" className="input" defaultValue={localDateTimeValue(tournament.scheduledAt, tournament.timezone)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-timezone">Time zone</label>
            <input id="settings-timezone" name="timezone" className="input" defaultValue={tournament.timezone} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-venue">Venue</label>
            <input id="settings-venue" name="venue" className="input" defaultValue={tournament.venue ?? ''} maxLength={160} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-capacity">Capacity</label>
            <input id="settings-capacity" name="capacity" type="number" className="input" defaultValue={tournament.capacity ?? ''} min={2} max={1000} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-rounds">Swiss rounds</label>
            <input id="settings-rounds" name="roundCount" type="number" className="input" defaultValue={tournament.roundCount} min={1} max={20} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-games">Match format</label>
            <select id="settings-games" name="gamesPerMatch" className="input" defaultValue={tournament.gamesPerMatch} disabled={isPodCommander}>
              <option value="1">Best of 1</option>
              <option value="3">Best of 3</option>
            </select>
            {isPodCommander && <input type="hidden" name="gamesPerMatch" value="1" />}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-minutes">Round minutes</label>
            <input id="settings-minutes" name="roundTimeLimitMinutes" type="number" className="input" defaultValue={tournament.roundTimeLimitMinutes} min={10} max={240} required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted" htmlFor="settings-cut">Top cut</label>
            <select id="settings-cut" name="topCutSize" className="input" defaultValue={tournament.topCutSize ?? ''} disabled={isPodCommander}>
              <option value="">None</option>
              {[2, 4, 8, 16, 32, 64].map((size) => <option key={size} value={size}>Top {size}</option>)}
            </select>
          </div>
          {tournament.format === 'draft' ? (
            <div>
              <label className="mb-1 block text-sm text-muted" htmlFor="settings-build-minutes">Deck-building minutes</label>
              <input id="settings-build-minutes" name="deckBuildingTimeMinutes" type="number" className="input" defaultValue={tournament.deckBuildingTimeMinutes} min={5} max={120} required />
            </div>
          ) : (
            <input type="hidden" name="deckBuildingTimeMinutes" value={tournament.deckBuildingTimeMinutes} />
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input name="isPublic" type="checkbox" defaultChecked={tournament.isPublic} /> List this event publicly
        </label>
        {tournament.format === 'standard' && (
          <label className="flex items-center gap-2 text-sm">
            <input name="deckListsRequired" type="checkbox" defaultChecked={tournament.deckListsRequired} /> Require deck lists
          </label>
        )}
        {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        <button className="btn-primary w-fit" disabled={pending}>{pending ? 'Saving…' : 'Save event settings'}</button>
      </form>

      <form
        action={cancelAction}
        className="mt-5 border-t border-border pt-5"
        onSubmit={(event) => {
          if (!window.confirm('Cancel this event? It will disappear from public and personal event lists.')) event.preventDefault()
        }}
      >
        <input type="hidden" name="tournamentId" value={tournament.id} />
        {cancelState.error && <p className="mb-3 text-sm text-danger" role="alert">{cancelState.error}</p>}
        <button className="btn-danger" disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel event'}</button>
      </form>
    </details>
  )
}
