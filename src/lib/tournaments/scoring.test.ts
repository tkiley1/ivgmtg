import { describe, expect, it } from 'vitest'
import { validateHeadToHeadScores } from './scoring'

describe('validateHeadToHeadScores', () => {
  it('accepts normal and time-shortened best-of-three results', () => {
    expect(() => validateHeadToHeadScores([{ gamesWon: 2 }, { gamesWon: 1 }], 3)).not.toThrow()
    expect(() => validateHeadToHeadScores([{ gamesWon: 1 }, { gamesWon: 0 }], 3)).not.toThrow()
    expect(() => validateHeadToHeadScores([{ gamesWon: 1, gamesDrawn: 1 }, { gamesWon: 1, gamesDrawn: 1 }], 3)).not.toThrow()
  })

  it('rejects impossible scores', () => {
    expect(() => validateHeadToHeadScores([{ gamesWon: 3 }, { gamesWon: 0 }], 3)).toThrow()
    expect(() => validateHeadToHeadScores([{ gamesWon: 2 }, { gamesWon: 2 }], 3)).toThrow()
    expect(() => validateHeadToHeadScores([{ gamesWon: 0 }, { gamesWon: 0 }], 1)).toThrow()
    expect(() => validateHeadToHeadScores([{ gamesWon: 0, gamesDrawn: 1 }, { gamesWon: 0, gamesDrawn: 0 }], 1)).toThrow()
  })
})
