import type { ModelParams, StressConfig, StressSummary, FailRules, ThresholdResult, OptimizeResult } from "../config/types"
import { simulate, type DailyRow } from "./simulate"

export function simulateSummary(cfg: ModelParams): Omit<StressSummary, "params" | "fail_reason"> {
  const rows = simulate(cfg)
  if (rows.length === 0) {
    return {
      final_price: cfg.price_token, min_price: cfg.price_token, max_drawdown: 0,
      final_lp_usdc: cfg.lp_usdc, min_lp_usdc: cfg.lp_usdc,
      min_treasury: cfg.treasury_start_usdc, final_treasury: cfg.treasury_start_usdc,
      max_sold_over_lp: 0, total_payout_usdc: 0, total_ar_emitted: 0,
      total_ar_buyback: 0, total_mx_burned: 0, total_usdc_redemptions: 0, net_sell_pressure: 0,
    }
  }
  const last = rows[rows.length - 1]
  let min_price = Infinity, min_lp = Infinity, min_treasury = Infinity
  let max_sold_over_lp = 0, total_payout = 0, peak_price = 0

  for (const r of rows) {
    if (r.price_end < min_price) min_price = r.price_end
    if (r.price_end > peak_price) peak_price = r.price_end
    if (r.lp_usdc_end < min_lp) min_lp = r.lp_usdc_end
    if (r.treasury_end < min_treasury) min_treasury = r.treasury_end
    if (r.sold_over_lp > max_sold_over_lp) max_sold_over_lp = r.sold_over_lp
    total_payout += r.node_payout_usdc_capped
  }

  return {
    final_price: last.price_end, min_price,
    max_drawdown: peak_price > 0 ? (peak_price - min_price) / peak_price : 0,
    final_lp_usdc: last.lp_usdc_end, min_lp_usdc: min_lp,
    min_treasury, final_treasury: last.treasury_end,
    max_sold_over_lp, total_payout_usdc: total_payout,
    total_ar_emitted: last.total_ar_emitted,
    total_ar_buyback: last.total_ar_buyback,
    total_mx_burned: last.total_mx_burned,
    total_usdc_redemptions: last.total_usdc_redemptions,
    net_sell_pressure: last.total_ar_sold - last.total_ar_buyback,
  }
}

function detectFail(s: Omit<StressSummary, "params" | "fail_reason">, rules: FailRules): string | null {
  if (s.min_treasury < rules.min_treasury_usdc) return "国库为负"
  if (s.min_lp_usdc < rules.min_lp_usdc) return "LP 崩溃"
  if (s.max_drawdown > rules.max_price_drawdown) return "价格回撤超限"
  if (s.max_sold_over_lp > rules.max_sold_over_lp) return "卖压/LP 超限"
  return null
}

function generateCartesian(ranges: { key: string; values: number[] }[]): Record<string, number>[] {
  if (ranges.length === 0) return [{}]
  const [first, ...rest] = ranges
  const sub = generateCartesian(rest)
  const result: Record<string, number>[] = []
  for (const v of first.values) {
    for (const s of sub) result.push({ [first.key]: v, ...s })
  }
  return result
}

