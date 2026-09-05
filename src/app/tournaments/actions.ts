'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireCurrentUser } from '@/lib/auth/session'
import {
  addWalkInParticipant,
  cancelTournament,
  completeActiveRound,
  completeDraft,
  checkInToTournament,
  confirmMatchResult,
  correctMatchResult,
  createTournament,
  generateDraftSeating,
  joinPublicTournament,
  joinTournamentByAccessKey,
  joinTournamentByInviteToken,
  openCheckIn,
  promoteWaitlist,
  removeParticipant,
  reportMatchResult,
  resetActiveRound,
  startDeckBuilding,
  startNextRound,
  submitStandardDeckList,
  swapActiveRoundPlayers,
  updateTournament,
} from '@/lib/tournaments/service'
import { localDateTimeInZone } from '@/lib/utils'

export type TournamentActionState = { error?: string }

const optionalInteger = (min: number, max: number) => z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(min).max(max).optional(),
)
const optionalTopCut = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().refine((value) => [2, 4, 8, 16, 32, 64].includes(value), 'Top cut must be 2, 4, 8, 16, 32, or 64.').optional(),
)

const createTournamentSchema = z.object({
  name: z.string().trim().min(3, 'Tournament name must be at least 3 characters.').max(120),
  description: z.string().trim().max(5_000).optional(),
  format: z.enum(['draft', 'sealed', 'commander', 'standard']),
  commanderMode: z.enum(['duel', 'pods']).optional(),
  podSize: optionalInteger(3, 4),
  roundCount: z.coerce.number().int().min(1).max(20),
  gamesPerMatch: z.coerce.number().int().refine((value) => value === 1 || value === 3, 'Matches must be best of 1 or best of 3.'),
  roundTimeLimitMinutes: z.coerce.number().int().min(10).max(240),
  topCutSize: optionalTopCut,
  isPublic: z.string().optional(),
  scheduledAt: z.string().optional(),
  timezone: z.string().trim().min(1).max(64),
  venue: z.string().trim().max(160).optional(),
  capacity: optionalInteger(2, 1_000),
  deckListsRequired: z.string().optional(),
})

export async function createTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = createTournamentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const input = parsed.data
  if (input.format === 'commander' && !input.commanderMode) {
    return { error: 'Choose 1v1 or multiplayer pods for Commander.' }
  }
  if (input.commanderMode === 'pods' && !input.podSize) {
    return { error: 'Choose a Commander pod size.' }
  }
  if (input.commanderMode === 'pods' && input.gamesPerMatch !== 1) {
    return { error: 'Multiplayer Commander pods use one game per round.' }
  }

  let scheduledAt: Date | undefined
  try {
    scheduledAt = input.scheduledAt ? localDateTimeInZone(input.scheduledAt, input.timezone) : undefined
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Choose a valid start date, time, and time zone.' }
  }

  const user = await requireCurrentUser()
  const tournament = await createTournament(user.id, {
    ...input,
    description: input.description || undefined,
    venue: input.venue || undefined,
    commanderMode: input.format === 'commander' ? input.commanderMode : undefined,
    podSize: input.commanderMode === 'pods' ? input.podSize : undefined,
    topCutSize: input.format === 'commander' ? undefined : input.topCutSize,
    isPublic: input.isPublic === 'on',
    deckListsRequired: input.deckListsRequired === 'on',
    scheduledAt,
  })
  redirect(`/tournaments/${tournament.id}`)
}

export async function joinTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const accessKey = z.string().trim().regex(/^[A-Z0-9]{8}$/, 'Enter the 8-character access key.').safeParse(formData.get('accessKey'))
  if (!accessKey.success) return { error: accessKey.error.issues[0]?.message ?? 'Enter an access key.' }

  let tournamentId: string
  try {
    const user = await requireCurrentUser()
    tournamentId = await joinTournamentByAccessKey(user.id, accessKey.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join that tournament.' }
  }
  redirect(`/tournaments/${tournamentId}`)
}

export async function joinPublicTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await joinPublicTournament(user.id, tournamentId.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join this tournament.' }
  }
  redirect(`/tournaments/${tournamentId.data}`)
}

export async function joinInviteTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const inviteToken = z.string().uuid().safeParse(formData.get('inviteToken'))
  if (!inviteToken.success) return { error: 'That invite link is invalid.' }
  let tournamentId: string
  try {
    const user = await requireCurrentUser()
    tournamentId = await joinTournamentByInviteToken(user.id, inviteToken.data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join this tournament.' }
  }
  redirect(`/tournaments/${tournamentId}`)
}

function refreshTournament(tournamentId: string) {
  revalidatePath(`/tournaments/${tournamentId}`)
  revalidatePath(`/tournaments/${tournamentId}/manage`)
  revalidatePath('/dashboard')
  revalidatePath('/tournaments')
}

const updateTournamentSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().trim().min(3, 'Tournament name must be at least 3 characters.').max(120),
  description: z.string().trim().max(5_000).optional(),
  roundCount: z.coerce.number().int().min(1).max(20),
  gamesPerMatch: z.coerce.number().int().refine((value) => value === 1 || value === 3, 'Matches must be best of 1 or best of 3.'),
  roundTimeLimitMinutes: z.coerce.number().int().min(10).max(240),
  topCutSize: optionalTopCut,
  isPublic: z.string().optional(),
  scheduledAt: z.string().optional(),
  timezone: z.string().trim().min(1).max(64),
  venue: z.string().trim().max(160).optional(),
  capacity: optionalInteger(2, 1_000),
  draftPickTimeSeconds: z.coerce.number().int().min(10).max(300),
  draftPicksPerPack: z.coerce.number().int().min(1).max(30),
  deckBuildingTimeMinutes: z.coerce.number().int().min(5).max(120),
  deckListsRequired: z.string().optional(),
})

