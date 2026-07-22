import { and, desc, eq, ne } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  matchPlayers,
  matches,
  deckLists,
  profiles,
  rounds,
  tournamentOrganizers,
  tournamentParticipants,
  tournaments,
  userDecks,
} from '@/lib/db/schema'
import { calculateStandings, type CompletedMatch } from './standings'

export async function listPublicTournaments(limit = 50) {
  return getDb()
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.isPublic, true), ne(tournaments.status, 'cancelled')))
    .orderBy(desc(tournaments.scheduledAt), desc(tournaments.createdAt))
    .limit(limit)
}

export async function listUserTournaments(userId: string) {
  const database = getDb()
  const [playing, organizing] = await Promise.all([
    database
      .select({ tournament: tournaments, participantStatus: tournamentParticipants.status })
      .from(tournamentParticipants)
      .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id))
      .where(and(eq(tournamentParticipants.userId, userId), ne(tournaments.status, 'cancelled')))
      .orderBy(desc(tournaments.updatedAt)),
    database
      .select({ tournament: tournaments, role: tournamentOrganizers.role })
      .from(tournamentOrganizers)
      .innerJoin(tournaments, eq(tournamentOrganizers.tournamentId, tournaments.id))
      .where(and(eq(tournamentOrganizers.userId, userId), ne(tournaments.status, 'cancelled')))
      .orderBy(desc(tournaments.updatedAt)),
  ])
  return { playing, organizing }
}

export async function listUserStandardDecks(userId: string) {
  return getDb()
    .select()
    .from(userDecks)
    .where(and(eq(userDecks.userId, userId), eq(userDecks.format, 'standard')))
    .orderBy(desc(userDecks.updatedAt))
}

export async function listPublicProfileDecks(userId: string) {
  return getDb()
    .select()
    .from(userDecks)
    .where(and(eq(userDecks.userId, userId), eq(userDecks.format, 'standard'), eq(userDecks.isPublic, true)))
    .orderBy(desc(userDecks.updatedAt))
}

export async function getTournamentOverview(tournamentId: string, viewerId?: string) {
  const database = getDb()
  const [tournament] = await database.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
  if (!tournament) return null

  const participants = await database
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      status: tournamentParticipants.status,
      seedRating: tournamentParticipants.seedRating,
      finalStanding: tournamentParticipants.finalStanding,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(tournamentParticipants)
    .innerJoin(profiles, eq(tournamentParticipants.userId, profiles.userId))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))

  const eventRounds = await database
    .select()
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(rounds.roundNumber)
  const eventMatches = await database
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(matches.tableNumber)
  const rows = await database
    .select({
      matchId: matchPlayers.matchId,
      userId: matchPlayers.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      seat: matchPlayers.seat,
      result: matchPlayers.result,
      placement: matchPlayers.placement,
      gamesWon: matchPlayers.gamesWon,
      gamesDrawn: matchPlayers.gamesDrawn,
      confirmedAt: matchPlayers.confirmedAt,
    })
    .from(matchPlayers)
    .innerJoin(profiles, eq(matchPlayers.userId, profiles.userId))
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(matchPlayers.seat)
  const playersByMatch = new Map<string, typeof rows>()
  for (const row of rows) {
    const players = playersByMatch.get(row.matchId) ?? []
    players.push(row)
    playersByMatch.set(row.matchId, players)
  }

  const organizers = await database
    .select({ userId: tournamentOrganizers.userId, role: tournamentOrganizers.role })
    .from(tournamentOrganizers)
    .where(eq(tournamentOrganizers.tournamentId, tournamentId))
  const isOrganizer = Boolean(viewerId && organizers.some((organizer) => organizer.userId === viewerId))
  const isParticipant = Boolean(viewerId && participants.some((participant) => participant.userId === viewerId && participant.status !== 'dropped'))
  const viewerParticipant = viewerId ? participants.find((participant) => participant.userId === viewerId) ?? null : null
  if (!tournament.isPublic && !isOrganizer && !isParticipant) return null

  const completed: CompletedMatch[] = eventMatches
    .filter((match) => match.status === 'complete')
    .map((match) => ({
      playerResults: (playersByMatch.get(match.id) ?? []).map((player) => ({
        userId: player.userId,
        result: player.result,
        placement: player.placement,
        gamesWon: player.gamesWon,
        gamesDrawn: player.gamesDrawn,
      })),
    }))
  const standings = calculateStandings(
    participants
      .filter((participant) => !['dropped', 'disqualified'].includes(participant.status))
      .map((participant) => ({ userId: participant.userId, username: participant.username, rating: participant.seedRating })),
    completed,
  )

  const viewerDeckList = viewerId && tournament.format === 'standard'
    ? (await database.select().from(deckLists).where(and(eq(deckLists.tournamentId, tournamentId), eq(deckLists.userId, viewerId))).limit(1))[0] ?? null
    : null

  return {
    tournament,
    participants,
    rounds: eventRounds,
    matches: eventMatches.map((match) => ({ ...match, players: playersByMatch.get(match.id) ?? [] })),
    standings,
    isOrganizer,
    isParticipant,
    viewerParticipant,
    viewerDeckList,
  }
}
