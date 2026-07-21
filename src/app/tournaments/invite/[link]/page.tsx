'use client'

import { use, useActionState } from 'react'
import { joinInviteTournamentAction, type TournamentActionState } from '../../actions'

const initialState: TournamentActionState = {}

export default function InviteLinkPage({ params }: { params: Promise<{ link: string }> }) {
  const [state, formAction, pending] = useActionState(joinInviteTournamentAction, initialState)
  const { link } = use(params)
  return <div className="max-w-md mx-auto px-4 py-20 text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">You&apos;re invited</p><h1 className="text-3xl font-bold mt-2">Join this event</h1><p className="text-muted mt-3">Sign in, then accept the organizer&apos;s invite.</p><form action={formAction} className="mt-7"><input type="hidden" name="inviteToken" value={link} /><button className="btn-primary" disabled={pending}>{pending ? 'Joining…' : 'Accept invite'}</button>{state.error && <p role="alert" className="text-danger text-sm mt-3">{state.error}</p>}</form></div>
}
