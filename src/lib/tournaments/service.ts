import { randomBytes, randomInt } from 'crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  auditEvents,
  deckLists,
  draftPodSeats,
  draftPods,
  matchPlayers,
  matchRatingAdjustments,
  matches,
  playerRatings,
  profiles,
  rounds,
  tournamentOrganizers,
  tournamentParticipants,
  tournaments,
  userDecks,
} from '@/lib/db/schema'
import { validateStandardArenaDecklist } from '@/lib/decks/arena'
import { seatDraftPods } from './draft'
import { createCommanderPodPairings, createSwissPairings, type PairingPlayer } from './pairing'
import { validateHeadToHeadScores } from './scoring'
import { calculateStandings, type CompletedMatch } from './standings'

export type CreateTournamentInput = {
  name: string
  description?: string
  format: 'draft' | 'sealed' | 'commander' | 'standard'
  commanderMode?: 'duel' | 'pods'
  podSize?: number
  roundCount: number
  gamesPerMatch: number
  roundTimeLimitMinutes: number
  topCutSize?: number
  isPublic: boolean
  scheduledAt?: Date
  timezone: string
  venue?: string
  capacity?: number
  deckListsRequired: boolean
}

function createAccessKey() {
  return randomBytes(4).toString('hex').toUpperCase()
}

export async function createTournament(ownerId: string, input: CreateTournamentInput) {
  const database = getDb()

  // The database uniqueness constraint remains the source of truth. Retrying here
  // makes a very unlikely access-key collision invisible to the organizer.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.transaction(async (tx) => {
        const [tournament] = await tx
          .insert(tournaments)
          .values({
            ownerId,
            accessKey: createAccessKey(),
            name: input.name,
            description: input.description,
            format: input.format,
            commanderMode: input.format === 'commander' ? input.commanderMode : null,
            podSize: input.format === 'commander' && input.commanderMode === 'pods' ? input.podSize : null,
            status: 'registration',
            isPublic: input.isPublic,
            scheduledAt: input.scheduledAt,
            timezone: input.timezone,
            venue: input.venue,
            capacity: input.capacity,
            roundCount: input.roundCount,
            gamesPerMatch: input.gamesPerMatch,
            roundTimeLimitMinutes: input.roundTimeLimitMinutes,
            topCutSize: input.topCutSize,
            deckListsRequired: input.deckListsRequired,
          })
          .returning()

        await tx.insert(tournamentOrganizers).values({
          tournamentId: tournament.id,
          userId: ownerId,
          role: 'owner',
        })
        await tx.insert(auditEvents).values({
          tournamentId: tournament.id,
          actorId: ownerId,
          action: 'tournament.created',
          entityType: 'tournament',
          entityId: tournament.id,
        })
        return tournament
      })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code !== '23505' || attempt === 2) throw error
    }
  }

  throw new Error('Unable to create a tournament.')
}

export type UpdateTournamentInput = {
  name: string
  description: string | null
  roundCount: number
  gamesPerMatch: number
  roundTimeLimitMinutes: number
  topCutSize: number | null
  isPublic: boolean
  scheduledAt: Date | null
  timezone: string
  venue: string | null
  capacity: number | null
  deckListsRequired: boolean
  draftPickTimeSeconds: number
  draftPicksPerPack: number
  deckBuildingTimeMinutes: number
}

export async function updateTournament(tournamentId: string, userId: string, input: UpdateTournamentInput) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament) throw new Error('Tournament not found.')
    if (tournament.status === 'cancelled') throw new Error('A cancelled event cannot be edited.')

    const existingRounds = await tx.select({ isTopCut: rounds.isTopCut }).from(rounds).where(eq(rounds.tournamentId, tournamentId))
    const swissRounds = existingRounds.filter((round) => !round.isTopCut).length
    if (input.roundCount < swissRounds) throw new Error(`This event already has ${swissRounds} Swiss round${swissRounds === 1 ? '' : 's'}.`)
    if (existingRounds.length && input.gamesPerMatch !== tournament.gamesPerMatch) {
      throw new Error('Match format cannot change after pairings have been generated.')
    }
    if (existingRounds.length && input.topCutSize !== tournament.topCutSize) {
      throw new Error('Top cut cannot change after pairings have been generated.')
    }
    if (tournament.format === 'draft' && ['drafting', 'deck_building', 'complete'].includes(tournament.draftStatus) && (
      input.draftPickTimeSeconds !== tournament.draftPickTimeSeconds ||
      input.draftPicksPerPack !== tournament.draftPicksPerPack ||
      input.deckBuildingTimeMinutes !== tournament.deckBuildingTimeMinutes
    )) {
      throw new Error('Draft timing settings are locked after drafting begins.')
    }

    const [occupied] = await tx.select({ count: sql<number>`count(*)::int` }).from(tournamentParticipants).where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      inArray(tournamentParticipants.status, ['registered', 'checked_in', 'active']),
    ))
    if (input.capacity && input.capacity < occupied.count) {
      throw new Error(`Capacity cannot be lower than the current ${occupied.count} active players.`)
    }

    await tx.update(tournaments).set({
      name: input.name,
      description: input.description,
      roundCount: input.roundCount,
      gamesPerMatch: input.gamesPerMatch,
      roundTimeLimitMinutes: input.roundTimeLimitMinutes,
      topCutSize: input.topCutSize,
      isPublic: input.isPublic,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      venue: input.venue,
      capacity: input.capacity,
      deckListsRequired: input.deckListsRequired,
      draftPickTimeSeconds: input.draftPickTimeSeconds,
      draftPicksPerPack: input.draftPicksPerPack,
      deckBuildingTimeMinutes: input.deckBuildingTimeMinutes,
      updatedAt: new Date(),
    }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'tournament.updated', entityType: 'tournament', entityId: tournamentId })
  })
}

export async function cancelTournament(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [activeRound] = await tx.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active'))).limit(1)
    if (activeRound) throw new Error('Complete the active round before cancelling the event.')
    const [tournament] = await tx.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament) throw new Error('Tournament not found.')
    if (tournament.status === 'completed') throw new Error('A completed event cannot be cancelled.')
    if (tournament.status === 'cancelled') throw new Error('This event is already cancelled.')
    await tx.update(tournaments).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'tournament.cancelled', entityType: 'tournament', entityId: tournamentId })
  })
}

