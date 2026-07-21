import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { playerRatings, profiles, tournamentParticipants, tournaments } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const database = getDb()
  const [profile] = await database.select().from(profiles).where(eq(profiles.username, username.toLowerCase())).limit(1)
  if (!profile) notFound()
  const [ratings, history] = await Promise.all([
    database.select().from(playerRatings).where(eq(playerRatings.userId, profile.userId)).orderBy(desc(playerRatings.rating)),
    database.select({ tournament: tournaments, status: tournamentParticipants.status, finalStanding: tournamentParticipants.finalStanding }).from(tournamentParticipants).innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id)).where(eq(tournamentParticipants.userId, profile.userId)).orderBy(desc(tournamentParticipants.createdAt)).limit(20),
  ])
  return <div className="max-w-4xl mx-auto px-4 py-8 space-y-7"><section className="card"><div className="flex items-center gap-5"><div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-accent overflow-hidden" style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>{profile.avatarUrl ? <span className="sr-only">{profile.displayName}</span> : profile.username[0].toUpperCase()}</div><div><h1 className="text-3xl font-bold">{profile.displayName}</h1><p className="text-muted">@{profile.username}</p>{profile.bio && <p className="mt-2 text-muted">{profile.bio}</p>}</div></div></section><section className="card"><h2 className="text-xl font-bold mb-4">Format ratings</h2>{ratings.length ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{ratings.map((rating) => <div key={rating.id} className="rounded-lg bg-background/40 p-4"><p className="capitalize text-muted text-sm">{rating.format}</p><p className="text-2xl font-bold mt-1">{rating.rating}</p><p className="text-sm text-muted mt-1">{rating.wins}-{rating.losses}-{rating.draws}</p></div>)}</div> : <p className="text-muted text-sm">No rated results yet.</p>}</section><section className="card"><h2 className="text-xl font-bold mb-4">Event history</h2>{history.length ? <div className="space-y-2">{history.map((entry) => <Link key={entry.tournament.id} href={`/tournaments/${entry.tournament.id}`} className="block rounded-lg bg-background/40 px-4 py-3 hover:bg-card-hover"><p className="font-medium">{entry.tournament.name}</p><p className="text-sm text-muted capitalize">{entry.tournament.format} · {entry.finalStanding ? `Finished #${entry.finalStanding}` : entry.status.replace('_', ' ')}</p></Link>)}</div> : <p className="text-muted text-sm">No events yet.</p>}</section></div>
}
