'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
          .then(({ data }) => setUsername(data?.username ?? null))
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-accent">
              IVGMTG
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/tournaments"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Browse
            </Link>
            {user && (
              <>
                <Link
                  href="/tournaments/my"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  My Tournaments
                </Link>
                <Link
                  href="/tournaments/create"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Create
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href={`/profile/${username ?? ''}`}
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  {username ?? 'Profile'}
                </Link>
                <Link
                  href="/profile/settings"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Settings
                </Link>
                <button onClick={handleSignOut} className="btn-secondary text-sm">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="btn-primary text-sm">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