export async function addWalkInParticipant(tournamentId: string, actorId: string, guestName: string) {
  await assertOrganizer(tournamentId, actorId)
  return getDb().transaction(async (tx) => {
    const [activeRound] = await tx.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active'))).limit(1)
    if (activeRound) throw new Error('Complete the active round before adding a walk-in.')
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || !['registration', 'check_in', 'active'].includes(tournament.status)) throw new Error('Players cannot be added to this event now.')
    const [duplicate] = await tx.select({ id: tournamentParticipants.id }).from(tournamentParticipants).where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      sql`lower(${tournamentParticipants.guestName}) = lower(${guestName})`,
      inArray(tournamentParticipants.status, ['registered', 'checked_in', 'active']),
    )).limit(1)
    if (duplicate) throw new Error('A walk-in with that name is already active in this event.')
    if (tournament.capacity) {
      const [occupied] = await tx.select({ count: sql<number>`count(*)::int` }).from(tournamentParticipants).where(and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        inArray(tournamentParticipants.status, ['registered', 'checked_in', 'active']),
      ))
      if (occupied.count >= tournament.capacity) throw new Error('This event is at capacity.')
    }
    const status = tournament.status === 'check_in' ? 'checked_in' : tournament.status === 'active' ? 'active' : 'registered'
    const [participant] = await tx.insert(tournamentParticipants).values({
      tournamentId,
      userId: null,
      guestName,
      status,
      checkedInAt: status === 'checked_in' ? new Date() : null,
    }).returning()
    await tx.insert(auditEvents).values({ tournamentId, actorId, action: 'participant.walk_in_added', entityType: 'participant', entityId: participant.id, details: { guestName } })
    return participant
  })
}

export async function joinTournamentByAccessKey(userId: string, accessKey: string) {
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.accessKey, accessKey))
      .limit(1)

    if (!tournament) throw new Error('That access key was not found.')
    if (!['registration', 'check_in'].includes(tournament.status)) {
      throw new Error('Registration for this tournament is closed.')
    }

    const [existing] = await tx
      .select({ id: tournamentParticipants.id })
      .from(tournamentParticipants)
      .where(and(
        eq(tournamentParticipants.tournamentId, tournament.id),
        eq(tournamentParticipants.userId, userId),
      ))
      .limit(1)

    if (existing) return tournament.id

    if (tournament.capacity) {
      const [count] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentParticipants)
        .where(and(
          eq(tournamentParticipants.tournamentId, tournament.id),
          sql`${tournamentParticipants.status} not in ('dropped', 'disqualified')`,
        ))
      if (count.count >= tournament.capacity) {
        await tx.insert(tournamentParticipants).values({ tournamentId: tournament.id, userId, status: 'waitlisted' })
        await tx.insert(auditEvents).values({ tournamentId: tournament.id, actorId: userId, action: 'participant.waitlisted', entityType: 'participant', entityId: userId })
        return tournament.id
      }
    }

    const [profile] = await tx
      .select({ id: profiles.userId })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1)
    if (!profile) throw new Error('Your player profile is not available.')

    await tx.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      userId,
      status: 'registered',
    })
    await tx.insert(auditEvents).values({
      tournamentId: tournament.id,
      actorId: userId,
      action: 'participant.joined',
      entityType: 'participant',
      entityId: userId,
    })
    return tournament.id
  })
}

export async function joinPublicTournament(userId: string, tournamentId: string) {
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || !tournament.isPublic) throw new Error('That public tournament was not found.')
    if (!['registration', 'check_in'].includes(tournament.status)) throw new Error('Registration for this tournament is closed.')

    const [existing] = await tx
      .select({ id: tournamentParticipants.id })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
      .limit(1)
    if (existing) return tournamentId

    if (tournament.capacity) {
      const [count] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tournamentParticipants)
        .where(and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          sql`${tournamentParticipants.status} not in ('dropped', 'disqualified')`,
        ))
      if (count.count >= tournament.capacity) {
        await tx.insert(tournamentParticipants).values({ tournamentId, userId, status: 'waitlisted' })
        await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'participant.waitlisted', entityType: 'participant', entityId: userId })
        return tournamentId
      }
    }

    await tx.insert(tournamentParticipants).values({ tournamentId, userId, status: 'registered' })
    await tx.insert(auditEvents).values({
      tournamentId,
      actorId: userId,
      action: 'participant.joined',
      entityType: 'participant',
      entityId: userId,
    })
    return tournamentId
  })
}

export async function joinTournamentByInviteToken(userId: string, inviteToken: string) {
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.inviteToken, inviteToken)).limit(1)
    if (!tournament) throw new Error('That invite link is invalid or has expired.')
    if (!['registration', 'check_in'].includes(tournament.status)) throw new Error('Registration for this tournament is closed.')
    const [existing] = await tx.select({ id: tournamentParticipants.id }).from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournament.id), eq(tournamentParticipants.userId, userId))).limit(1)
    if (existing) return tournament.id
    if (tournament.capacity) {
      const [count] = await tx.select({ count: sql<number>`count(*)::int` }).from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournament.id), sql`${tournamentParticipants.status} not in ('dropped', 'disqualified')`))
      if (count.count >= tournament.capacity) {
        await tx.insert(tournamentParticipants).values({ tournamentId: tournament.id, userId, status: 'waitlisted' })
        await tx.insert(auditEvents).values({ tournamentId: tournament.id, actorId: userId, action: 'participant.waitlisted', entityType: 'participant', entityId: userId })
        return tournament.id
      }
    }
    await tx.insert(tournamentParticipants).values({ tournamentId: tournament.id, userId, status: 'registered' })
    await tx.insert(auditEvents).values({ tournamentId: tournament.id, actorId: userId, action: 'participant.joined_by_invite', entityType: 'participant', entityId: userId })
    return tournament.id
  })
}

export async function isTournamentOrganizer(tournamentId: string, userId: string) {
  const [organizer] = await getDb()
    .select({ id: tournamentOrganizers.id })
    .from(tournamentOrganizers)
    .where(and(
      eq(tournamentOrganizers.tournamentId, tournamentId),
      eq(tournamentOrganizers.userId, userId),
    ))
    .limit(1)
  return Boolean(organizer)
}

