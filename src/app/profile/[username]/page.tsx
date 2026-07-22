import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { playerRatings, profiles, tournamentParticipants, tournaments, userDecks } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const database = getDb()
  const [profile] = await database.select().from(profiles).where(eq(profiles.username, username.toLowerCase())).limit(1)
  if (!profile) notFound()
  const [ratings, history, decks] = await Promise.all([
    database.select().from(playerRatings).where(eq(playerRatings.userId, profile.userId)).orderBy(desc(playerRatings.rating)),
    database.select({ tournament: tournaments, status: tournamentParticipants.status, finalStanding: tournamentParticipants.finalStanding }).from(tournamentParticipants).innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id)).where(eq(tournamentParticipants.userId, profile.userId)).orderBy(desc(tournamentParticipants.createdAt)).limit(20),
    database.select().from(userDecks).where(and(eq(userDecks.userId, profile.userId), eq(userDecks.format, 'standard'), eq(userDecks.isPublic, true))).orderBy(desc(userDecks.updatedAt)),
  ])
  const publicDecks = decks
  return <div className="max-w-4xl mx-auto px-4 py-8 space-y-7"><section className="card"><div className="flex items-center gap-5"><div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-accent overflow-hidden" style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>{profile.avatarUrl ? <span className="sr-only">{profile.displayName}</span> : profile.username[0].toUpperCase()}</div><div><h1 className="text-3xl font-bold">{profile.displayName}</h1><p className="text-muted">@{profile.username}</p>{profile.bio && <p className="mt-2 text-muted">{profile.bio}</p>}</div></div></section><section className="card"><h2 className="text-xl font-bold mb-4">Format ratings</h2>{ratings.length ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{ratings.map((rating) => <div key={rating.id} className="rounded-lg bg-background/40 p-4"><p className="capitalize text-muted text-sm">{rating.format}</p><p className="text-2xl font-bold mt-1">{rating.rating}</p><p className="text-sm text-muted mt-1">{rating.wins}-{rating.losses}-{rating.draws}</p></div>)}</div> : <p className="text-muted text-sm">No rated results yet.</p>}</section>{publicDecks.length > 0 && <section className="card"><h2 className="mb-1 text-xl font-bold">Public Standard decks</h2><p className="mb-4 text-sm text-muted">Deck lists shared by this player.</p><div className="space-y-3">{publicDecks.map((deck) => <details key={deck.id} className="rounded-lg border border-border bg-background/40 p-4"><summary className="cursor-pointer font-medium">{deck.name}</summary><pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">{deck.listText}</pre></details>)}</div></section>}<section className="card"><h2 className="text-xl font-bold mb-4">Event history</h2>{history.length ? <div className="space-y-2">{history.map((entry) => <Link key={entry.tournament.id} href={`/tournaments/${entry.tournament.id}`} className="block rounded-lg bg-background/40 px-4 py-3 hover:bg-card-hover"><p className="font-medium">{entry.tournament.name}</p><p className="text-sm text-muted capitalize">{entry.tournament.format} · {entry.finalStanding ? `Finished #${entry.finalStanding}` : entry.status.replace('_', ' ')}</p></Link>)}</div> : <p className="text-muted text-sm">No events yet.</p>}</section></div>
}
