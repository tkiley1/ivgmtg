export type HeadToHeadScore = {
  gamesWon: number
  gamesDrawn?: number
}
export function validateHeadToHeadScores(players: readonly HeadToHeadScore[], gamesPerMatch: number) {
  if (players.length !== 2) throw new Error('A head-to-head result must contain exactly two players.')
  if (![1, 3].includes(gamesPerMatch)) throw new Error('That match format is not supported.')
  if (players.some((player) => !Number.isInteger(player.gamesWon) || player.gamesWon < 0 || !Number.isInteger(player.gamesDrawn ?? 0) || (player.gamesDrawn ?? 0) < 0)) {
    throw new Error('Scores must be non-negative whole numbers.')
  }

  const [first, second] = players
  const firstDraws = first.gamesDrawn ?? 0
  const secondDraws = second.gamesDrawn ?? 0
  if (firstDraws !== secondDraws) throw new Error('Both players must report the same number of drawn games.')

  const gamesPlayed = first.gamesWon + second.gamesWon + firstDraws
  if (gamesPlayed < 1 || gamesPlayed > gamesPerMatch) {
    throw new Error(`Report between 1 and ${gamesPerMatch} completed game${gamesPerMatch === 1 ? '' : 's'}.`)
  }

  const winsNeeded = Math.ceil(gamesPerMatch / 2)
  if (first.gamesWon > winsNeeded || second.gamesWon > winsNeeded) {
    throw new Error(`A player cannot win more than ${winsNeeded} game${winsNeeded === 1 ? '' : 's'} in this match.`)
  }
}
