import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { signOutAction } from '@/app/auth/actions'

export async function Navbar() {
  const user = await getCurrentUser()

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-6">
            <Link href={user ? '/dashboard' : '/'} className="text-xl font-bold text-accent">
              InvadersMTG
            </Link>
            {user ? (
              <>
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
            <Link href="/decks" className="text-sm text-muted hover:text-foreground transition-colors">Decks</Link>
              </>
            ) : (
              <Link href="/tournaments" className="text-sm text-muted hover:text-foreground transition-colors">
                Browse events
              </Link>
            )}
          </div>
          {user ? (
            <div className="flex items-center gap-4">
            <Link
              href={`/profile/${user.username}`}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              {user.username}
            </Link>
            <Link
              href="/profile/settings"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="btn-secondary text-sm">Sign Out</button>
            </form>
          </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="text-sm text-muted hover:text-foreground">Sign in</Link>
              <Link href="/auth/register" className="btn-primary text-sm">Start an event</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