async function assertOrganizer(tournamentId: string, userId: string) {
  if (!(await isTournamentOrganizer(tournamentId, userId))) {
    throw new Error('Only an organizer can perform that action.')
  }
}

type DatabaseTransaction = Parameters<ReturnType<typeof getDb>['transaction']>[0] extends (tx: infer Transaction) => unknown ? Transaction : never

async function pairingPlayersForRound(
  tx: DatabaseTransaction,
  tournamentId: string,
  eligibleStatuses: Array<'registered' | 'checked_in' | 'active'>,
): Promise<PairingPlayer[]> {
  const activePlayers = await tx
    .select({
      participantId: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      guestName: tournamentParticipants.guestName,
      rating: tournamentParticipants.seedRating,
    })
    .from(tournamentParticipants)
    .leftJoin(profiles, eq(tournamentParticipants.userId, profiles.userId))
    .where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      inArray(tournamentParticipants.status, eligibleStatuses),
    ))

  const rows = await tx
    .select({
      matchId: matches.id,
      participantId: matchPlayers.participantId,
      result: matchPlayers.result,
      placement: matchPlayers.placement,
      gamesWon: matchPlayers.gamesWon,
      gamesDrawn: matchPlayers.gamesDrawn,
    })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.status, 'complete')))

  const completedByMatch = new Map<string, CompletedMatch>()
  for (const row of rows) {
    const existing = completedByMatch.get(row.matchId) ?? { playerResults: [] }
    existing.playerResults.push({
      participantId: row.participantId,
      result: row.result,
      placement: row.placement,
      gamesWon: row.gamesWon,
      gamesDrawn: row.gamesDrawn,
    })
    completedByMatch.set(row.matchId, existing)
  }

  const standings = calculateStandings(activePlayers.map((player) => ({
    participantId: player.participantId,
    userId: player.userId,
    username: player.username,
    displayName: player.displayName ?? player.guestName ?? 'Walk-in player',
    rating: player.rating,
  })), [...completedByMatch.values()])
  const opponents = new Map<string, Set<string>>()
  const byes = new Set<string>()
  for (const match of completedByMatch.values()) {
    if (match.playerResults.length === 1 && match.playerResults[0]?.result === 'bye') {
      byes.add(match.playerResults[0].participantId)
      continue
    }
    for (const player of match.playerResults) {
      const playerOpponents = opponents.get(player.participantId) ?? new Set<string>()
      for (const opponent of match.playerResults) {
        if (opponent.participantId !== player.participantId) playerOpponents.add(opponent.participantId)
      }
      opponents.set(player.participantId, playerOpponents)
    }
  }

  return standings.map((standing) => ({
    participantId: standing.participantId,
    matchPoints: standing.matchPoints,
    gameWinPercentage: standing.gameWinPercentage,
    rating: standing.rating,
    opponentIds: opponents.get(standing.participantId) ?? new Set<string>(),
    hasReceivedBye: byes.has(standing.participantId),
  }))
}

export async function openCheckIn(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament) throw new Error('Tournament not found.')
    if (tournament.status !== 'registration') throw new Error('Check-in can only open while registration is active.')
    await tx.update(tournaments).set({ status: 'check_in', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'check_in.opened', entityType: 'tournament', entityId: tournamentId })
  })
}

export async function checkInToTournament(tournamentId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || tournament.status !== 'check_in') throw new Error('Check-in is not open for this event.')
    const [participant] = await tx.select().from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId))).limit(1)
    if (!participant) throw new Error('Join this event before checking in.')
    if (participant.status === 'waitlisted') throw new Error('You are currently waitlisted. An organizer must promote you before you can check in.')
    if (participant.status !== 'registered') {
      if (participant.status === 'checked_in') return
      throw new Error('You cannot check in to this event right now.')
    }
    await tx.update(tournamentParticipants).set({ status: 'checked_in', checkedInAt: new Date() }).where(eq(tournamentParticipants.id, participant.id))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'participant.checked_in', entityType: 'participant', entityId: participant.id })
  })
}

export async function generateDraftSeating(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || tournament.format !== 'draft') throw new Error('Draft seating is available only for Booster Draft events.')
    if (!['registration', 'check_in'].includes(tournament.status)) throw new Error('Draft seating is not available at this stage of the event.')
    if (['drafting', 'deck_building', 'complete'].includes(tournament.draftStatus)) throw new Error('Draft seating is locked after drafting begins.')
    const [existingRound] = await tx.select({ id: rounds.id }).from(rounds).where(eq(rounds.tournamentId, tournamentId)).limit(1)
    if (existingRound) throw new Error('Draft seating cannot change after tournament pairings begin.')

    const eligibleStatuses = tournament.status === 'check_in' ? ['checked_in', 'active'] as const : ['registered', 'checked_in', 'active'] as const
    const participants = await tx.select({ id: tournamentParticipants.id }).from(tournamentParticipants).where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      inArray(tournamentParticipants.status, [...eligibleStatuses]),
    )).orderBy(tournamentParticipants.createdAt)
    const seatedPods = seatDraftPods(participants, () => randomInt(0, 1_000_000) / 1_000_000)

    await tx.delete(draftPods).where(eq(draftPods.tournamentId, tournamentId))
    for (const [podIndex, podParticipants] of seatedPods.entries()) {
      const [pod] = await tx.insert(draftPods).values({ tournamentId, podNumber: podIndex + 1 }).returning({ id: draftPods.id })
      await tx.insert(draftPodSeats).values(podParticipants.map((participant, seatIndex) => ({
        podId: pod.id,
        participantId: participant.id,
        seat: seatIndex + 1,
      })))
    }
    await tx.update(tournaments).set({ draftStatus: 'seating', draftPack: 0, draftPick: 0, draftStepEndsAt: null, updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'draft.seated', entityType: 'tournament', entityId: tournamentId, details: { podCount: seatedPods.length, playerCount: participants.length } })
    return seatedPods.length
  })
}