export function runStressTest(
  baseConfig: ModelParams,
  stressConfig: StressConfig,
  onProgress?: (done: number, total: number) => void,
): StressSummary[] {
  const rangeValues = stressConfig.ranges.map((r) => {
    const values: number[] = []
    for (let v = r.min; v <= r.max + r.step * 0.001; v += r.step) {
      values.push(Math.round(v * 1e8) / 1e8)
    }
    return { key: r.key, values }
  })

  let combos = generateCartesian(rangeValues)
  if (combos.length > stressConfig.maxRuns) combos = combos.slice(0, stressConfig.maxRuns)

  const results: StressSummary[] = []
  for (let i = 0; i < combos.length; i++) {
    const overrides = combos[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = { ...baseConfig }
    for (const [k, v] of Object.entries(overrides)) cfg[k] = v
    const summary = simulateSummary(cfg as ModelParams)
    const fail_reason = detectFail(summary, stressConfig.failRules)
    results.push({ params: overrides, ...summary, fail_reason })
    if (onProgress) onProgress(i + 1, combos.length)
  }
  return results
}

// ---- Critical threshold finder ----

const SCAN_KEYS: { key: string; label: string; direction: "max" | "min"; min: number; max: number; step: number }[] = [
  { key: "sell_pressure_ratio", label: "最大安全卖压", direction: "max", min: 0, max: 1, step: 0.05 },
  { key: "growth_rate", label: "最大安全增长率", direction: "max", min: 0, max: 2, step: 0.05 },
  { key: "junior_monthly_new", label: "最大安全初级增长", direction: "max", min: 100, max: 5000, step: 100 },
  { key: "lp_usdc", label: "最小安全 LP", direction: "min", min: 10000, max: 500000, step: 10000 },
]

export function findThresholds(baseConfig: ModelParams, failRules: FailRules): ThresholdResult[] {
  const results: ThresholdResult[] = []
  for (const scan of SCAN_KEYS) {
    let safeValue = scan.direction === "max" ? scan.min : scan.max
    if (scan.direction === "max") {
      for (let v = scan.min; v <= scan.max; v += scan.step) {
        const cfg = { ...baseConfig, [scan.key]: v } as ModelParams
        if (!detectFail(simulateSummary(cfg), failRules)) safeValue = v
        else break
      }
    } else {
      for (let v = scan.max; v >= scan.min; v -= scan.step) {
        const cfg = { ...baseConfig, [scan.key]: v } as ModelParams
        if (!detectFail(simulateSummary(cfg), failRules)) safeValue = v
        else break
      }
    }
    results.push({ key: scan.key, label: scan.label, safe_value: Math.round(safeValue * 1e6) / 1e6, direction: scan.direction })
  }
  return results
}

// ---- One-Click Optimizer (Section F) ----

interface OptDim {
  key: string
  values: number[]
}

const OPT_DIMS: OptDim[] = [
  { key: "treasury_buyback_ratio", values: [0.05, 0.10, 0.15, 0.20, 0.25, 0.30] },
  { key: "treasury_redemption_ratio", values: [0, 0.10, 0.20, 0.30, 0.40, 0.50] },
  { key: "mx_burn_per_withdraw_ratio", values: [0.05, 0.10, 0.15, 0.20, 0.25, 0.30] },
  { key: "withdraw_delay_days", values: [0, 7, 15, 30, 60] },
]

export function runOptimizer(
  baseConfig: ModelParams,
  failRules: FailRules,
  onProgress?: (done: number, total: number) => void,
): OptimizeResult {
  const beforeSummary = simulateSummary(baseConfig)
  const beforeResult: StressSummary = { params: {}, ...beforeSummary, fail_reason: detectFail(beforeSummary, failRules) }

  // Generate all combos but cap at 2000
  let combos = generateCartesian(OPT_DIMS)
  if (combos.length > 2000) combos = combos.slice(0, 2000)
  const total = combos.length

  let bestScore = -Infinity
  let bestOverrides: Record<string, number> = {}
  let bestSummary = beforeSummary

  for (let i = 0; i < combos.length; i++) {
    const overrides = combos[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = { ...baseConfig }
    for (const [k, v] of Object.entries(overrides)) cfg[k] = v
    const summary = simulateSummary(cfg as ModelParams)
    const fail = detectFail(summary, failRules)

    // Score: maximize final_price + minimize drawdown + ensure treasury stays above buffer
    let score = summary.final_price * 100
    score -= summary.max_drawdown * 50
    score += Math.min(summary.min_treasury, 0) * 0.01
    score -= summary.net_sell_pressure * 0.001
    if (fail) score -= 1000

    if (score > bestScore) {
      bestScore = score
      bestOverrides = overrides
      bestSummary = summary
    }
    if (onProgress) onProgress(i + 1, total)
  }

  const afterResult: StressSummary = {
    params: bestOverrides, ...bestSummary,
    fail_reason: detectFail(bestSummary, failRules),
  }

  return {
    params: bestOverrides as Partial<ModelParams>,
    before: beforeResult,
    after: afterResult,
  }
}
