import { and, desc, eq, ne } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  matchPlayers,
  matches,
  deckLists,
  draftPodSeats,
  draftPods,
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

  const participantRows = await database
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      guestName: tournamentParticipants.guestName,
      status: tournamentParticipants.status,
      seedRating: tournamentParticipants.seedRating,
      finalStanding: tournamentParticipants.finalStanding,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(tournamentParticipants)
    .leftJoin(profiles, eq(tournamentParticipants.userId, profiles.userId))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
  const participants = participantRows.map((participant) => ({
    ...participant,
    username: participant.username,
    displayName: participant.displayName ?? participant.guestName ?? 'Walk-in player',
    isGuest: !participant.userId,
  }))

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
      id: matchPlayers.id,
      matchId: matchPlayers.matchId,
      participantId: matchPlayers.participantId,
      userId: matchPlayers.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      guestName: tournamentParticipants.guestName,
      seat: matchPlayers.seat,
      result: matchPlayers.result,
      placement: matchPlayers.placement,
      gamesWon: matchPlayers.gamesWon,
      gamesDrawn: matchPlayers.gamesDrawn,
      confirmedAt: matchPlayers.confirmedAt,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .innerJoin(tournamentParticipants, eq(matchPlayers.participantId, tournamentParticipants.id))
    .leftJoin(profiles, eq(matchPlayers.userId, profiles.userId))
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(matchPlayers.seat)
  const resolvedRows = rows.map((player) => ({
    ...player,
    displayName: player.displayName ?? player.guestName ?? 'Walk-in player',
    isGuest: !player.userId,
  }))
  const playersByMatch = new Map<string, typeof resolvedRows>()
  for (const row of resolvedRows) {
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
        participantId: player.participantId,
        result: player.result,
        placement: player.placement,
        gamesWon: player.gamesWon,
        gamesDrawn: player.gamesDrawn,
      })),
    }))
  const playedParticipantIds = new Set(completed.flatMap((match) => match.playerResults.map((player) => player.participantId)))
  const standings = calculateStandings(
    participants
      .filter((participant) => !['dropped', 'disqualified'].includes(participant.status) || playedParticipantIds.has(participant.id))
      .map((participant) => ({
        participantId: participant.id,
        userId: participant.userId,
        username: participant.username,
        displayName: participant.displayName,
        rating: participant.seedRating,
      })),
    completed,
  )

  const podRows = tournament.format === 'draft'
    ? await database.select({
        podId: draftPods.id,
        podNumber: draftPods.podNumber,
        seat: draftPodSeats.seat,
        participantId: tournamentParticipants.id,
        userId: tournamentParticipants.userId,
        username: profiles.username,
        displayName: profiles.displayName,
        guestName: tournamentParticipants.guestName,
      }).from(draftPods)
        .innerJoin(draftPodSeats, eq(draftPodSeats.podId, draftPods.id))
        .innerJoin(tournamentParticipants, eq(draftPodSeats.participantId, tournamentParticipants.id))
        .leftJoin(profiles, eq(tournamentParticipants.userId, profiles.userId))
        .where(eq(draftPods.tournamentId, tournamentId))
        .orderBy(draftPods.podNumber, draftPodSeats.seat)
    : []
  const draftPodMap = new Map<string, { id: string; podNumber: number; seats: Array<{ seat: number; participantId: string; userId: string | null; username: string | null; displayName: string; isGuest: boolean }> }>()
  for (const row of podRows) {
    const pod = draftPodMap.get(row.podId) ?? { id: row.podId, podNumber: row.podNumber, seats: [] }
    pod.seats.push({
      seat: row.seat,
      participantId: row.participantId,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName ?? row.guestName ?? 'Walk-in player',
      isGuest: !row.userId,
    })
    draftPodMap.set(row.podId, pod)
  }

  const viewerDeckList = viewerId && tournament.format === 'standard'
    ? (await database.select().from(deckLists).where(and(eq(deckLists.tournamentId, tournamentId), eq(deckLists.userId, viewerId))).limit(1))[0] ?? null
    : null

  return {
    tournament,
    participants,
    rounds: eventRounds,
    matches: eventMatches.map((match) => ({ ...match, players: playersByMatch.get(match.id) ?? [] })),
    standings,
    draftPods: [...draftPodMap.values()],
    isOrganizer,
    isParticipant,
    viewerParticipant,
    viewerDeckList,
  }
}
