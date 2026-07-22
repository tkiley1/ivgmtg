import { randomBytes } from 'crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  auditEvents,
  deckLists,
  matchPlayers,
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
import { createCommanderPodPairings, createSwissPairings, type PairingPlayer } from './pairing'
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
      userId: tournamentParticipants.userId,
      username: profiles.username,
      rating: tournamentParticipants.seedRating,
    })
    .from(tournamentParticipants)
    .innerJoin(profiles, eq(tournamentParticipants.userId, profiles.userId))
    .where(and(
      eq(tournamentParticipants.tournamentId, tournamentId),
      inArray(tournamentParticipants.status, eligibleStatuses),
    ))

  const rows = await tx
    .select({
      matchId: matches.id,
      userId: matchPlayers.userId,
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
      userId: row.userId,
      result: row.result,
      placement: row.placement,
      gamesWon: row.gamesWon,
      gamesDrawn: row.gamesDrawn,
    })
    completedByMatch.set(row.matchId, existing)
  }

  const standings = calculateStandings(activePlayers, [...completedByMatch.values()])
  const opponents = new Map<string, Set<string>>()
  const byes = new Set<string>()
  for (const match of completedByMatch.values()) {
    if (match.playerResults.length === 1 && match.playerResults[0]?.result === 'bye') {
      byes.add(match.playerResults[0].userId)
      continue
    }
    for (const player of match.playerResults) {
      const playerOpponents = opponents.get(player.userId) ?? new Set<string>()
      for (const opponent of match.playerResults) {
        if (opponent.userId !== player.userId) playerOpponents.add(opponent.userId)
      }
      opponents.set(player.userId, playerOpponents)
    }
  }

  return standings.map((standing) => ({
    userId: standing.userId,
    matchPoints: standing.matchPoints,
    gameWinPercentage: standing.gameWinPercentage,
    rating: standing.rating,
    opponentIds: opponents.get(standing.userId) ?? new Set<string>(),
    hasReceivedBye: byes.has(standing.userId),
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

export async function promoteWaitlist(tournamentId: string, userId: string) {
  await assertOrganizer(tournamentId, userId)
  return getDb().transaction(async (tx) => {
    const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
    if (!tournament?.capacity) throw new Error('This event does not have a capacity limit.')
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

export async function removeParticipant(tournamentId: string, actorId: string, participantUserId: string) {
  await assertOrganizer(tournamentId, actorId)
  return getDb().transaction(async (tx) => {
    const [activeRound] = await tx.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, 'active'))).limit(1)
    if (activeRound) throw new Error('Complete the active round before changing the participant list.')
    const [participant] = await tx.select().from(tournamentParticipants).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, participantUserId))).limit(1)
    if (!participant || ['dropped', 'disqualified'].includes(participant.status)) throw new Error('That player is no longer active in this event.')
    await tx.update(tournamentParticipants).set({ status: 'dropped', droppedAt: new Date() }).where(eq(tournamentParticipants.id, participant.id))
    await tx.insert(auditEvents).values({ tournamentId, actorId, action: 'participant.removed', entityType: 'participant', entityId: participant.id, details: { userId: participantUserId } })
  })
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
  let playerIds: string[]

  if (!topCutRounds.length) {
    const ranked = await pairingPlayersForRound(tx, tournament.id, ['active', 'checked_in', 'registered'])
    if (ranked.length < tournament.topCutSize) throw new Error(`At least ${tournament.topCutSize} players are needed for this top cut.`)
    playerIds = ranked.slice(0, tournament.topCutSize).map((player) => player.userId)
  } else {
    const previous = topCutRounds.at(-1)!
    const previousMatches = await tx.select().from(matches).where(and(eq(matches.roundId, previous.id), eq(matches.status, 'complete'))).orderBy(matches.tableNumber)
    const winners: string[] = []
    for (const match of previousMatches) {
      const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, match.id)).orderBy(matchPlayers.seat)
      const winner = players.find((player) => player.result === 'win' || player.result === 'bye')
      if (!winner) throw new Error('Every top-cut match needs a winner before the next bracket round can start.')
      winners.push(winner.userId)
    }
    if (winners.length < 2) {
      await tx.update(tournaments).set({ status: 'completed', updatedAt: new Date() }).where(eq(tournaments.id, tournament.id))
      return null
    }
    playerIds = winners
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

  for (let index = 0; index < playerIds.length / 2; index += 1) {
    const [match] = await tx.insert(matches).values({
      tournamentId: tournament.id,
      roundId: round.id,
      kind: 'head_to_head',
      tableNumber: index + 1,
      status: 'pending',
    }).returning({ id: matches.id })
    const first = playerIds[index]
    const second = playerIds[playerIds.length - 1 - index]
    await tx.insert(matchPlayers).values([
      { matchId: match.id, userId: first, seat: 1 },
      { matchId: match.id, userId: second, seat: 2 },
    ])
  }
  await tx.insert(auditEvents).values({
    tournamentId: tournament.id,
    actorId: userId,
    action: 'top_cut.round_started',
    entityType: 'round',
    entityId: round.id,
    details: { playerCount: playerIds.length },
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
      await tx.insert(matchPlayers).values(pairing.playerIds.map((playerId, seat) => ({
        matchId: match.id,
        userId: playerId,
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
    await tx.update(tournaments).set({ status: 'active', updatedAt: new Date() }).where(eq(tournaments.id, tournamentId))
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
          await tx.update(tournamentParticipants).set({ finalStanding: 1 }).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, winner.userId)))
          const runnerUp = finalists.find((player) => player.userId !== winner.userId)
          if (runnerUp) await tx.update(tournamentParticipants).set({ finalStanding: 2 }).where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, runnerUp.userId)))
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
    userId: string
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

  const currentRatings = await tx.select().from(playerRatings).where(and(
    eq(playerRatings.format, tournament.format),
    inArray(playerRatings.userId, players.map((player) => player.userId)),
  ))
  const ratings = new Map(currentRatings.map((rating) => [rating.userId, rating]))
  const ratingFor = (userId: string) => ratings.get(userId)?.rating ?? 1200

  for (const player of players) {
    const opponents = players.filter((opponent) => opponent.userId !== player.userId)
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

export async function reportMatchResult(matchId: string, userId: string, input: MatchResultInput) {
  if (input.players.some((player) => !Number.isInteger(player.gamesWon) || player.gamesWon < 0 || (player.gamesDrawn ?? 0) < 0)) {
    throw new Error('Scores must be non-negative whole numbers.')
  }
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${matchId}))`)
    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) throw new Error('Match not found.')
    if (match.status === 'complete') throw new Error('This match is already final.')

    const players = await tx.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId)).orderBy(matchPlayers.seat)
    const expectedPlayerIds = new Set(players.map((player) => player.userId))
    const submittedPlayerIds = new Set(input.players.map((player) => player.userId))
    if (submittedPlayerIds.size !== expectedPlayerIds.size || [...expectedPlayerIds].some((id) => !submittedPlayerIds.has(id))) {
      throw new Error('A result must include every player assigned to this match.')
    }

    const reporterIsPlayer = expectedPlayerIds.has(userId)
    const [organizer] = await tx
      .select({ id: tournamentOrganizers.id })
      .from(tournamentOrganizers)
      .where(and(eq(tournamentOrganizers.tournamentId, match.tournamentId), eq(tournamentOrganizers.userId, userId)))
      .limit(1)
    if (!reporterIsPlayer && !organizer) throw new Error('Only a match player or organizer can report this result.')

    const resultByPlayer = new Map<string, 'win' | 'loss' | 'draw' | 'placement'>()
    if (match.kind === 'head_to_head') {
      const results = resultForHeadToHead(input.players)
      const [round] = await tx.select({ isTopCut: rounds.isTopCut }).from(rounds).where(eq(rounds.id, match.roundId)).limit(1)
      if (round?.isTopCut && results[0] === 'draw') throw new Error('Top-cut matches must have a winner.')
      input.players.forEach((player, index) => resultByPlayer.set(player.userId, results[index]))
    } else {
      const placements = input.players.map((player) => player.placement)
      const validPlacements = placements.every((placement) => Number.isInteger(placement) && (placement as number) >= 1 && (placement as number) <= players.length)
      if (!validPlacements || new Set(placements).size !== players.length) {
        throw new Error('Commander pod results require a unique placement for every player.')
      }
      input.players.forEach((player) => resultByPlayer.set(player.userId, 'placement'))
    }

    for (const player of input.players) {
      await tx
        .update(matchPlayers)
        .set({
          gamesWon: player.gamesWon,
          gamesDrawn: player.gamesDrawn ?? 0,
          placement: match.kind === 'commander_pod' ? player.placement ?? null : null,
          result: resultByPlayer.get(player.userId),
          confirmedAt: player.userId === userId || organizer ? new Date() : null,
        })
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, player.userId)))
    }

    await tx.update(matches).set({
      status: organizer ? 'complete' : 'reported',
      reportedById: userId,
      isAdminOverride: Boolean(organizer && !reporterIsPlayer),
      completedAt: organizer ? new Date() : null,
    }).where(eq(matches.id, matchId))
    if (organizer) await applyRatingsForMatch(tx, matchId)
    await tx.insert(auditEvents).values({
      tournamentId: match.tournamentId,
      actorId: userId,
      action: organizer && !reporterIsPlayer ? 'match.overridden' : 'match.reported',
      entityType: 'match',
      entityId: matchId,
    })
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
    if (!player) throw new Error('Only a player in this match can confirm its result.')

    await tx.update(matchPlayers).set({ confirmedAt: new Date() }).where(eq(matchPlayers.id, player.id))
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
        action: 'match.confirmed',
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