export async function updateTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = updateTournamentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the event settings and try again.' }
  const input = parsed.data
  let scheduledAt: Date | undefined
  try {
    scheduledAt = input.scheduledAt ? localDateTimeInZone(input.scheduledAt, input.timezone) : undefined
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Choose a valid start date, time, and time zone.' }
  }
  try {
    const user = await requireCurrentUser()
    await updateTournament(input.tournamentId, user.id, {
      name: input.name,
      description: input.description || null,
      roundCount: input.roundCount,
      gamesPerMatch: input.gamesPerMatch,
      roundTimeLimitMinutes: input.roundTimeLimitMinutes,
      topCutSize: input.topCutSize ?? null,
      isPublic: input.isPublic === 'on',
      scheduledAt: scheduledAt ?? null,
      timezone: input.timezone,
      venue: input.venue || null,
      capacity: input.capacity ?? null,
      deckListsRequired: input.deckListsRequired === 'on',
      draftPickTimeSeconds: input.draftPickTimeSeconds,
      draftPicksPerPack: input.draftPicksPerPack,
      deckBuildingTimeMinutes: input.deckBuildingTimeMinutes,
    })
    refreshTournament(input.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update this event.' }
  }
}

export async function cancelTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await cancelTournament(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to cancel this event.' }
  }
}

export async function addWalkInAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = z.object({
    tournamentId: z.string().uuid(),
    guestName: z.string().trim().min(1, 'Enter the walk-in player’s name.').max(80),
  }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the player name.' }
  try {
    const user = await requireCurrentUser()
    await addWalkInParticipant(parsed.data.tournamentId, user.id, parsed.data.guestName)
    refreshTournament(parsed.data.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to add this walk-in.' }
  }
}

async function runTournamentCommand(formData: FormData, command: (tournamentId: string, userId: string) => Promise<unknown>) {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await command(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update this tournament.' }
  }
}

export async function generateDraftSeatingAction(_: TournamentActionState, formData: FormData) {
  return runTournamentCommand(formData, generateDraftSeating)
}

export async function startDeckBuildingAction(_: TournamentActionState, formData: FormData) {
  return runTournamentCommand(formData, startDeckBuilding)
}

export async function completeDraftAction(_: TournamentActionState, formData: FormData) {
  return runTournamentCommand(formData, completeDraft)
}

export async function resetActiveRoundAction(_: TournamentActionState, formData: FormData) {
  return runTournamentCommand(formData, resetActiveRound)
}

export async function swapActiveRoundPlayersAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = z.object({ tournamentId: z.string().uuid(), firstMatchPlayerId: z.string().uuid(), secondMatchPlayerId: z.string().uuid() }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Choose two valid players to swap.' }
  try {
    const user = await requireCurrentUser()
    await swapActiveRoundPlayers(parsed.data.tournamentId, user.id, parsed.data.firstMatchPlayerId, parsed.data.secondMatchPlayerId)
    refreshTournament(parsed.data.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to repair these pairings.' }
  }
}

export async function startRoundAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await startNextRound(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to start a round.' }
  }
}

export async function completeRoundAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await completeActiveRound(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to complete this round.' }
  }
}

export async function openCheckInAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await openCheckIn(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to open check-in.' }
  }
}

export async function checkInAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await checkInToTournament(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to check in.' }
  }
}

export async function promoteWaitlistAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await promoteWaitlist(tournamentId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to promote the waitlist.' }
  }
}

export async function removeParticipantAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  const participantId = z.string().uuid().safeParse(formData.get('participantId'))
  if (!tournamentId.success || !participantId.success) return { error: 'That participant link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await removeParticipant(tournamentId.data, user.id, participantId.data)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to remove this participant.' }
  }
}

const reportSchema = z.object({
  matchId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  players: z.array(z.object({
    participantId: z.string().uuid(),
    gamesWon: z.number().int().min(0),
    gamesDrawn: z.number().int().min(0).optional(),
    placement: z.number().int().min(1).nullable().optional(),
  })).min(2),
})

export async function reportMatchAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  try {
    const parsed = reportSchema.parse(JSON.parse(String(formData.get('result') ?? '')))
    const user = await requireCurrentUser()
    await reportMatchResult(parsed.matchId, user.id, { players: parsed.players })
    refreshTournament(parsed.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to report this result.' }
  }
}

export async function correctMatchAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  try {
    const parsed = reportSchema.parse(JSON.parse(String(formData.get('result') ?? '')))
    const user = await requireCurrentUser()
    await correctMatchResult(parsed.matchId, user.id, { players: parsed.players })
    refreshTournament(parsed.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to correct this result.' }
  }
}

export async function confirmMatchAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const matchId = z.string().uuid().safeParse(formData.get('matchId'))
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!matchId.success || !tournamentId.success) return { error: 'That match link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await confirmMatchResult(matchId.data, user.id)
    refreshTournament(tournamentId.data)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to confirm this result.' }
  }
}

const deckListSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().trim().min(1, 'Give this deck a name.').max(120).optional(),
  listText: z.string().trim().min(1, 'Paste an MTG Arena deck export or upload its .txt file.').max(20_000).optional(),
  sourceDeckId: z.string().uuid().optional(),
})

export async function submitStandardDeckListAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = deckListSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the deck list and try again.' }
  try {
    const user = await requireCurrentUser()
    await submitStandardDeckList(parsed.data.tournamentId, user.id, parsed.data)
    refreshTournament(parsed.data.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to submit this deck list.' }
  }
}
