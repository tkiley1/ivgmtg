'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(redirect)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-muted mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-muted mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
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
