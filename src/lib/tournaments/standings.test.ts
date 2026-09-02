import { describe, expect, it } from 'vitest'
import { calculateStandings, type CompletedMatch, type StandingPlayer } from './standings'

const players: StandingPlayer[] = [
  { participantId: 'a', userId: 'ua', username: 'alpha', displayName: 'Alpha', rating: 1200 },
  { participantId: 'b', userId: 'ub', username: 'bravo', displayName: 'Bravo', rating: 1200 },
  { participantId: 'c', userId: null, username: null, displayName: 'Charlie', rating: 1200 },
]

function match(winner: string, loser: string): CompletedMatch {
  return { playerResults: [
    { participantId: winner, result: 'win', placement: null, gamesWon: 2, gamesDrawn: 0 },
    { participantId: loser, result: 'loss', placement: null, gamesWon: 0, gamesDrawn: 0 },
  ] }
}

describe('calculateStandings', () => {
  it('supports accountless players', () => {
    const standings = calculateStandings(players, [match('c', 'a')])
    expect(standings[0].displayName).toBe('Charlie')
    expect(standings[0].userId).toBeNull()
  })

  it('counts repeat opponents per match and applies the 33 percent floor', () => {
    const standings = calculateStandings(players, [match('a', 'b'), match('a', 'b'), match('c', 'a')])
    const alpha = standings.find((standing) => standing.participantId === 'a')
    expect(alpha?.opponentIds).toEqual(['b', 'b', 'c'])
    expect(alpha?.opponentMatchWinPercentage).toBeCloseTo((0.33 + 0.33 + 1) / 3, 5)
  })

  it('uses tournament match points for win percentages', () => {
    const drawnMatch: CompletedMatch = { playerResults: [
      { participantId: 'a', result: 'draw', placement: null, gamesWon: 1, gamesDrawn: 1 },
      { participantId: 'b', result: 'draw', placement: null, gamesWon: 1, gamesDrawn: 1 },
    ] }
    const alpha = calculateStandings(players, [drawnMatch]).find((standing) => standing.participantId === 'a')
    expect(alpha?.matchWinPercentage).toBeCloseTo(1 / 3, 5)
    expect(alpha?.gameWinPercentage).toBeCloseTo(4 / 9, 5)
  })
})
