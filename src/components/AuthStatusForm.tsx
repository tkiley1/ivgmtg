'use client'

import { useActionState } from 'react'
import { resendVerificationAction, verifyEmailAction, type AuthActionState } from '@/app/auth/actions'

const initialState: AuthActionState = {}

export function ResendVerificationForm({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(resendVerificationAction, initialState)

  return (
    <form action={action} className={compact ? 'inline-flex items-center gap-3' : 'space-y-3'}>
      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {state.message && <p className="text-sm text-success" role="status">{state.message}</p>}
      <button type="submit" className="btn-secondary text-sm" disabled={pending}>
        {pending ? 'Sending…' : 'Resend verification email'}
      </button>
    </form>
  )
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initialState)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger" role="alert">{state.error}</div>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>
        {pending ? 'Verifying…' : 'Verify email address'}
      </button>
    </form>
  )
}
