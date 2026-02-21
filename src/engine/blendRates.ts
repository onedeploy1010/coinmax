import type { BlendMode } from "../config/types"

/**
 * Compute a blended (weighted-average) value from a Record<days, rate>
 * using one of four normalisation modes.
 */
export function blendRateMap(
  schedule: Record<number, number>,
  mode: BlendMode,
): number {
  const entries = Object.entries(schedule).map(([k, v]) => ({
    days: Number(k),
    value: v,
  }))

  if (entries.length === 0) return 0
  if (entries.length === 1) return entries[0].value

  // Sort by days ascending (needed for "weighted" index-based decay)
  entries.sort((a, b) => a.days - b.days)

  const weights: number[] = entries.map((e, idx) => {
    switch (mode) {
      case "aggressive":
        return 1 / Math.max(e.days, 1)
      case "longterm":
        return e.days
      case "weighted":
        return Math.exp(-0.5 * idx)
      case "average":
      default:
        return 1
    }
  })

  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight === 0) return 0

  let sum = 0
  for (let i = 0; i < entries.length; i++) {
    sum += entries[i].value * weights[i]
  }
  return sum / totalWeight
}

/**
 * Compute a blended (weighted-average) KEY from a Record<days, rate>
 * using the same weight logic as blendRateMap but averaging the keys (days)
 * instead of the values. Useful for computing weighted average lock period.
 */
export function blendKeyMap(
  schedule: Record<number, number>,
  mode: BlendMode,
): number {
  const entries = Object.entries(schedule).map(([k, v]) => ({
    days: Number(k),
    value: v,
  }))

  if (entries.length === 0) return 0
  if (entries.length === 1) return entries[0].days

  entries.sort((a, b) => a.days - b.days)

  const weights: number[] = entries.map((e, idx) => {
    switch (mode) {
      case "aggressive":
        return 1 / Math.max(e.days, 1)
      case "longterm":
        return e.days
      case "weighted":
        return Math.exp(-0.5 * idx)
      case "average":
      default:
        return 1
    }
  })

  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight === 0) return 0

  let sum = 0
  for (let i = 0; i < entries.length; i++) {
    sum += entries[i].days * weights[i]
  }
  return sum / totalWeight
}
