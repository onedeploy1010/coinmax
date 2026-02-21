import type { ModelParams, StressConfig, StressSummary, FailRules, ThresholdResult } from "../config/types"
import { simulate } from "./simulate"

function simulateSummary(cfg: ModelParams): Omit<StressSummary, "params" | "fail_reason"> {
  const rows = simulate(cfg)
  if (rows.length === 0) {
    return {
      final_price: cfg.price_token,
      min_price: cfg.price_token,
      max_drawdown: 0,
      final_lp_usdc: cfg.lp_usdc,
      min_lp_usdc: cfg.lp_usdc,
      min_treasury: cfg.treasury_start_usdc,
      final_treasury: cfg.treasury_start_usdc,
      max_sold_over_lp: 0,
      total_payout_usdc: 0,
      total_ar_emitted: 0,
    }
  }
  const last = rows[rows.length - 1]
  let min_price = Infinity
  let min_lp = Infinity
  let min_treasury = Infinity
  let max_sold_over_lp = 0
  let total_payout = 0
  let peak_price = 0

  for (const r of rows) {
    if (r.price_end < min_price) min_price = r.price_end
    if (r.price_end > peak_price) peak_price = r.price_end
    if (r.lp_usdc_end < min_lp) min_lp = r.lp_usdc_end
    if (r.treasury_end < min_treasury) min_treasury = r.treasury_end
    if (r.sold_over_lp > max_sold_over_lp) max_sold_over_lp = r.sold_over_lp
    total_payout += r.node_payout_usdc_capped
  }

  const max_drawdown = peak_price > 0 ? (peak_price - min_price) / peak_price : 0

  return {
    final_price: last.price_end,
    min_price,
    max_drawdown,
    final_lp_usdc: last.lp_usdc_end,
    min_lp_usdc: min_lp,
    min_treasury,
    final_treasury: last.treasury_end,
    max_sold_over_lp,
    total_payout_usdc: total_payout,
    total_ar_emitted: last.total_ar_emitted,
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
  const subCombos = generateCartesian(rest)
  const result: Record<string, number>[] = []
  for (const v of first.values) {
    for (const sub of subCombos) {
      result.push({ [first.key]: v, ...sub })
    }
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
  if (combos.length > stressConfig.maxRuns) {
    combos = combos.slice(0, stressConfig.maxRuns)
  }

  const results: StressSummary[] = []
  for (let i = 0; i < combos.length; i++) {
    const overrides = combos[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = { ...baseConfig }
    for (const [k, v] of Object.entries(overrides)) {
      cfg[k] = v
    }
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

export function findThresholds(
  baseConfig: ModelParams,
  failRules: FailRules,
): ThresholdResult[] {
  const results: ThresholdResult[] = []

  for (const scan of SCAN_KEYS) {
    let safeValue = scan.direction === "max" ? scan.min : scan.max

    if (scan.direction === "max") {
      for (let v = scan.min; v <= scan.max; v += scan.step) {
        const cfg = { ...baseConfig, [scan.key]: v } as ModelParams
        const summary = simulateSummary(cfg)
        const fail = detectFail(summary, failRules)
        if (!fail) {
          safeValue = v
        } else {
          break
        }
      }
    } else {
      for (let v = scan.max; v >= scan.min; v -= scan.step) {
        const cfg = { ...baseConfig, [scan.key]: v } as ModelParams
        const summary = simulateSummary(cfg)
        const fail = detectFail(summary, failRules)
        if (!fail) {
          safeValue = v
        } else {
          break
        }
      }
    }

    results.push({
      key: scan.key,
      label: scan.label,
      safe_value: Math.round(safeValue * 1e6) / 1e6,
      direction: scan.direction,
    })
  }

  return results
}