export async function startDeckBuilding(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || tournament.format !== 'draft') throw new Error('This is not a Booster Draft event.')
    if (!['registration', 'check_in'].includes(tournament.status)) throw new Error('Deck building cannot be started now.')
    if (!['seating', 'drafting'].includes(tournament.draftStatus)) throw new Error('Generate draft seating before starting deck building.')
    const [seat] = await tx.select({ id: draftPodSeats.id }).from(draftPodSeats).innerJoin(draftPods, eq(draftPodSeats.podId, draftPods.id)).where(eq(draftPods.tournamentId, tournamentId)).limit(1)
    if (!seat) throw new Error('Generate draft seating before starting deck building.')
    await tx.update(tournaments).set({
      draftStatus: 'deck_building',
      draftPack: 0,
      draftPick: 0,
      draftStepEndsAt: new Date(Date.now() + tournament.deckBuildingTimeMinutes * 60_000),
      updatedAt: new Date(),
    }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'draft.deck_building_started', entityType: 'tournament', entityId: tournamentId })
  })
}

export async function completeDraft(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || tournament.format !== 'draft') throw new Error('This is not a Booster Draft event.')
    if (tournament.status === 'cancelled') throw new Error('This event is cancelled.')
    if (tournament.draftStatus === 'complete') return
    await tx.update(tournaments).set({ draftStatus: 'complete', draftStepEndsAt: null, updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'draft.completed', entityType: 'tournament', entityId: tournamentId, details: { skipped: tournament.draftStatus === 'not_started' } })
  })
}

export async function promoteWaitlist(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament?.capacity) throw new Error('This event does not have a capacity limit.')
    if (!['registration', 'check_in', 'active'].includes(tournament.status)) throw new Error('The waitlist cannot be promoted at this stage of the event.')
    const [occupied] = await tx.select({ count: sql<number>`count(*)::int` }).from(tournamentParticipants).where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      inArray(tournamentParticipants.status, ['registered', 'checked_in', 'active']),
    ))
    const available = Math.max(0, tournament.capacity - occupied.count)
    if (!available) throw new Error('There are no open seats to promote from the waitlist.')
    const waiting = await tx.select().from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.status, 'waitlisted'))).orderBy(asc(tournamentParticipants.createdAt)).limit(available)
    if (!waiting.length) throw new Error('There are no players on the waitlist.')
    await tx.update(tournamentParticipants).set({ status: 'registered' }).where(inArray(tournamentParticipants.id, waiting.map((participant) => participant.id)))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'waitlist.promoted', entityType: 'tournament', entityId: tournamentId, details: { participantIds: waiting.map((participant) => participant.id) } })
    return waiting.length
  })
}

export async function removeParticipant(tournamentId: string, actorId: string, participantId: string) {
  await assertOrganizer(tournamentId, actorId)
  return getDb().transaction(async (tx) => {
    const [activeRound] = await tx.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active'))).limit(1)
    if (activeRound) throw new Error('Complete the active round before changing the participant list.')
    const [participant] = await tx.select().from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.id, participantId))).limit(1)
    if (!participant || ['dropped', 'disqualified'].includes(participant.status)) throw new Error('That player is no longer active in this event.')
    const [tournament] = await tx.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || !['registration', 'check_in', 'active'].includes(tournament.status)) throw new Error('Players cannot be removed at this stage of the event.')
    await tx.update(tournamentParticipants).set({ status: 'dropped', droppedAt: new Date() }).where(eq(tournamentParticipants.id, participant.id))
    await tx.insert(auditEvents).values({ tournamentId, actorId, action: 'participant.removed', entityType: 'participant', entityId: participant.id, details: { userId: participant.userId, guestName: participant.guestName } })
  })
}

async function participantLinks(tx: DatabaseTransaction, participantIds: string[]) {
  const participants = await tx
    .select({ id: tournamentParticipants.id, userId: tournamentParticipants.userId })
    .from(tournamentParticipants)
    .where(inArray(tournamentParticipants.id, participantIds))
  if (participants.length !== participantIds.length) throw new Error('A paired participant is no longer available.')
  return new Map(participants.map((participant) => [participant.id, participant]))
}

async function startNextTopCutRound(
  tx: DatabaseTransaction,
  tournament: typeof tournaments.$inferSelect,
  userId: string,
) {
  if (!tournament.topCutSize) throw new Error('This event does not have a top cut configured.')
  if (tournament.format === 'commander' && tournament.commanderMode === 'pods') {
    throw new Error('Top cut is currently available for 1v1 events only.')
  }

  const allRounds = await tx.select().from(rounds).where(eq(rounds.tournamentId, tournament.id)).orderBy(rounds.roundNumber)
  if (allRounds.some((round) => round.status === 'active')) throw new Error('Complete the active round before generating the bracket.')
  const topCutRounds = allRounds.filter((round) => round.isTopCut)
  let participantIds: string[]

  if (!topCutRounds.length) {
    const ranked = await pairingPlayersForRound(tx, tournament.id, ['active', 'checked_in', 'registered'])
    if (ranked.length < tournament.topCutSize) throw new Error(`At least ${tournament.topCutSize} players are needed for this top cut.`)
    participantIds = ranked.slice(0, tournament.topCutSize).map((player) => player.participantId)
  } else {
    const previous = topCutRounds.at(-1)!
    const previousMatches = await tx.select().from(matches).where(and(eq(matches.roundId, previous.id), eq(matches.status, 'complete'))).orderBy(matches.tableNumber)
    const winners: string[] = []
    for (const match of previousMatches) {
      const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, match.id)).orderBy(matchPlayers.seat)
      const winner = players.find((player) => player.result === 'win' || player.result === 'bye')
      if (!winner) throw new Error('Every top-cut match needs a winner before the next bracket round can start.')
      winners.push(winner.participantId)
    }
    if (winners.length < 2) {
      await tx.update(tournaments).set({ status: 'completed', updatedAt: new Date() }).where(eq(tournaments.id, tournament.id))
      return null
    }
    participantIds = winners
  }

  const [round] = await tx.insert(rounds).values({
    tournamentId: tournament.id,
    roundNumber: (allRounds.at(-1)?.roundNumber ?? 0) + 1,
    stage: 'top_cut',
    isTopCut: true,
    status: 'active',
    startsAt: new Date(),
    endsAt: new Date(Date.now() + tournament.roundTimeLimitMinutes * 60_000),
  }).returning()

  const links = await participantLinks(tx, participantIds)
  for (let index = 0; index < participantIds.length / 2; index += 1) {
    const [match] = await tx.insert(matches).values({
      tournamentId: tournament.id,
      roundId: round.id,
      kind: 'head_to_head',
      tableNumber: index + 1,
      status: 'pending',
    }).returning({ id: matches.id })
    const first = participantIds[index]
    const second = participantIds[participantIds.length - 1 - index]
    await tx.insert(matchPlayers).values([
      { matchId: match.id, participantId: first, userId: links.get(first)?.userId ?? null, seat: 1 },
      { matchId: match.id, participantId: second, userId: links.get(second)?.userId ?? null, seat: 2 },
    ])
  }
  await tx.insert(auditEvents).values({
    tournamentId: tournament.id,
    actorId: userId,
    action: 'top_cut.round_started',
    entityType: 'round',
    entityId: round.id,
    details: { playerCount: participantIds.length },
  })
  return round
}

