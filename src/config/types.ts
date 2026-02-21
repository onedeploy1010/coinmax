export type GrowthMode = 1 | 2
export type BlendMode = "aggressive" | "longterm" | "weighted" | "average"

export interface TreasuryBuybackTrigger {
  drawdown_threshold: number
  sold_over_lp_threshold: number
  lp_usdc_min_threshold: number
  treasury_min_buffer: number
}

export interface ModelParams {
  price_token: number
  lp_usdc: number
  lp_token: number
  amm_fee_rate: number
  sell_pressure_ratio: number
  slippage_model: "cpmm"

  growth_mode: GrowthMode
  growth_rate: number
  junior_monthly_new: number
  senior_monthly_new: number
  junior_max_nodes: number
  senior_max_nodes: number
  sim_days: number

  junior_invest_usdc: number
  senior_invest_usdc: number
  junior_package_usdc: number
  senior_package_usdc: number
  junior_daily_rate: number
  senior_daily_rate: number

  junior_target_v2_days: number
  junior_target_v3_days: number
  senior_target_v1_days: number
  senior_target_v2_days: number
  senior_target_v3_days: number
  senior_target_v4_days: number
  senior_target_v6_days: number

  max_out_multiple: number
  cap_include_static: boolean
  cap_include_dynamic: boolean

  withdraw_delay_days: number
  burn_schedule: Record<number, number>
  linear_release_days: number

  vault_rates: Record<number, number>
  blend_mode: BlendMode
  platform_fee_ratio: number
  early_unstake_penalty_ratio: number

  subscription_monthly_fee: number
  subscription_half_year_fee: number
  insurance_enabled: boolean
  insurance_min_usdc: number
  insurance_max_usdc: number
  insurance_payout_low_loss_multiple: number
  insurance_payout_high_loss_multiple: number

  treasury_start_usdc: number
  external_profit_monthly: number
  external_profit_growth_rate: number
  usdc_payout_cover_ratio: number
  lp_owned_by_treasury: boolean

  node_payout_mode: 1 | 2

  // ---- 金库开启条件 ----
  vault_open_day: number           // 固定开启日（0 = 不按天数触发）
  vault_open_on_node_full: boolean // 节点招满时开启

  // ---- 金库用户增长 ----
  vault_convert_ratio: number      // 节点→质押用户转化率
  vault_monthly_new: number        // 独立外部月新增质押用户
  vault_user_growth_rate: number   // 外部质押用户月增长率
  vault_avg_stake_usdc: number     // 平均每人质押 USDC

  // ---- MX Burn Gate (Section A) ----
  mx_price_usdc: number
  mx_burn_per_withdraw_ratio: number
  mx_burn_mode: "usdc_value" | "ar_amount"
  mx_amm_enabled: boolean
  mx_burn_from: "user" | "treasury"

  // ---- Treasury Defense Toolkit (Section B) ----
  treasury_defense_enabled: boolean
  treasury_buyback_ratio: number
  treasury_redemption_ratio: number
  treasury_buyback_trigger: TreasuryBuybackTrigger
}

// ---- Cohort-based accounting ----

export interface Cohort {
  start_day: number
  users: number
  invest_usdc: number
  earned_usdc: number
  is_maxed: boolean
}

// ---- Release queue ----

export interface ReleaseItem {
  remaining_ar: number
  days_left: number
}

// ---- Stress test ----

export interface StressRange {
  key: string
  min: number
  max: number
  step: number
}

export interface FailRules {
  min_treasury_usdc: number
  min_lp_usdc: number
  max_price_drawdown: number
  max_sold_over_lp: number
}

export interface StressConfig {
  ranges: StressRange[]
  failRules: FailRules
  maxRuns: number
}

export interface StressSummary {
  params: Record<string, number>
  final_price: number
  min_price: number
  max_drawdown: number
  final_lp_usdc: number
  min_lp_usdc: number
  min_treasury: number
  final_treasury: number
  max_sold_over_lp: number
  total_payout_usdc: number
  total_ar_emitted: number
  total_ar_buyback: number
  total_mx_burned: number
  total_usdc_redemptions: number
  net_sell_pressure: number
  fail_reason: string | null
}

export interface ThresholdResult {
  key: string
  label: string
  safe_value: number
  direction: "max" | "min"
}

// ---- Investor Dashboard (Stage Checkpoints + Optimizer) ----

export type OptObjective = "max_safety" | "balanced" | "max_growth"
export type PressureLabel = "SAFE" | "WATCH" | "RISK" | "DANGER"
export type SustainabilityLabel = "HEALTHY" | "TIGHT" | "UNSUSTAINABLE"

export interface PressureTargets {
  targetSoldOverLP: number
  targetDrawdown: number
  targetTreasuryStress: number
}

export interface GrowthTargets {
  target_junior_90: number
  target_senior_90: number
}

export interface StageCheckpoint {
  day: number
  price: number
  lp_usdc: number
  treasury: number
  min_treasury: number
  min_lp_usdc: number
  max_drawdown: number
  max_sold_over_lp: number
  total_payout_usdc: number
  total_principal_inflow: number
  total_ar_emitted: number
  total_ar_burned: number
  total_ar_sold: number
  total_ar_buyback: number
  total_usdc_redemptions: number
  total_mx_burned: number
  net_sell_pressure: number
  junior_cum: number
  senior_cum: number
  pressure_score: number
  pressure_label: PressureLabel
  growth_kpi: "PASS" | "FAIL"
  sustainability_label: SustainabilityLabel
  liquidity_label: "PASS" | "FAIL"
  payout_ratio: number
  vault_open: boolean
  vault_stakers: number
  vault_total_staked_usdc: number
  vault_platform_income: number
  vault_kpi: "PASS" | "FAIL" | "N/A"
  recommendation: string
}

export interface OptimizerConstraints {
  min_treasury_usdc: number
  min_lp_usdc: number
  max_drawdown: number
  max_sold_over_lp: number
}

export interface OptSearchRange {
  key: string
  label: string
  values: number[]
  enabled: boolean
}

export interface OptResultItem {
  rank: number
  overrides: Record<string, number>
  summary: StressSummary
  score: number
}

export interface OptRunResult {
  objective: OptObjective
  baseline: StressSummary
  results: OptResultItem[]
}
