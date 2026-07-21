'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireCurrentUser } from '@/lib/auth/session'
import {
  completeActiveRound,
  confirmMatchResult,
  createTournament,
  joinPublicTournament,
  joinTournamentByAccessKey,
  joinTournamentByInviteToken,
  reportMatchResult,
  startNextRound,
  submitStandardDeckList,
} from '@/lib/tournaments/service'

export type TournamentActionState = { error?: string }

const optionalInteger = (min: number, max: number) => z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(min).max(max).optional(),
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
  topCutSize: optionalInteger(2, 64),
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

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return { error: 'Choose a valid start date and time.' }

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

  try {
    const user = await requireCurrentUser()
    const tournamentId = await joinTournamentByAccessKey(user.id, accessKey.data)
    redirect(`/tournaments/${tournamentId}`)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join that tournament.' }
  }
}

export async function joinPublicTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const tournamentId = z.string().uuid().safeParse(formData.get('tournamentId'))
  if (!tournamentId.success) return { error: 'That tournament link is invalid.' }
  try {
    const user = await requireCurrentUser()
    await joinPublicTournament(user.id, tournamentId.data)
    redirect(`/tournaments/${tournamentId.data}`)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join this tournament.' }
  }
}

export async function joinInviteTournamentAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const inviteToken = z.string().uuid().safeParse(formData.get('inviteToken'))
  if (!inviteToken.success) return { error: 'That invite link is invalid.' }
  try {
    const user = await requireCurrentUser()
    const tournamentId = await joinTournamentByInviteToken(user.id, inviteToken.data)
    redirect(`/tournaments/${tournamentId}`)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to join this tournament.' }
  }
}

function refreshTournament(tournamentId: string) {
  revalidatePath(`/tournaments/${tournamentId}`)
  revalidatePath(`/tournaments/${tournamentId}/manage`)
  revalidatePath('/dashboard')
  revalidatePath('/tournaments')
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

const reportSchema = z.object({
  matchId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  players: z.array(z.object({
    userId: z.string().uuid(),
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
  name: z.string().trim().min(1, 'Give this deck a name.').max(120),
  listText: z.string().trim().min(1, 'Paste an MTG Arena deck export or upload its .txt file.').max(20_000),
})

export async function submitStandardDeckListAction(_: TournamentActionState, formData: FormData): Promise<TournamentActionState> {
  const parsed = deckListSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the deck list and try again.' }
  try {
    const user = await requireCurrentUser()
    await submitStandardDeckList(parsed.data.tournamentId, user.id, {
      name: parsed.data.name,
      listText: parsed.data.listText,
    })
    refreshTournament(parsed.data.tournamentId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to submit this deck list.' }
  }
}