export async function startNextRound(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)

  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament) throw new Error('Tournament not found.')
    if (tournament.status === 'top_cut') {
      return startNextTopCutRound(tx, tournament, userId)
    }
    if (!['registration', 'check_in', 'active'].includes(tournament.status)) {
      throw new Error('This tournament cannot start another Swiss round.')
    }
    const existingRounds = await tx
      .select({ id: rounds.id, status: rounds.status, isTopCut: rounds.isTopCut })
      .from(rounds)
      .where(eq(rounds.tournamentId, tournamentId))
    if (tournament.format === 'draft' && !existingRounds.length && !['deck_building', 'complete'].includes(tournament.draftStatus)) {
      throw new Error('Start deck building before generating round one pairings.')
    }
    if (existingRounds.some((round) => round.status === 'active')) {
      throw new Error('Complete the active round before generating another one.')
    }
    if (existingRounds.filter((round) => !round.isTopCut).length >= tournament.roundCount) {
      throw new Error('All scheduled Swiss rounds have already been generated.')
    }

    const eligibleStatuses = tournament.status === 'check_in' ? ['checked_in', 'active'] as const : ['registered', 'checked_in', 'active'] as const
    const players = await pairingPlayersForRound(tx, tournamentId, [...eligibleStatuses])
    const minimumPlayers = tournament.format === 'commander' && tournament.commanderMode === 'pods' ? 3 : 2
    if (players.length < minimumPlayers) {
      throw new Error(`At least ${minimumPlayers} active players are needed to start this event.`)
    }

    const proposed = tournament.format === 'commander' && tournament.commanderMode === 'pods'
      ? createCommanderPodPairings(players, (tournament.podSize ?? 4) as 3 | 4)
      : createSwissPairings(players)
    const roundNumber = existingRounds.length + 1
    const endsAt = new Date(Date.now() + tournament.roundTimeLimitMinutes * 60_000)
    const [round] = await tx
      .insert(rounds)
      .values({
        tournamentId,
        roundNumber,
        status: 'active',
        startsAt: new Date(),
        endsAt,
      })
      .returning()

    const allParticipantIds = proposed.flatMap((pairing) => pairing.participantIds)
    const links = await participantLinks(tx, allParticipantIds)
    for (const [index, pairing] of proposed.entries()) {
      const isBye = pairing.kind === 'bye'
      const [match] = await tx
        .insert(matches)
        .values({
          tournamentId,
          roundId: round.id,
          kind: pairing.kind === 'commander_pod' ? 'commander_pod' : 'head_to_head',
          tableNumber: isBye ? null : index + 1,
          status: isBye ? 'complete' : 'pending',
          completedAt: isBye ? new Date() : null,
        })
        .returning({ id: matches.id })
      await tx.insert(matchPlayers).values(pairing.participantIds.map((participantId, seat) => ({
        matchId: match.id,
        participantId,
        userId: links.get(participantId)?.userId ?? null,
        seat: seat + 1,
        result: (isBye ? 'bye' : null) as 'bye' | null,
        gamesWon: isBye ? Math.ceil(tournament.gamesPerMatch / 2) : 0,
      })))
    }

    await tx
      .update(tournamentParticipants)
      .set({ status: 'active' })
      .where(and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        inArray(tournamentParticipants.status, [...eligibleStatuses]),
      ))
    const beginsDraftRoundOne = tournament.format === 'draft' && existingRounds.length === 0
    await tx.update(tournaments).set({
      status: 'active',
      draftStatus: beginsDraftRoundOne ? 'complete' : tournament.draftStatus,
      draftStepEndsAt: beginsDraftRoundOne ? null : tournament.draftStepEndsAt,
      updatedAt: new Date(),
    }).where(eq(tournaments.id, tournamentId))
    await tx.insert(auditEvents).values({
      tournamentId,
      actorId: userId,
      action: 'round.started',
      entityType: 'round',
      entityId: round.id,
      details: { roundNumber, pairingCount: proposed.length },
    })
    return round
  })
}

export async function resetActiveRound(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const [activeRound] = await tx.select().from(rounds).where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active'))).limit(1)
    if (!activeRound) throw new Error('There is no active round to reset.')
    const roundMatches = await tx.select().from(matches).where(eq(matches.roundId, activeRound.id))
    for (const match of roundMatches) {
      if (match.status === 'pending') continue
      const players = await tx.select({ result: matchPlayers.result }).from(matchPlayers).where(eq(matchPlayers.matchId, match.id))
      const isAutomaticBye = match.status === 'complete' && players.length === 1 && players[0]?.result === 'bye'
      if (!isAutomaticBye) throw new Error('A round cannot be reset after a result has been reported. Correct individual results instead.')
    }
    await tx.delete(rounds).where(eq(rounds.id, activeRound.id))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'round.reset', entityType: 'round', entityId: activeRound.id, details: { roundNumber: activeRound.roundNumber } })
  })
}

