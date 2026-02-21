import type { ModelParams } from "./types"

export const defaultConfig: ModelParams = {
  price_token: 1,
  lp_usdc: 100000,
  lp_token: 100000,
  amm_fee_rate: 0.003,
  sell_pressure_ratio: 0.5,
  slippage_model: "cpmm",

  growth_mode: 1,
  growth_rate: 0.2,
  junior_monthly_new: 500,
  senior_monthly_new: 100,
  junior_max_nodes: 2000,
  senior_max_nodes: 1000,
  sim_days: 180,

  junior_invest_usdc: 100,
  senior_invest_usdc: 1000,
  junior_package_usdc: 1000,
  senior_package_usdc: 10000,
  junior_daily_rate: 0.005,
  senior_daily_rate: 0.009,

  junior_target_v2_days: 60,
  junior_target_v3_days: 90,
  senior_target_v1_days: 15,
  senior_target_v2_days: 30,
  senior_target_v3_days: 60,
  senior_target_v4_days: 90,
  senior_target_v6_days: 120,

  max_out_multiple: 3,
  cap_include_static: true,
  cap_include_dynamic: true,

  burn_schedule: { 0: 0.20, 7: 0.15, 15: 0.10, 30: 0.05, 60: 0.00 },
  linear_release_days: 30,

  vault_rates: { 7: 0.005, 30: 0.007, 90: 0.009, 180: 0.012, 360: 0.015 },
  blend_mode: "average",
  platform_fee_ratio: 0.10,
  early_unstake_penalty_ratio: 0.20,

  subscription_monthly_fee: 39,
  subscription_half_year_fee: 198,
  insurance_enabled: false,
  insurance_min_usdc: 100,
  insurance_max_usdc: 2000,
  insurance_payout_low_loss_multiple: 3,
  insurance_payout_high_loss_multiple: 4,

  treasury_start_usdc: 100000,
  external_profit_monthly: 0,
  external_profit_growth_rate: 0,
  usdc_payout_cover_ratio: 0,
  lp_owned_by_treasury: false,

  node_payout_mode: 1,

  // 金库开启条件 & 用户增长
  vault_open_day: 30,
  vault_open_on_node_full: true,
  vault_convert_ratio: 0.30,
  vault_monthly_new: 200,
  vault_user_growth_rate: 0.10,
  vault_avg_stake_usdc: 500,

  // MX Burn Gate
  mx_price_usdc: 1,
  mx_burn_per_withdraw_ratio: 0.10,
  mx_burn_mode: "usdc_value",
  mx_amm_enabled: false,
  mx_burn_from: "user",

  // Treasury Defense
  treasury_defense_enabled: true,
  treasury_buyback_ratio: 0.10,
  treasury_redemption_ratio: 0,
  treasury_buyback_trigger: {
    drawdown_threshold: -0.30,
    sold_over_lp_threshold: 0.20,
    lp_usdc_min_threshold: 20000,
    treasury_min_buffer: 50000,
  },
}
