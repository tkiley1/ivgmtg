'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signOutAction } from '@/app/auth/actions'

const playerLinks = [
  { href: '/tournaments', label: 'Discover' },
  { href: '/tournaments/my', label: 'My events' },
  { href: '/leaderboard', label: 'Rankings' },
  { href: '/decks', label: 'Decks' },
]

export function AppNavigation({ user }: { user: { username: string } | null }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return <nav className="app-nav">
    <div className="app-nav__inner">
      <Link href={user ? '/dashboard' : '/'} className="brand" onClick={close}><span className="brand__mark">I</span><span>Invaders<span className="brand__accent">MTG</span></span></Link>
      <div className="app-nav__desktop">
        {user ? <>{playerLinks.map((link) => <Link key={link.href} href={link.href} className="app-nav__link">{link.label}</Link>)}<Link href="/tournaments/create" className="app-nav__create">Create event</Link></> : <Link href="/tournaments" className="app-nav__link">Explore events</Link>}
      </div>
      <div className="app-nav__desktop app-nav__account">
        {user ? <><Link href={`/profile/${user.username}`} className="app-nav__profile"><span className="app-nav__avatar">{user.username[0]?.toUpperCase()}</span><span>@{user.username}</span></Link><Link href="/profile/settings" className="app-nav__link">Settings</Link><form action={signOutAction}><button type="submit" className="app-nav__signout">Sign out</button></form></> : <><Link href="/auth/login" className="app-nav__link">Sign in</Link><Link href="/auth/register" className="btn-primary">Start playing <span aria-hidden="true">→</span></Link></>}
      </div>
      <button type="button" className="app-nav__toggle" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}><span /><span /><span /></button>
    </div>
    {open && <div className="app-nav__mobile"><div className="app-nav__mobile-links">{user ? <>{playerLinks.map((link) => <Link key={link.href} href={link.href} onClick={close}>{link.label}</Link>)}<Link href="/tournaments/create" onClick={close} className="app-nav__mobile-create">Create event <span>+</span></Link><Link href={`/profile/${user.username}`} onClick={close}>@{user.username}</Link><Link href="/profile/settings" onClick={close}>Settings</Link><form action={signOutAction}><button type="submit">Sign out</button></form></> : <><Link href="/tournaments" onClick={close}>Explore events</Link><Link href="/auth/login" onClick={close}>Sign in</Link><Link href="/auth/register" onClick={close} className="app-nav__mobile-create">Start playing <span>→</span></Link></>}</div></div>}
  </nav>
}
