import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const redirectError = new Error('NEXT_REDIRECT')
  return {
    redirectError,
    redirect: vi.fn(() => { throw redirectError }),
    requireCurrentUser: vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000001' })),
    joinPublicTournament: vi.fn(async () => undefined),
    joinTournamentByAccessKey: vi.fn(async () => '00000000-0000-4000-8000-000000000002'),
    joinTournamentByInviteToken: vi.fn(async () => '00000000-0000-4000-8000-000000000002'),
  }
})
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireCurrentUser: mocks.requireCurrentUser }))
vi.mock('@/lib/tournaments/service', () => ({
  addWalkInParticipant: vi.fn(),
  advanceDraft: vi.fn(),
  cancelTournament: vi.fn(),
  checkInToTournament: vi.fn(),
  completeActiveRound: vi.fn(),
  completeDraft: vi.fn(),
  confirmMatchResult: vi.fn(),
  correctMatchResult: vi.fn(),
  createTournament: vi.fn(),
  generateDraftSeating: vi.fn(),
  joinPublicTournament: mocks.joinPublicTournament,
  joinTournamentByAccessKey: mocks.joinTournamentByAccessKey,
  joinTournamentByInviteToken: mocks.joinTournamentByInviteToken,
  openCheckIn: vi.fn(),
  promoteWaitlist: vi.fn(),
  removeParticipant: vi.fn(),
  reportMatchResult: vi.fn(),
  resetActiveRound: vi.fn(),
  startDraft: vi.fn(),
  startNextRound: vi.fn(),
  submitStandardDeckList: vi.fn(),
  swapActiveRoundPlayers: vi.fn(),
  updateTournament: vi.fn(),
}))

import { joinInviteTournamentAction, joinPublicTournamentAction, joinTournamentAction } from './actions'

describe('tournament join redirects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not turn a successful public join redirect into an action error', async () => {
    const formData = new FormData()
    formData.set('tournamentId', '00000000-0000-4000-8000-000000000002')
    await expect(joinPublicTournamentAction({}, formData)).rejects.toBe(mocks.redirectError)
    expect(mocks.joinPublicTournament).toHaveBeenCalledOnce()
  })

  it('preserves redirect control flow for access-key joins', async () => {
    const formData = new FormData()
    formData.set('accessKey', 'ABCD1234')
    await expect(joinTournamentAction({}, formData)).rejects.toBe(mocks.redirectError)
    expect(mocks.joinTournamentByAccessKey).toHaveBeenCalledOnce()
  })

  it('preserves redirect control flow for invite joins', async () => {
    const formData = new FormData()
    formData.set('inviteToken', '00000000-0000-4000-8000-000000000002')
    await expect(joinInviteTournamentAction({}, formData)).rejects.toBe(mocks.redirectError)
    expect(mocks.joinTournamentByInviteToken).toHaveBeenCalledOnce()
  })
})
