'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required')
      setLoading(false)
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Check username availability
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      setError('Username already taken')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, first_name: firstName.trim(), last_name: lastName.trim() },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Register</h1>

      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input"
              required
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
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
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
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
            minLength={6}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Creating account...' : 'Create Account'}
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
