'use client'

import { useActionState } from 'react'
import { requestPasswordResetAction, resetPasswordAction, type AuthActionState } from '@/app/auth/actions'

const initialState: AuthActionState = {}

export function RequestPasswordResetForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState)
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{state.error}</div>}
      {state.message && <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success" role="status">{state.message}</div>}
      <div>
        <label className="mb-1 block text-sm text-muted">Email</label>
        <input type="email" name="email" className="input" required autoComplete="email" />
      </div>
      <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>{pending ? 'Sending…' : 'Email reset link'}</button>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{state.error}</div>}
      <div>
        <label className="mb-1 block text-sm text-muted">New password</label>
        <input type="password" name="password" className="input" minLength={12} required autoComplete="new-password" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Confirm new password</label>
        <input type="password" name="confirmPassword" className="input" minLength={12} required autoComplete="new-password" />
      </div>
      <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>{pending ? 'Updating…' : 'Set new password'}</button>
    </form>
  )
}