export async function swapActiveRoundPlayers(tournamentId: string, userId: string, firstMatchPlayerId: string, secondMatchPlayerId: string) {
  await assertOrganizer(tournamentId, userId)
  if (firstMatchPlayerId === secondMatchPlayerId) throw new Error('Choose two different players to swap.')
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const rows = await tx.select({
      id: matchPlayers.id,
      matchId: matchPlayers.matchId,
      participantId: matchPlayers.participantId,
      userId: matchPlayers.userId,
      roundId: matches.roundId,
      matchStatus: matches.status,
      result: matchPlayers.result,
    }).from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .where(and(
        eq(matches.tournamentId, tournamentId),
        eq(rounds.status, 'active'),
        inArray(matchPlayers.id, [firstMatchPlayerId, secondMatchPlayerId]),
      ))
    if (rows.length !== 2) throw new Error('Both players must belong to the active round.')
    const [first, second] = rows
    if (first.roundId !== second.roundId || first.matchId === second.matchId) throw new Error('Choose players at two different tables.')
    const editable = (row: typeof first) => row.matchStatus === 'pending' || (row.matchStatus === 'complete' && row.result === 'bye')
    if (!editable(first) || !editable(second)) throw new Error('Players cannot move after a result has been reported at either table.')

    await tx.update(matchPlayers).set({ participantId: second.participantId, userId: second.userId }).where(eq(matchPlayers.id, first.id))
    await tx.update(matchPlayers).set({ participantId: first.participantId, userId: first.userId }).where(eq(matchPlayers.id, second.id))
    await tx.insert(auditEvents).values({ tournamentId, actorId: userId, action: 'round.players_swapped', entityType: 'round', entityId: first.roundId, details: { firstMatchPlayerId, secondMatchPlayerId } })
  })
}

export async function completeActiveRound(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)

  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tournamentId}))`)
    const [activeRound] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active')))
      .limit(1)
    if (!activeRound) throw new Error('There is no active round to complete.')

    const [unfinished] = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.roundId, activeRound.id), inArray(matches.status, ['pending', 'reported', 'confirmed'])))
      .limit(1)
    if (unfinished) throw new Error('Every match must be finalized or overridden before ending the round.')

    await tx.update(rounds).set({ status: 'completed' }).where(eq(rounds.id, activeRound.id))
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (tournament && activeRound.isTopCut) {
      const topCutMatches = await tx.select({ id: matches.id }).from(matches).where(eq(matches.roundId, activeRound.id))
      if (topCutMatches.length === 1) {
        const finalists = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, topCutMatches[0].id))
        const winner = finalists.find((player) => player.result === 'win' || player.result === 'bye')
        if (winner) {
          await tx.update(tournamentParticipants).set({ finalStanding: 1 }).where(eq(tournamentParticipants.id, winner.participantId))
          const runnerUp = finalists.find((player) => player.participantId !== winner.participantId)
          if (runnerUp) await tx.update(tournamentParticipants).set({ finalStanding: 2 }).where(eq(tournamentParticipants.id, runnerUp.participantId))
        }
        await tx.update(tournaments).set({ status: 'completed', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
      } else {
        await tx.update(tournaments).set({ status: 'top_cut', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
      }
    } else if (tournament && activeRound.roundNumber >= tournament.roundCount) {
      await tx.update(tournaments).set({ status: tournament.topCutSize ? 'top_cut' : 'completed', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
    }
    await tx.insert(auditEvents).values({
      tournamentId,
      actorId: userId,
      action: 'round.completed',
      entityType: 'round',
      entityId: activeRound.id,
      details: { roundNumber: activeRound.roundNumber },
    })
  })
}

export type MatchResultInput = {
  players: Array<{
    participantId: string
    gamesWon: number
    gamesDrawn?: number
    placement?: number | null
  }>
}

function resultForHeadToHead(players: MatchResultInput['players']) {
  if (players.length !== 2) throw new Error('A head-to-head result must contain exactly two players.')
  const [first, second] = players
  if (first.gamesWon === second.gamesWon) return ['draw', 'draw'] as const
  return first.gamesWon > second.gamesWon ? ['win', 'loss'] as const : ['loss', 'win'] as const
}

async function applyRatingsForMatch(tx: DatabaseTransaction, matchId: string) {
  const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match || match.ratingsAppliedAt || match.status !== 'complete') return
  const [tournament] = await tx.select({ format: tournaments.format }).from(tournaments).where(eq(tournaments.id, match.tournamentId)).limit(1)
  const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)).orderBy(matchPlayers.seat)
  if (!tournament || players.length < 2) {
    await tx.update(matches).set({ ratingsAppliedAt: new Date() }).where(eq(matches.id, matchId))
    return
  }

  const accountUserIds = players.flatMap((player) => player.userId ? [player.userId] : [])
  if (!accountUserIds.length) {
    await tx.update(matches).set({ ratingsAppliedAt: new Date() }).where(eq(matches.id, matchId))
    return
  }
  const currentRatings = await tx.select().from(playerRatings).where(and(
    eq(playerRatings.format, tournament.format),
    inArray(playerRatings.userId, accountUserIds),
  ))
  const ratings = new Map(currentRatings.map((rating) => [rating.userId, rating]))
  const ratingFor = (userId: string | null) => userId ? ratings.get(userId)?.rating ?? 1200 : 1200

  for (const player of players) {
    if (!player.userId) continue
    const opponents = players.filter((opponent) => opponent.participantId !== player.participantId)
    const expected = opponents.reduce((total, opponent) => total + 1 / (1 + 10 ** ((ratingFor(opponent.userId) - ratingFor(player.userId)) / 400)), 0) / opponents.length
    const actual = opponents.reduce((total, opponent) => {
      if (match.kind === 'commander_pod') return total + ((player.placement ?? 99) < (opponent.placement ?? 99) ? 1 : 0)
      if (player.result === 'draw') return total + 0.5
      return total + (player.result === 'win' ? 1 : 0)
    }, 0) / opponents.length
    const delta = Math.round(32 * (actual - expected))
    const existing = ratings.get(player.userId)
    const won = player.result === 'win' || (match.kind === 'commander_pod' && player.placement === 1)
    const drawn = player.result === 'draw'
    const lost = !won && !drawn
    await tx.insert(matchRatingAdjustments).values({
      matchId,
      userId: player.userId,
      format: tournament.format,
      ratingDelta: delta,
      winsDelta: Number(won),
      lossesDelta: Number(lost),
      drawsDelta: Number(drawn),
    })
    await tx.insert(playerRatings).values({
      userId: player.userId,
      format: tournament.format,
      rating: (existing?.rating ?? 1200) + delta,
      wins: (existing?.wins ?? 0) + Number(won),
      losses: (existing?.losses ?? 0) + Number(lost),
      draws: (existing?.draws ?? 0) + Number(drawn),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [playerRatings.userId, playerRatings.format],
      set: {
        rating: (existing?.rating ?? 1200) + delta,
        wins: (existing?.wins ?? 0) + Number(won),
        losses: (existing?.losses ?? 0) + Number(lost),
        draws: (existing?.draws ?? 0) + Number(drawn),
        updatedAt: new Date(),
      },
    })
  }
  await tx.update(matches).set({ ratingsAppliedAt: new Date() }).where(eq(matches.id, matchId))
}

async function revertRatingsForMatch(tx: DatabaseTransaction, matchId: string) {
  const [match] = await tx.select({ ratingsAppliedAt: matches.ratingsAppliedAt }).from(matches).where(eq(matches.id, matchId)).limit(1)
  const adjustments = await tx.select().from(matchRatingAdjustments).where(eq(matchRatingAdjustments.matchId, matchId))
  // Matches finalized before rating adjustments were introduced cannot be
  // reversed exactly. Keep their legacy rating effect in place while still
  // allowing the tournament result and standings to be corrected.
  if (match?.ratingsAppliedAt && !adjustments.length) return false
  for (const adjustment of adjustments) {
    await tx.update(playerRatings).set({
      rating: sql`${playerRatings.rating} - ${adjustment.ratingDelta}`,
      wins: sql`greatest(0, ${playerRatings.wins} - ${adjustment.winsDelta})`,
      losses: sql`greatest(0, ${playerRatings.losses} - ${adjustment.lossesDelta})`,
      draws: sql`greatest(0, ${playerRatings.draws} - ${adjustment.drawsDelta})`,
      updatedAt: new Date(),
    }).where(and(eq(playerRatings.userId, adjustment.userId), eq(playerRatings.format, adjustment.format)))
  }
  await tx.delete(matchRatingAdjustments).where(eq(matchRatingAdjustments.matchId, matchId))
  await tx.update(matches).set({ ratingsAppliedAt: null }).where(eq(matches.id, matchId))
  return true
}

export async function reportMatchResult(matchId: string, userId: string, input: MatchResultInput) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`)
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) throw new Error('Match not found.')
    if (match.status === 'complete') throw new Error('This match is already final.')
    return writeMatchResult(tx, match, userId, input, false)
  })
}

