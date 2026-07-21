export type PairingPlayer = {
  userId: string
  matchPoints: number
  gameWinPercentage?: number
  rating: number
  opponentIds: ReadonlySet<string>
  hasReceivedBye: boolean
}

export type ProposedPairing = {
  kind: 'head_to_head' | 'commander_pod' | 'bye'
  playerIds: string[]
}

function rankedPlayers(players: readonly PairingPlayer[]) {
  return [...players].sort((left, right) =>
    right.matchPoints - left.matchPoints ||
    (right.gameWinPercentage ?? 0) - (left.gameWinPercentage ?? 0) ||
    right.rating - left.rating ||
    left.userId.localeCompare(right.userId),
  )
}

/**
 * Produces deterministic Swiss pairings. It first preserves score groups, then
 * avoids rematches where possible, and only falls back to a rematch when the
 * remaining pool makes one unavoidable.
 */
export function createSwissPairings(players: readonly PairingPlayer[]): ProposedPairing[] {
  const remaining = rankedPlayers(players)
  const pairings: ProposedPairing[] = []

  if (remaining.length % 2 === 1) {
    const byeIndex = [...remaining]
      .reverse()
      .findIndex((player) => !player.hasReceivedBye)
    const index = byeIndex === -1 ? remaining.length - 1 : remaining.length - 1 - byeIndex
    const [byePlayer] = remaining.splice(index, 1)
    pairings.push({ kind: 'bye', playerIds: [byePlayer.userId] })
  }

  while (remaining.length) {
    const player = remaining.shift()
    if (!player) break

    let candidateIndex = 0
    let bestPenalty = Number.POSITIVE_INFINITY
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index]
      const rematchPenalty = player.opponentIds.has(candidate.userId) ? 1_000_000 : 0
      const scorePenalty = Math.abs(player.matchPoints - candidate.matchPoints) * 10_000
      const ratingPenalty = Math.abs(player.rating - candidate.rating)
      const penalty = rematchPenalty + scorePenalty + ratingPenalty
      if (penalty < bestPenalty) {
        bestPenalty = penalty
        candidateIndex = index
      }
    }

    const [opponent] = remaining.splice(candidateIndex, 1)
    pairings.push({ kind: 'head_to_head', playerIds: [player.userId, opponent.userId] })
  }

  return pairings
}

function podSizesFor(playerCount: number, preferredSize: 3 | 4) {
  let best: { sizes: number[]; byes: number; preferencePenalty: number } | null = null
  for (let threes = 0; threes <= Math.ceil(playerCount / 3); threes += 1) {
    for (let fours = 0; fours <= Math.ceil(playerCount / 4); fours += 1) {
      const seated = threes * 3 + fours * 4
      const byes = playerCount - seated
      if (byes < 0 || byes > 1) continue
      const preferencePenalty = preferredSize === 4 ? threes : fours
      const candidate = {
        sizes: [...Array(fours).fill(4), ...Array(threes).fill(3)] as number[],
        byes,
        preferencePenalty,
      }
      if (
        !best ||
        candidate.byes < best.byes ||
        (candidate.byes === best.byes && candidate.preferencePenalty < best.preferencePenalty) ||
        (candidate.byes === best.byes && candidate.preferencePenalty === best.preferencePenalty && candidate.sizes.length < best.sizes.length)
      ) {
        best = candidate
      }
    }
  }
  return best
}

/**
 * Builds 3–4 player Commander pods. A one-player bye is used only when no
 * complete set of legal pod sizes exists (for example, five players).
 */
export function createCommanderPodPairings(
  players: readonly PairingPlayer[],
  preferredSize: 3 | 4,
): ProposedPairing[] {
  if (players.length < 3) {
    return rankedPlayers(players).map((player) => ({ kind: 'bye', playerIds: [player.userId] }))
  }

  const plan = podSizesFor(players.length, preferredSize)
  if (!plan) throw new Error('Unable to form legal Commander pods for this player count.')

  const remaining = rankedPlayers(players)
  const pairings: ProposedPairing[] = []
  for (const size of plan.sizes) {
    const pod: PairingPlayer[] = []
    while (pod.length < size && remaining.length) {
      let bestIndex = 0
      let bestPenalty = Number.POSITIVE_INFINITY
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index]
        const priorOpponents = pod.filter((member) => member.opponentIds.has(candidate.userId)).length
        const scoreDistance = pod.reduce((total, member) => total + Math.abs(member.matchPoints - candidate.matchPoints), 0)
        const penalty = priorOpponents * 1_000_000 + scoreDistance * 10_000 + index
        if (penalty < bestPenalty) {
          bestPenalty = penalty
          bestIndex = index
        }
      }
      const [nextPlayer] = remaining.splice(bestIndex, 1)
      pod.push(nextPlayer)
    }
    pairings.push({ kind: 'commander_pod', playerIds: pod.map((player) => player.userId) })
  }

  if (plan.byes) {
    const byeIndex = [...remaining].reverse().findIndex((player) => !player.hasReceivedBye)
    const [byePlayer] = remaining.splice(byeIndex === -1 ? remaining.length - 1 : remaining.length - 1 - byeIndex, 1)
    pairings.push({ kind: 'bye', playerIds: [byePlayer.userId] })
  }

  return pairings
}
