import { describe, expect, it } from 'vitest'
import { draftPodSizes, nextDraftStep, seatDraftPods, shuffleValues } from './draft'

describe('draftPodSizes', () => {
  it('uses one pod for up to eight players', () => {
    expect(draftPodSizes(4)).toEqual([4])
    expect(draftPodSizes(8)).toEqual([8])
  })

  it('balances larger events without pods over eight', () => {
    expect(draftPodSizes(9)).toEqual([5, 4])
    expect(draftPodSizes(16)).toEqual([8, 8])
    expect(draftPodSizes(17)).toEqual([6, 6, 5])
  })

  it('rejects undersized drafts', () => {
    expect(() => draftPodSizes(3)).toThrow('At least four')
  })
})

describe('seatDraftPods', () => {
  it('places every player in exactly one seat', () => {
    const players = Array.from({ length: 13 }, (_, index) => `player-${index + 1}`)
    const pods = seatDraftPods(players, () => 0.5)
    expect(pods.map((pod) => pod.length)).toEqual([7, 6])
    expect([...pods.flat()].sort()).toEqual([...players].sort())
  })

  it('supports deterministic randomness in tests', () => {
    expect(shuffleValues(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
  })
})

describe('nextDraftStep', () => {
  it('advances picks, packs, and then deck building', () => {
    expect(nextDraftStep(1, 1)).toEqual({ status: 'drafting', pack: 1, pick: 2 })
    expect(nextDraftStep(1, 14)).toEqual({ status: 'drafting', pack: 2, pick: 1 })
    expect(nextDraftStep(3, 14)).toEqual({ status: 'deck_building', pack: 3, pick: 14 })
  })
})