export async function correctMatchResult(matchId: string, userId: string, input: MatchResultInput) {
  await assertOrganizerForMatch(matchId, userId)
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`)
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) throw new Error('Match not found.')
    if (match.status !== 'complete') throw new Error('Only a finalized result needs correction.')
    await revertRatingsForMatch(tx, matchId)
    return writeMatchResult(tx, match, userId, input, true)
  })
}

async function assertOrganizerForMatch(matchId: string, userId: string) {
  const [match] = await getDb().select({ tournamentId: matches.tournamentId }).from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw new Error('Match not found.')
  await assertOrganizer(match.tournamentId, userId)
}

async function writeMatchResult(
  tx: DatabaseTransaction,
  match: typeof matches.$inferSelect,
  userId: string,
  input: MatchResultInput,
  isCorrection: boolean,
) {
  const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, match.id)).orderBy(matchPlayers.seat)
  const expectedPlayerIds = new Set(players.map((player) => player.participantId))
  const submittedPlayerIds = new Set(input.players.map((player) => player.participantId))
  if (submittedPlayerIds.size !== expectedPlayerIds.size || [...expectedPlayerIds].some((id) => !submittedPlayerIds.has(id))) {
    throw new Error('A result must include every player assigned to this match.')
  }

  const reporterIsPlayer = players.some((player) => player.userId === userId)
  const [organizer] = await tx
    .select({ id: tournamentOrganizers.id })
    .from(tournamentOrganizers)
    .where(and(eq(tournamentOrganizers.tournamentId, match.tournamentId), eq(tournamentOrganizers.userId, userId)))
    .limit(1)
  if (!reporterIsPlayer && !organizer) throw new Error('Only a match player or organizer can report this result.')
  if (isCorrection && !organizer) throw new Error('Only an organizer can correct a finalized result.')

  const resultByPlayer = new Map<string, 'win' | 'loss' | 'draw' | 'placement'>()
  if (match.kind === 'head_to_head') {
    const [tournament] = await tx.select({ gamesPerMatch: tournaments.gamesPerMatch }).from(tournaments).where(eq(tournaments.id, match.tournamentId)).limit(1)
    if (!tournament) throw new Error('Tournament not found.')
    validateHeadToHeadScores(input.players, tournament.gamesPerMatch)
    const results = resultForHeadToHead(input.players)
    const [round] = await tx.select({ isTopCut: rounds.isTopCut }).from(rounds).where(eq(rounds.id, match.roundId)).limit(1)
    if (round?.isTopCut && results[0] === 'draw') throw new Error('Top-cut matches must have a winner.')
    input.players.forEach((player, index) => resultByPlayer.set(player.participantId, results[index]))
  } else {
    if (input.players.some((player) => !Number.isInteger(player.gamesWon) || player.gamesWon < 0 || !Number.isInteger(player.gamesDrawn ?? 0) || (player.gamesDrawn ?? 0) < 0)) {
      throw new Error('Scores must be non-negative whole numbers.')
    }
    const placements = input.players.map((player) => player.placement)
    const validPlacements = placements.every((placement) => Number.isInteger(placement) && (placement as number) >= 1 && (placement as number) <= players.length)
    if (!validPlacements || new Set(placements).size !== players.length) {
      throw new Error('Commander pod results require a unique placement for every player.')
    }
    input.players.forEach((player) => resultByPlayer.set(player.participantId, 'placement'))
  }

  const matchPlayerByParticipant = new Map(players.map((player) => [player.participantId, player]))
  for (const player of input.players) {
    const linkedPlayer = matchPlayerByParticipant.get(player.participantId)
    await tx
      .update(matchPlayers)
      .set({
        gamesWon: player.gamesWon,
        gamesDrawn: player.gamesDrawn ?? 0,
        placement: match.kind === 'commander_pod' ? player.placement ?? null : null,
        result: resultByPlayer.get(player.participantId),
        confirmedAt: linkedPlayer?.userId === userId || organizer ? new Date() : null,
      })
      .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.participantId, player.participantId)))
  }

  await tx.update(matches).set({
      status: organizer ? 'complete' : 'reported',
      reportedById: userId,
      isAdminOverride: Boolean(organizer && !reporterIsPlayer),
      completedAt: organizer ? new Date() : null,
    }).where(eq(matches.id, match.id))
  if (isCorrection && organizer) {
    const [round] = await tx.select({ isTopCut: rounds.isTopCut }).from(rounds).where(eq(rounds.id, match.roundId)).limit(1)
    if (round?.isTopCut) {
      const roundMatches = await tx.select({ id: matches.id }).from(matches).where(eq(matches.roundId, match.roundId))
      if (roundMatches.length === 1) {
        const winner = input.players.find((player) => resultByPlayer.get(player.participantId) === 'win')
        const runnerUp = input.players.find((player) => player.participantId !== winner?.participantId)
        await tx.update(tournamentParticipants).set({ finalStanding: null }).where(inArray(tournamentParticipants.id, input.players.map((player) => player.participantId)))
        if (winner) await tx.update(tournamentParticipants).set({ finalStanding: 1 }).where(eq(tournamentParticipants.id, winner.participantId))
        if (runnerUp) await tx.update(tournamentParticipants).set({ finalStanding: 2 }).where(eq(tournamentParticipants.id, runnerUp.participantId))
      }
    }
  }
  if (organizer) await applyRatingsForMatch(tx, match.id)
  await tx.insert(auditEvents).values({
      tournamentId: match.tournamentId,
      actorId: userId,
      action: isCorrection ? 'match.corrected' : organizer && !reporterIsPlayer ? 'match.overridden' : 'match.reported',
      entityType: 'match',
      entityId: match.id,
    })
}

export async function confirmMatchResult(matchId: string, userId: string) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`)
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) throw new Error('Match not found.')
    if (match.status === 'complete') return
    if (match.status !== 'reported') throw new Error('There is no score awaiting confirmation.')

    const [player] = await tx
      .select({ id: matchPlayers.id })
      .from(matchPlayers)
      .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)))
      .limit(1)
    const [organizer] = player ? [] : await tx
      .select({ id: tournamentOrganizers.id })
      .from(tournamentOrganizers)
      .where(and(eq(tournamentOrganizers.tournamentId, match.tournamentId), eq(tournamentOrganizers.userId, userId)))
      .limit(1)
    if (!player && !organizer) throw new Error('Only a match player or organizer can confirm this result.')

    if (organizer) await tx.update(matchPlayers).set({ confirmedAt: new Date() }).where(eq(matchPlayers.matchId, matchId))
    else await tx.update(matchPlayers).set({ confirmedAt: new Date() }).where(eq(matchPlayers.id, player!.id))
    const confirmations = await tx
      .select({ id: matchPlayers.id, confirmedAt: matchPlayers.confirmedAt })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId))
    const isConfirmed = confirmations.length > 0 && confirmations.every((entry) => entry.confirmedAt)
    if (isConfirmed) {
      await tx.update(matches).set({ status: 'complete', completedAt: new Date() }).where(eq(matches.id, matchId))
      await applyRatingsForMatch(tx, matchId)
      await tx.insert(auditEvents).values({
        tournamentId: match.tournamentId,
        actorId: userId,
        action: organizer ? 'match.confirmed_by_organizer' : 'match.confirmed',
        entityType: 'match',
        entityId: matchId,
      })
    }
  })
}

