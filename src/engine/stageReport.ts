import type { DailyRow } from "./simulate"
import type { ModelParams, PressureTargets, GrowthTargets, StageCheckpoint, PressureLabel, SustainabilityLabel } from "../config/types"

export const STAGE_DAYS = [15, 30, 60, 120, 150, 180, 210, 360]

export const DEFAULT_PRESSURE_TARGETS: PressureTargets = {
  targetSoldOverLP: 0.25,
  targetDrawdown: 0.50,
  targetTreasuryStress: 0.10,
}

export const DEFAULT_GROWTH_TARGETS: GrowthTargets = {
  target_junior_90: 2000,
  target_senior_90: 500,
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function computePressureScore(
  maxSolOverLp: number,
  maxDrawdown: number,
  minTreasury: number,
  treasuryStart: number,
  t: PressureTargets,
): number {
  const solPart = 40 * clamp(maxSolOverLp / t.targetSoldOverLP, 0, 2)
  const ddPart = 30 * clamp(Math.abs(maxDrawdown) / t.targetDrawdown, 0, 2)
  const tStress = treasuryStart > 0 ? Math.max(0, -minTreasury) / treasuryStart : 0
  const tPart = 30 * clamp(tStress / t.targetTreasuryStress, 0, 2)
  return Math.min(100, solPart + ddPart + tPart)
}

function toPressureLabel(score: number): PressureLabel {
  if (score <= 30) return "SAFE"
  if (score <= 60) return "WATCH"
  if (score <= 80) return "RISK"
  return "DANGER"
}

function toSustainabilityLabel(ratio: number): SustainabilityLabel {
  if (ratio <= 0.6) return "HEALTHY"
  if (ratio <= 1.0) return "TIGHT"
  return "UNSUSTAINABLE"
}

export function computeStageReport(
  rows: DailyRow[],
  config: ModelParams,
  pressureTargets: PressureTargets = DEFAULT_PRESSURE_TARGETS,
  growthTargets: GrowthTargets = DEFAULT_GROWTH_TARGETS,
  minLpThreshold: number = 20000,
): StageCheckpoint[] {
  if (rows.length === 0) return []

  const result: StageCheckpoint[] = []

  for (const sd of STAGE_DAYS) {
    const idx = sd - 1
    if (idx >= rows.length) continue
    const r = rows[idx]
    const slice = rows.slice(0, idx + 1)

    let peak = 0
    let minTreasury = Infinity
    let minLp = Infinity
    let maxSol = 0
    let totalPayout = 0
    let totalPrincipal = 0

    for (const s of slice) {
      if (s.price_end > peak) peak = s.price_end
      if (s.treasury_end < minTreasury) minTreasury = s.treasury_end
      if (s.lp_usdc_end < minLp) minLp = s.lp_usdc_end
      if (s.sold_over_lp > maxSol) maxSol = s.sold_over_lp
      totalPayout += s.node_payout_usdc_capped
      totalPrincipal += s.junior_new * config.junior_invest_usdc + s.senior_new * config.senior_invest_usdc
    }

    const minPrice = Math.min(...slice.map((s) => s.price_end))
    const maxDrawdown = peak > 0 ? (peak - minPrice) / peak : 0

    // ---- Pressure Score (Section 1) ----
    const pressureScore = computePressureScore(maxSol, maxDrawdown, minTreasury, config.treasury_start_usdc, pressureTargets)
    const pressureLabel = toPressureLabel(pressureScore)

    // ---- KPI-A: Growth ----
    const targetJunior = growthTargets.target_junior_90 * Math.min(sd / 90, 1)
    const targetSenior = growthTargets.target_senior_90 * Math.min(sd / 90, 1)
    const growthKpi: "PASS" | "FAIL" =
      r.junior_cum >= targetJunior * 0.8 && r.senior_cum >= targetSenior * 0.8 ? "PASS" : "FAIL"

    // ---- KPI-B: Payout Sustainability ----
    const payoutRatio = totalPrincipal > 0 ? totalPayout / totalPrincipal : 0
    const sustLabel = toSustainabilityLabel(payoutRatio)

    // ---- KPI-D: Liquidity ----
    const liqLabel: "PASS" | "FAIL" = r.lp_usdc_end >= minLpThreshold ? "PASS" : "FAIL"

    // ---- Recommendation Generator (Section 3) ----
    const recs: string[] = []

    if (pressureLabel === "DANGER") {
      recs.push("Daily sell pressure too high vs LP; increase LP or reduce release/sell ratio.")
      if (maxSol > pressureTargets.targetSoldOverLP) {
        recs.push("Reduce sell_pressure_ratio or increase withdraw_delay_days.")
      }
      if (maxDrawdown > pressureTargets.targetDrawdown) {
        recs.push("Increase treasury buyback ratio to stabilize price.")
      }
      recs.push("Consider reducing growth_rate or junior_monthly_new if payout overwhelms.")
    } else if (pressureLabel === "RISK") {
      recs.push("Approaching danger zone; consider reducing growth rate or increasing LP depth.")
    }

    if (sustLabel === "UNSUSTAINABLE") {
      recs.push("Payout exceeds principal inflow; lower daily rate or reduce package bonus.")
      recs.push("Consider setting usdc_payout_cover_ratio=0 (AR-only) if treasury collapses.")
    } else if (sustLabel === "TIGHT") {
      recs.push("Payout ratio tightening; monitor carefully and prepare to adjust rates.")
    }

    if (liqLabel === "FAIL") {
      recs.push("LP USDC below minimum threshold; increase LP depth or lower sell pressure.")
    }

    if (growthKpi === "FAIL" && sd >= 60) {
      recs.push("Node growth below target; consider marketing or incentive adjustments.")
    }

    if (recs.length === 0) {
      recs.push("System operating within safe parameters. All KPIs healthy.")
    }

    result.push({
      day: sd,
      price: r.price_end,
      lp_usdc: r.lp_usdc_end,
      treasury: r.treasury_end,
      min_treasury: minTreasury,
      min_lp_usdc: minLp,
      max_drawdown: maxDrawdown,
      max_sold_over_lp: maxSol,
      total_payout_usdc: totalPayout,
      total_principal_inflow: totalPrincipal,
      total_ar_emitted: r.total_ar_emitted,
      total_ar_burned: r.total_ar_burned,
      total_ar_sold: r.total_ar_sold,
      total_ar_buyback: r.total_ar_buyback,
      total_usdc_redemptions: r.total_usdc_redemptions,
      total_mx_burned: r.total_mx_burned,
      net_sell_pressure: r.total_ar_sold - r.total_ar_buyback,
      junior_cum: r.junior_cum,
      senior_cum: r.senior_cum,
      pressure_score: pressureScore,
      pressure_label: pressureLabel,
      growth_kpi: growthKpi,
      sustainability_label: sustLabel,
      liquidity_label: liqLabel,
      payout_ratio: payoutRatio,
      recommendation: recs.join(" "),
    })
  }

  return result
}
