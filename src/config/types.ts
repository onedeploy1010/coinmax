export type GrowthMode = 1 | 2

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
  platform_fee_ratio: number
  early_unstake_penalty_ratio: number

  subscription_monthly_fee: number
  subscription_half_year_fee: number
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
}