export async function submitStandardDeckList(
  tournamentId: string,
  userId: string,
  input: { name?: string; listText?: string; sourceDeckId?: string },
) {
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament || tournament.format !== 'standard') {
      throw new Error('Deck registration is available only for Standard events.')
    }
    const [participant] = await tx
      .select({ id: tournamentParticipants.id, status: tournamentParticipants.status })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)))
      .limit(1)
    if (!participant || participant.status === 'waitlisted') throw new Error('Join this event before submitting a deck list.')

    const sourceDeck = input.sourceDeckId
      ? (await tx.select().from(userDecks).where(and(eq(userDecks.id, input.sourceDeckId), eq(userDecks.userId, userId), eq(userDecks.format, 'standard'))).limit(1))[0]
      : null
    if (input.sourceDeckId && !sourceDeck) throw new Error('That saved deck is no longer available.')
    const name = sourceDeck?.name ?? input.name?.trim()
    const listText = sourceDeck?.listText ?? input.listText?.trim()
    if (!name || !listText) throw new Error('Provide a deck name and MTG Arena export.')
    const parsed = validateStandardArenaDecklist(listText)

    const [existing] = await tx
      .select({ id: deckLists.id, status: deckLists.status })
      .from(deckLists)
      .where(and(eq(deckLists.tournamentId, tournamentId), eq(deckLists.userId, userId)))
      .limit(1)
    if (existing?.status === 'locked') throw new Error('The organizer has locked deck registration for this event.')

    const now = new Date()
    await tx
      .insert(deckLists)
      .values({
        tournamentId,
        userId,
        sourceDeckId: sourceDeck?.id ?? null,
        name,
        listText,
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [deckLists.tournamentId, deckLists.userId],
        set: {
          sourceDeckId: sourceDeck?.id ?? null,
          name,
          listText,
          status: 'submitted',
          submittedAt: now,
          updatedAt: now,
        },
      })
    await tx.insert(auditEvents).values({
      tournamentId,
      actorId: userId,
      action: 'deck_list.submitted',
      entityType: 'deck_list',
      entityId: existing?.id,
      details: {
        mainDeckCount: parsed.mainDeckCount,
        sideboardCount: parsed.sideboardCount,
        companionCount: parsed.companionCount,
      },
    })
    return parsed
  })
}
