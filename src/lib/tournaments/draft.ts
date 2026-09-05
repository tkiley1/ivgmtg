export function draftPodSizes(playerCount: number, maximumPodSize = 8) {
  if (!Number.isInteger(playerCount) || playerCount < 4) {
    throw new Error('At least four checked-in players are needed to seat a draft.')
  }
  if (!Number.isInteger(maximumPodSize) || maximumPodSize < 4) {
    throw new Error('Draft pods must allow at least four players.')
  }

  const podCount = Math.ceil(playerCount / maximumPodSize)
  const baseSize = Math.floor(playerCount / podCount)
  const largerPods = playerCount % podCount
  return Array.from({ length: podCount }, (_, index) => baseSize + Number(index < largerPods))
}

export function shuffleValues<T>(values: readonly T[], random: () => number = Math.random) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

export function seatDraftPods<T>(players: readonly T[], random: () => number = Math.random) {
  const sizes = draftPodSizes(players.length)
  const shuffled = shuffleValues(players, random)
  let offset = 0
  return sizes.map((size) => {
    const pod = shuffled.slice(offset, offset + size)
    offset += size
    return pod
  })
}
