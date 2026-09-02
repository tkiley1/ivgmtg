import { describe, expect, it } from 'vitest'
import { createSwissPairings, type PairingPlayer } from './pairing'

function player(participantId: string, overrides: Partial<PairingPlayer> = {}): PairingPlayer {
  return {
    participantId,
    matchPoints: 0,
    rating: 1200,
    opponentIds: new Set(),
    hasReceivedBye: false,
    ...overrides,
  }
}

describe('createSwissPairings', () => {
  it('creates one bye for an odd player count', () => {
    const pairings = createSwissPairings(['a', 'b', 'c', 'd', 'e'].map((id) => player(id)))
    expect(pairings.filter((pairing) => pairing.kind === 'bye')).toHaveLength(1)
    expect(pairings.flatMap((pairing) => pairing.participantIds)).toHaveLength(5)
  })

  it('avoids a rematch when another opponent is available', () => {
    const pairings = createSwissPairings([
      player('a', { opponentIds: new Set(['b']) }),
      player('b', { opponentIds: new Set(['a']) }),
      player('c'),
      player('d'),
    ])
    const aPairing = pairings.find((pairing) => pairing.participantIds.includes('a'))
    expect(aPairing?.participantIds).not.toContain('b')
  })
})
