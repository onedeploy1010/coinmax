import type { ModelParams, StressConfig, StressSummary, FailRules, ThresholdResult, OptObjective, OptimizerConstraints, OptSearchRange, OptResultItem, OptRunResult } from "../config/types"
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

// ---- Multi-Objective Optimizer (Investor Dashboard) ----

export const DEFAULT_OPT_RANGES: OptSearchRange[] = [
  { key: "sell_pressure_ratio", label: "卖压比例", values: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], enabled: true },
  { key: "withdraw_delay_days", label: "提现延迟天数", values: [0, 7, 15, 30, 60], enabled: true },
  { key: "lp_usdc", label: "LP USDC", values: [50000, 100000, 150000, 200000, 250000, 300000, 400000, 500000], enabled: false },
  { key: "growth_rate", label: "增长率", values: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6], enabled: false },
  { key: "junior_monthly_new", label: "初级月新增", values: [200, 300, 500, 700, 1000, 1500, 2000], enabled: false },
  { key: "senior_monthly_new", label: "高级月新增", values: [50, 100, 150, 200, 300, 400, 500], enabled: false },
  { key: "treasury_buyback_ratio", label: "回购比例", values: [0.05, 0.10, 0.15, 0.20, 0.25, 0.30], enabled: true },
  { key: "treasury_redemption_ratio", label: "兑付比例", values: [0, 0.10, 0.20, 0.30, 0.40, 0.50], enabled: true },
  { key: "mx_burn_per_withdraw_ratio", label: "MX销毁比例", values: [0.05, 0.10, 0.15, 0.20, 0.25, 0.30], enabled: true },
  { key: "max_out_multiple", label: "最大回本倍数", values: [2, 3, 4], enabled: false },
]

export const DEFAULT_OPT_CONSTRAINTS: OptimizerConstraints = {
  min_treasury_usdc: 0,
  min_lp_usdc: 20000,
  max_drawdown: 0.50,
  max_sold_over_lp: 0.25,
}

function scoreResult(
  s: Omit<StressSummary, "params" | "fail_reason">,
  c: OptimizerConstraints,
  objective: OptObjective,
  treasuryStart: number,
): { score: number; violated: boolean } {
  const violated =
    s.min_treasury < c.min_treasury_usdc ||
    s.min_lp_usdc < c.min_lp_usdc ||
    s.max_drawdown > c.max_drawdown ||
    s.max_sold_over_lp > c.max_sold_over_lp

  let score = violated ? -10000 : 0
  const tStress = treasuryStart > 0 ? Math.max(0, -s.min_treasury) / treasuryStart : 0

  switch (objective) {
    case "max_safety":
      score += 1000
      score -= 400 * s.max_drawdown
      score -= 400 * s.max_sold_over_lp
      score -= 200 * tStress
      break
    case "balanced":
      score += 1000
      score += s.total_payout_usdc * 0.001
      score -= 300 * s.max_drawdown
      score -= 300 * s.max_sold_over_lp
      score -= 200 * tStress
      break
    case "max_growth":
      score += 1000
      score += s.total_payout_usdc * 0.005
      score += s.total_ar_emitted * 0.001
      score -= 200 * s.max_drawdown
      score -= 200 * s.max_sold_over_lp
      break
  }

  return { score, violated }
}

function constraintsToFailRules(c: OptimizerConstraints): FailRules {
  return {
    min_treasury_usdc: c.min_treasury_usdc,
    min_lp_usdc: c.min_lp_usdc,
    max_price_drawdown: c.max_drawdown,
    max_sold_over_lp: c.max_sold_over_lp,
  }
}

export function runOptimizerV2(
  baseConfig: ModelParams,
  objective: OptObjective,
  constraints: OptimizerConstraints,
  searchRanges: OptSearchRange[],
  maxIterations: number = 500,
  onProgress?: (done: number, total: number) => void,
): OptRunResult {
  const baselineSummary = simulateSummary(baseConfig)
  const failRules = constraintsToFailRules(constraints)
  const baseline: StressSummary = {
    params: {},
    ...baselineSummary,
    fail_reason: detectFail(baselineSummary, failRules),
  }

  const enabledRanges = searchRanges.filter((r) => r.enabled)

  // Random sampling with dedup
  const seen = new Set<string>()
  const candidates: { overrides: Record<string, number>; summary: Omit<StressSummary, "params" | "fail_reason">; score: number }[] = []

  for (let i = 0; i < maxIterations; i++) {
    const overrides: Record<string, number> = {}
    for (const r of enabledRanges) {
      const idx = Math.floor(Math.random() * r.values.length)
      overrides[r.key] = r.values[idx]
    }

    const key = JSON.stringify(overrides)
    if (seen.has(key)) { if (onProgress) onProgress(i + 1, maxIterations); continue }
    seen.add(key)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = { ...baseConfig }
    for (const [k, v] of Object.entries(overrides)) cfg[k] = v
    const summary = simulateSummary(cfg as ModelParams)
    const { score } = scoreResult(summary, constraints, objective, baseConfig.treasury_start_usdc)

    candidates.push({ overrides, summary, score })
    if (onProgress) onProgress(i + 1, maxIterations)
  }

  // Sort by score descending, take top 5
  candidates.sort((a, b) => b.score - a.score)
  const top5 = candidates.slice(0, 5)

  const results: OptResultItem[] = top5.map((c, i) => ({
    rank: i + 1,
    overrides: c.overrides,
    summary: {
      params: c.overrides,
      ...c.summary,
      fail_reason: detectFail(c.summary, failRules),
    },
    score: c.score,
  }))

  return { objective, baseline, results }
}
