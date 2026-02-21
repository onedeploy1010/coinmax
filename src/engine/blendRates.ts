import type { BlendMode } from "../config/types"

/**
 * Helper: compute blend-mode weights for sorted entries.
 */
function computeWeights(
  entries: { days: number; value: number }[],
  mode: BlendMode,
): number[] {
  return entries.map((e, idx) => {
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
}

/**
 * Compute a normalised daily rate from a Record<days, rate>.
 *
 * Each entry's total yield = rate × days.
 * The function computes:
 *   weighted_avg_total_yield = Σ(rate × days × w) / Σw
 *   weighted_avg_days        = Σ(days × w)        / Σw
 *   normalised_daily_rate    = weighted_avg_total_yield / weighted_avg_days
 *
 * This ensures rates of different lock periods are compared on equal footing.
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

  const weights = computeWeights(entries, mode)
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight === 0) return 0

  let sumTotalYield = 0
  let sumDays = 0
  for (let i = 0; i < entries.length; i++) {
    sumTotalYield += entries[i].value * entries[i].days * weights[i]
    sumDays += entries[i].days * weights[i]
  }

  if (sumDays === 0) return 0
  return sumTotalYield / sumDays
}

/**
 * Compute a blended (weighted-average) KEY from a Record<days, rate>
 * using the same weight logic but averaging the keys (days)
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

  const weights = computeWeights(entries, mode)
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  if (totalWeight === 0) return 0

  let sum = 0
  for (let i = 0; i < entries.length; i++) {
    sum += entries[i].days * weights[i]
  }
  return sum / totalWeight
}
