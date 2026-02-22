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

export function pressureTargetsFromConfig(config: ModelParams): PressureTargets {
  return {
    targetSoldOverLP: config.target_sold_over_lp ?? DEFAULT_PRESSURE_TARGETS.targetSoldOverLP,
    targetDrawdown: config.target_drawdown ?? DEFAULT_PRESSURE_TARGETS.targetDrawdown,
    targetTreasuryStress: config.target_treasury_stress ?? DEFAULT_PRESSURE_TARGETS.targetTreasuryStress,
  }
}

export function growthTargetsFromConfig(config: ModelParams): GrowthTargets {
  return {
    target_junior_90: config.target_junior_90 ?? DEFAULT_GROWTH_TARGETS.target_junior_90,
    target_senior_90: config.target_senior_90 ?? DEFAULT_GROWTH_TARGETS.target_senior_90,
  }
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
  pressureTargets?: PressureTargets,
  growthTargets?: GrowthTargets,
  minLpThreshold?: number,
): StageCheckpoint[] {
  if (rows.length === 0) return []

  const pt = pressureTargets ?? pressureTargetsFromConfig(config)
  const gt = growthTargets ?? growthTargetsFromConfig(config)
  const lpThreshold = minLpThreshold ?? (config.target_min_lp_usdc ?? 20000)
  const vaultStakerRatio = config.target_vault_staker_ratio ?? 0.3
  const vaultStakedRatio = config.target_vault_staked_ratio ?? 0.1

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
    let totalVaultPlatformIncome = 0
    let totalReferralPayout = 0
    let totalPerfPenalty = 0
    let totalPerfCarry = 0
    let avgPassRate = 0
    let passRateCount = 0

    for (const s of slice) {
      if (s.price_end > peak) peak = s.price_end
      if (s.treasury_end < minTreasury) minTreasury = s.treasury_end
      if (s.lp_usdc_end < minLp) minLp = s.lp_usdc_end
      if (s.sold_over_lp > maxSol) maxSol = s.sold_over_lp
      totalPayout += s.node_payout_usdc_capped
      totalPrincipal += s.junior_new * config.junior_invest_usdc + s.senior_new * config.senior_invest_usdc
      totalVaultPlatformIncome += s.platform_vault_income_today
      totalReferralPayout += s.referral_payout_today
      totalPerfPenalty += s.perf_penalty_usdc
      totalPerfCarry += s.perf_carry_usdc
      if (s.perf_pass_rate > 0) {
        avgPassRate += s.perf_pass_rate
        passRateCount++
      }
    }

    const minPrice = Math.min(...slice.map((s) => s.price_end))
    const maxDrawdown = peak > 0 ? (peak - minPrice) / peak : 0

    // ---- Pressure Score (Section 1) ----
    const pressureScore = computePressureScore(maxSol, maxDrawdown, minTreasury, config.treasury_start_usdc, pt)
    const pressureLabel = toPressureLabel(pressureScore)

    // ---- KPI-A: Growth ----
    const targetJunior = gt.target_junior_90 * Math.min(sd / 90, 1)
    const targetSenior = gt.target_senior_90 * Math.min(sd / 90, 1)
    const growthKpi: "PASS" | "FAIL" =
      r.junior_cum >= targetJunior * 0.8 && r.senior_cum >= targetSenior * 0.8 ? "PASS" : "FAIL"

    // ---- KPI-B: Payout Sustainability ----
    const payoutRatio = totalPrincipal > 0 ? totalPayout / totalPrincipal : 0
    const sustLabel = toSustainabilityLabel(payoutRatio)

    // ---- KPI-D: Liquidity ----
    const liqLabel: "PASS" | "FAIL" = r.lp_usdc_end >= lpThreshold ? "PASS" : "FAIL"

    // ---- Recommendation Generator (Section 3) ----
    const recs: string[] = []

    if (pressureLabel === "DANGER") {
      recs.push("日卖压相对LP过高，需增加LP深度或降低释放/卖出比例。")
      if (maxSol > pt.targetSoldOverLP) {
        recs.push("建议降低卖压比例或提高销毁计划阈值。")
      }
      if (maxDrawdown > pt.targetDrawdown) {
        recs.push("建议提高国库回购比例以稳定价格。")
      }
      recs.push("若支付压力过大，考虑降低增长率或初级月新增。")
    } else if (pressureLabel === "RISK") {
      recs.push("接近危险区域，建议降低增长速度或增加LP深度。")
    }

    if (sustLabel === "UNSUSTAINABLE") {
      recs.push("兑付总额超过本金流入，建议降低日收益率或减少包奖励。")
      recs.push("国库通过USDC兑换MX进行兑付，若国库压力过大可降低USDC支付覆盖率。")
    } else if (sustLabel === "TIGHT") {
      recs.push("国库MX兑付比率趋紧，需密切监控并准备调整费率。")
    }

    if (liqLabel === "FAIL") {
      recs.push("LP USDC低于最低阈值，需增加LP深度或降低卖压。")
    }

    if (growthKpi === "FAIL" && sd >= 60) {
      recs.push("节点增长未达目标，考虑加强营销或调整激励方案。")
    }

    // ---- KPI-E: Vault ----
    let vaultKpi: "PASS" | "FAIL" | "N/A" = "N/A"
    const totalNodes = r.junior_cum + r.senior_cum
    const stakerTarget = totalNodes * vaultStakerRatio
    const stakedTarget = totalPrincipal * vaultStakedRatio
    if (r.vault_open) {
      vaultKpi = r.vault_stakers >= stakerTarget && r.vault_total_staked_usdc >= stakedTarget ? "PASS" : "FAIL"

      if (vaultKpi === "FAIL") {
        recs.push("质押用户或金额未达标，考虑提高转化率或降低门槛。")
      }
    } else {
      recs.push("金库尚未开启，节点招募中。")
    }

    const perfAvgPassRate = passRateCount > 0 ? avgPassRate / passRateCount : 0
    if (perfAvgPassRate > 0 && perfAvgPassRate < 0.5) {
      recs.push("V级业绩达标率偏低，建议降低V级门槛或增加金库推广力度。")
    }

    if (recs.length === 0) {
      recs.push("系统运行在安全参数范围内，所有KPI指标健康。")
    }

    // ---- Node recruitment KPI metrics ----
    const totalNodeTarget = targetJunior + targetSenior
    const juniorCompletion = targetJunior > 0 ? r.junior_cum / targetJunior : 0
    const seniorCompletion = targetSenior > 0 ? r.senior_cum / targetSenior : 0
    const totalNodeCompletion = totalNodeTarget > 0 ? totalNodes / totalNodeTarget : 0
    const nodeGrowthVelocity = sd > 0 ? totalNodes / sd : 0

    // ---- Vault staking KPI metrics ----
    const vaultStakerCompletion = stakerTarget > 0 ? r.vault_stakers / stakerTarget : 0
    const vaultStakedCompletion = stakedTarget > 0 ? r.vault_total_staked_usdc / stakedTarget : 0

    // ---- Market cost metrics ----
    const avgInvestPerNode = totalNodes > 0 ? totalPrincipal / totalNodes : 0
    const referralCostRatio = totalPrincipal > 0 ? totalReferralPayout / totalPrincipal : 0

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
      total_mx_emitted: r.total_mx_emitted,
      total_mx_deferred: r.total_mx_deferred,
      total_mx_sold: r.total_mx_sold,
      total_mx_buyback: r.total_mx_buyback,
      total_mx_redemptions: r.total_mx_redemptions,
      total_mx_burned: r.total_mx_burned,
      net_sell_pressure: r.total_mx_sold - r.total_mx_buyback,
      junior_cum: r.junior_cum,
      senior_cum: r.senior_cum,
      pressure_score: pressureScore,
      pressure_label: pressureLabel,
      growth_kpi: growthKpi,
      sustainability_label: sustLabel,
      liquidity_label: liqLabel,
      payout_ratio: payoutRatio,
      vault_open: r.vault_open,
      vault_stakers: r.vault_stakers,
      vault_total_staked_usdc: r.vault_total_staked_usdc,
      vault_platform_income: totalVaultPlatformIncome,
      vault_reserve_usdc: r.vault_total_staked_usdc,
      total_referral_payout: totalReferralPayout,
      vault_kpi: vaultKpi,
      recommendation: recs.join(" "),

      // Node recruitment KPI
      junior_target: targetJunior,
      senior_target: targetSenior,
      junior_completion: juniorCompletion,
      senior_completion: seniorCompletion,
      total_node_target: totalNodeTarget,
      total_node_completion: totalNodeCompletion,
      node_growth_velocity: nodeGrowthVelocity,

      // Vault staking KPI
      vault_staker_target: stakerTarget,
      vault_staker_completion: vaultStakerCompletion,
      vault_staked_target: stakedTarget,
      vault_staked_completion: vaultStakedCompletion,

      // Market cost
      avg_invest_per_node: avgInvestPerNode,
      referral_cost_ratio: referralCostRatio,

      // V级业绩
      perf_avg_pass_rate: perfAvgPassRate,
      perf_total_penalty_usdc: totalPerfPenalty,
      perf_total_carry_usdc: totalPerfCarry,
    })
  }

  return result
}
