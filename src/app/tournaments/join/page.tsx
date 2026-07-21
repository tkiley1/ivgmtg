'use client'

import { useActionState } from 'react'
import { joinTournamentAction, type TournamentActionState } from '../actions'

const initialState: TournamentActionState = {}

export default function JoinTournamentPage() {
  const [state, formAction, pending] = useActionState(joinTournamentAction, initialState)

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-accent">Player check-in</p>
      <h1 className="text-3xl font-bold mb-3 mt-2 text-center">Join an event</h1>
      <p className="text-muted text-center mb-8">Enter the eight-character access key from your organizer.</p>
      <form action={formAction} className="space-y-4">
        {state.error && <div role="alert" className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">{state.error}</div>}
        <div>
          <label htmlFor="accessKey" className="block text-sm text-muted mb-1">Access key</label>
          <input id="accessKey" name="accessKey" className="input text-center font-mono text-lg tracking-[0.2em] uppercase" placeholder="ABCD1234" minLength={8} maxLength={8} required />
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full justify-center">
          {pending ? 'Joining…' : 'Join event'}
        </button>
      </form>
    </div>
  )
}
