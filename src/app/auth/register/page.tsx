'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerAction, type AuthActionState } from '../actions'

const initialState: AuthActionState = {}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState)

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Register</h1>

      <form action={formAction} className="space-y-4">
        {state.error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">First Name</label>
            <input
              type="text"
              name="firstName"
              className="input"
              required
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Last Name</label>
            <input
              type="text"
              name="lastName"
              className="input"
              required
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Username</label>
          <input
          type="text"
          name="username"
            className="input"
            required
            minLength={3}
            maxLength={30}
            placeholder="your_username"
          />
        </div>

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
          minLength={12}
          />
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full justify-center">
          {pending ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-accent hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  )
}
