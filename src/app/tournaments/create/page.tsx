'use client'

import { useActionState, useState } from 'react'
import { createTournamentAction, type TournamentActionState } from '../actions'

const initialState: TournamentActionState = {}

export default function CreateTournamentPage() {
  const [state, formAction, pending] = useActionState(createTournamentAction, initialState)
  const [format, setFormat] = useState<'draft' | 'sealed' | 'commander' | 'standard'>('commander')
  const [commanderMode, setCommanderMode] = useState<'duel' | 'pods'>('duel')
  const [gamesPerMatch, setGamesPerMatch] = useState<1 | 3>(3)

  const showCommanderOptions = format === 'commander'
  const allowTopCut = format !== 'commander' || commanderMode === 'duel'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Organizer workspace</p>
        <h1 className="text-3xl font-bold mt-2">Create an event</h1>
        <p className="text-muted mt-2">Set the format, structure, and player experience. You can open check-in when you&apos;re ready.</p>
      </div>

      <form action={formAction} className="space-y-8">
        {state.error && (
          <div role="alert" className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">{state.error}</div>
        )}

        <section className="card space-y-5">
          <h2 className="font-semibold text-lg">Event details</h2>
          <div>
            <label htmlFor="name" className="block text-sm text-muted mb-1">Tournament name</label>
            <input id="name" name="name" className="input" required maxLength={120} placeholder="Friday Night Commander" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm text-muted mb-1">Description <span className="opacity-70">(optional)</span></label>
            <textarea id="description" name="description" className="input" rows={4} maxLength={5_000} placeholder="What should players know before joining?" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduledAt" className="block text-sm text-muted mb-1">Start time <span className="opacity-70">(optional)</span></label>
              <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="input" />
            </div>
            <div>
              <label htmlFor="timezone" className="block text-sm text-muted mb-1">Time zone</label>
              <input id="timezone" name="timezone" className="input" defaultValue="America/New_York" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="venue" className="block text-sm text-muted mb-1">Venue or online location <span className="opacity-70">(optional)</span></label>
              <input id="venue" name="venue" className="input" maxLength={160} placeholder="The Sideboard, Brooklyn" />
            </div>
            <div>
              <label htmlFor="capacity" className="block text-sm text-muted mb-1">Player capacity <span className="opacity-70">(optional)</span></label>
              <input id="capacity" name="capacity" type="number" className="input" min={2} max={1_000} placeholder="Unlimited" />
            </div>
          </div>
        </section>

        <section className="card space-y-5">
          <h2 className="font-semibold text-lg">Format and structure</h2>
          <div>
            <label htmlFor="format" className="block text-sm text-muted mb-1">Format</label>
            <select id="format" name="format" value={format} onChange={(event) => {
              const nextFormat = event.target.value as typeof format
              setFormat(nextFormat)
              if (nextFormat === 'commander' && commanderMode === 'pods') setGamesPerMatch(1)
            }} className="input">
              <option value="commander">Commander</option>
              <option value="draft">Booster Draft</option>
              <option value="sealed">Sealed</option>
              <option value="standard">Standard</option>
            </select>
          </div>

          {showCommanderOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="commanderMode" className="block text-sm text-muted mb-1">Commander play</label>
                <select id="commanderMode" name="commanderMode" value={commanderMode} onChange={(event) => {
                  const nextMode = event.target.value as typeof commanderMode
                  setCommanderMode(nextMode)
                  if (nextMode === 'pods') setGamesPerMatch(1)
                }} className="input">
                  <option value="duel">1v1 Commander</option>
                  <option value="pods">Multiplayer pods</option>
                </select>
              </div>
              {commanderMode === 'pods' && (
                <div>
                  <label htmlFor="podSize" className="block text-sm text-muted mb-1">Preferred pod size</label>
                  <select id="podSize" name="podSize" className="input" defaultValue="4">
                    <option value="4">4 players</option>
                    <option value="3">3 players</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="roundCount" className="block text-sm text-muted mb-1">Swiss rounds</label>
              <input id="roundCount" name="roundCount" type="number" defaultValue={4} className="input" min={1} max={20} required />
            </div>
            <div>
              <label htmlFor="gamesPerMatch" className="block text-sm text-muted mb-1">Match format</label>
              {showCommanderOptions && commanderMode === 'pods' && <input type="hidden" name="gamesPerMatch" value="1" />}
              <select id="gamesPerMatch" name={showCommanderOptions && commanderMode === 'pods' ? undefined : 'gamesPerMatch'} value={showCommanderOptions && commanderMode === 'pods' ? 1 : gamesPerMatch} onChange={(event) => setGamesPerMatch(Number(event.target.value) as 1 | 3)} className="input" disabled={showCommanderOptions && commanderMode === 'pods'}>
                <option value="1">Best of 1</option>
                <option value="3">Best of 3</option>
              </select>
            </div>
            <div>
              <label htmlFor="roundTimeLimitMinutes" className="block text-sm text-muted mb-1">Round minutes</label>
              <input id="roundTimeLimitMinutes" name="roundTimeLimitMinutes" type="number" defaultValue={50} className="input" min={10} max={240} required />
            </div>
          </div>

          {allowTopCut && (
            <div>
              <label htmlFor="topCutSize" className="block text-sm text-muted mb-1">Top cut <span className="opacity-70">(optional)</span></label>
              <select id="topCutSize" name="topCutSize" className="input" defaultValue="">
                <option value="">No top cut</option>
                <option value="2">Top 2</option>
                <option value="4">Top 4</option>
                <option value="8">Top 8</option>
                <option value="16">Top 16</option>
              </select>
            </div>
          )}
          {showCommanderOptions && commanderMode === 'pods' && (
            <p className="text-sm text-muted">Pod events pair 3–4 players at a table and record finishing order. Top cut is intentionally unavailable for this structure.</p>
          )}
        </section>

        <section className="card space-y-4">
          <h2 className="font-semibold text-lg">Registration</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input name="isPublic" type="checkbox" defaultChecked className="mt-1 w-4 h-4 accent-primary" />
            <span><span className="block text-sm font-medium">List this event publicly</span><span className="block text-sm text-muted">Private events can still be joined with their access key or invite link.</span></span>
          </label>
          {format === 'standard' && <label className="flex items-start gap-3 cursor-pointer">
            <input name="deckListsRequired" type="checkbox" className="mt-1 w-4 h-4 accent-primary" />
            <span><span className="block text-sm font-medium">Require Standard deck registration</span><span className="block text-sm text-muted">Players submit an MTG Arena exported deck list before the organizer locks the event.</span></span>
          </label>}
        </section>

        <button type="submit" disabled={pending} className="btn-primary w-full justify-center py-3">
          {pending ? 'Creating event…' : 'Create event'}
        </button>
      </form>
    </div>
  )
}
