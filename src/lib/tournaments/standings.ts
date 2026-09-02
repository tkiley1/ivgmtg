export type StandingPlayer = {
  participantId: string
  userId: string | null
  username: string | null
  displayName: string
  rating: number
}

export type CompletedMatch = {
  playerResults: Array<{
    participantId: string
    result: 'win' | 'loss' | 'draw' | 'bye' | 'placement' | null
    placement: number | null
    gamesWon: number
    gamesDrawn: number
  }>
}

export type Standing = StandingPlayer & {
  rank: number
  matchPoints: number
  matchWins: number
  matchLosses: number
  matchDraws: number
  gameWins: number
  gameLosses: number
  gameDraws: number
  opponentIds: string[]
  matchWinPercentage: number
  gameWinPercentage: number
  opponentMatchWinPercentage: number
  opponentGameWinPercentage: number
}

/**
 * Computes standings from confirmed results. Duel matches use 3/1/0 points;
 * Commander pod placements use a transparent 3/2/1/0 default. Event-level
 * configurable Commander scoring will layer on top of this pure calculation.
 */
export function calculateStandings(players: readonly StandingPlayer[], matches: readonly CompletedMatch[]): Standing[] {
  const standings = new Map<string, Standing>()
  for (const player of players) {
    standings.set(player.participantId, {
      ...player,
      rank: 0,
      matchPoints: 0,
      matchWins: 0,
      matchLosses: 0,
      matchDraws: 0,
      gameWins: 0,
      gameLosses: 0,
      gameDraws: 0,
      opponentIds: [],
      matchWinPercentage: 0,
      gameWinPercentage: 0,
      opponentMatchWinPercentage: 0,
      opponentGameWinPercentage: 0,
    })
  }

  for (const match of matches) {
    const participants = match.playerResults.filter((entry) => standings.has(entry.participantId))
    for (const entry of participants) {
      const standing = standings.get(entry.participantId)
      if (!standing) continue
      const opponents = participants.filter((candidate) => candidate.participantId !== entry.participantId)
      opponents.forEach((opponent) => standing.opponentIds.push(opponent.participantId))

      standing.gameWins += entry.gamesWon
      standing.gameDraws += entry.gamesDrawn
      standing.gameLosses += opponents.reduce((total, opponent) => total + opponent.gamesWon, 0)

      if (entry.result === 'win' || entry.result === 'bye') {
        standing.matchWins += 1
        standing.matchPoints += 3
      } else if (entry.result === 'draw') {
        standing.matchDraws += 1
        standing.matchPoints += 1
      } else if (entry.result === 'loss') {
        standing.matchLosses += 1
      } else if (entry.result === 'placement' && entry.placement) {
        standing.matchPoints += Math.max(0, 4 - entry.placement)
        if (entry.placement === 1) standing.matchWins += 1
        else standing.matchLosses += 1
      }
    }
  }

  for (const standing of standings.values()) {
    const matchesPlayed = standing.matchWins + standing.matchLosses + standing.matchDraws
    const gamesPlayed = standing.gameWins + standing.gameLosses + standing.gameDraws
    standing.matchWinPercentage = matchesPlayed ? (standing.matchWins * 3 + standing.matchDraws) / (matchesPlayed * 3) : 0
    standing.gameWinPercentage = gamesPlayed ? (standing.gameWins * 3 + standing.gameDraws) / (gamesPlayed * 3) : 0
  }

  for (const standing of standings.values()) {
    const opponents = standing.opponentIds.map((id) => standings.get(id)).filter((value): value is Standing => Boolean(value))
    standing.opponentMatchWinPercentage = opponents.length
      ? opponents.reduce((total, opponent) => total + Math.max(0.33, opponent.matchWinPercentage), 0) / opponents.length
      : 0
    standing.opponentGameWinPercentage = opponents.length
      ? opponents.reduce((total, opponent) => total + Math.max(0.33, opponent.gameWinPercentage), 0) / opponents.length
      : 0
  }

  return [...standings.values()]
    .sort((left, right) =>
      right.matchPoints - left.matchPoints ||
      right.opponentMatchWinPercentage - left.opponentMatchWinPercentage ||
      right.gameWinPercentage - left.gameWinPercentage ||
      right.opponentGameWinPercentage - left.opponentGameWinPercentage ||
      right.rating - left.rating ||
      left.displayName.localeCompare(right.displayName),
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }))
}
