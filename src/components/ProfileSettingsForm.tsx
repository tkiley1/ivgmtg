'use client'

import { useActionState } from 'react'
import { updateProfileAction, type ProfileActionState } from '@/app/profile/actions'

const initialState: ProfileActionState = {}

export function ProfileSettingsForm({ profile }: { profile: { displayName: string; bio: string | null; avatarUrl: string | null } }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState)
  return <form action={formAction} className="card space-y-5">{state.error && <p role="alert" className="text-danger text-sm">{state.error}</p>}{state.success && <p className="text-success text-sm">{state.success}</p>}<div><label className="block text-sm text-muted mb-1">Display name</label><input name="displayName" className="input" required maxLength={80} defaultValue={profile.displayName} /></div><div><label className="block text-sm text-muted mb-1">Avatar URL <span className="opacity-70">(optional)</span></label><input name="avatarUrl" type="url" className="input" placeholder="https://…" defaultValue={profile.avatarUrl ?? ''} /><p className="text-xs text-muted mt-2">Direct upload will be added with the production object-storage integration.</p></div><div><label className="block text-sm text-muted mb-1">Bio</label><textarea name="bio" className="input" rows={4} maxLength={280} defaultValue={profile.bio ?? ''} /></div><button disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save profile'}</button></form>
}
