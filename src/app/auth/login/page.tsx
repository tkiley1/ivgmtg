'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction, type AuthActionState } from '../actions'

const initialState: AuthActionState = {}

function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirect} />
      {state.error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm text-muted mb-1">Email</label>
        <input
          type="email"
          name="email"
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-muted mb-1">Password</label>
        <input
          type="password"
          name="password"
          className="input"
          required
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full justify-center">
        {pending ? 'Signing in...' : 'Sign In'}
      </button>
      <p className="text-right text-sm"><Link href="/auth/forgot-password" className="text-accent hover:underline">Forgot password?</Link></p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Sign In</h1>
      <Suspense fallback={<div className="text-center text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-muted mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </div>
  )
}
