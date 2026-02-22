import type { ModelParams, Cohort, ReleaseItem, VlevelTarget } from "../config/types"
import { blendRateMap, blendKeyMap } from "./blendRates"

function computeVlevelPassRate(
  vlevel: number,
  vault_total_staked_usdc: number,
  total_active_agents: number,
  discount: number,
  targets: Record<number, VlevelTarget>,
  enabled: boolean,
): number {
  if (!enabled) return 1.0
  const avg_perf = vault_total_staked_usdc * discount / Math.max(total_active_agents, 1)
  const target = targets[vlevel]
  if (!target) return 1.0
  const required = target.community_performance
  return Math.max(0, Math.min(1, avg_perf / required))
}

export interface DailyRow {
  day: number
  month_idx: number
  junior_new: number
  senior_new: number
  junior_cum: number
  senior_cum: number
  junior_unlocked_users: number
  senior_unlocked_users: number
  junior_active_cohorts: number
  senior_active_cohorts: number
  junior_maxed_cohorts: number
  senior_maxed_cohorts: number
  junior_daily_income_usdc: number
  senior_daily_income_usdc: number
  node_payout_usdc_today: number
  node_payout_usdc_capped: number
  payout_mx_today: number
  // MX Burn Gate
  mx_buy_usdc: number
  mx_burn_amount: number
  // Treasury redemption (MX)
  redemption_mx: number
  // Burn + release
  burn_rate: number
  instant_release_ratio: number
  instant_release_mx: number
  linear_release_mx: number
  released_mx_today: number
  released_mx_after_redemption: number
  sold_mx_today: number
  // AMM sell
  lp_usdc_begin: number
  lp_token_begin: number
  usdc_out: number
  price_after_sell: number
  // Treasury buyback
  treasury_defense_active: boolean
  buyback_budget_usdc: number
  mx_buyback_out: number
  price_after_buyback: number
  net_sell_mx: number
  // Final LP
  lp_usdc_end: number
  lp_token_end: number
  amm_fee_rate: number
  price_end: number
  // Treasury
  treasury_begin: number
  treasury_inflow: number
  treasury_outflow: number
  treasury_end: number
  // Derived
  sold_over_lp: number
  price_change: number
  // Cumulative
  total_mx_emitted: number
  total_mx_deferred: number
  total_mx_sold: number
  total_mx_burned: number
  total_mx_redemptions: number
  total_mx_buyback: number
  // Vault / insurance
  vault_open: boolean
  vault_stakers: number
  vault_total_staked_usdc: number
  vault_avg_lock_days: number
  vault_stake_ratio: number
  vault_profit_today: number
  platform_vault_income_today: number
  insurance_payout_today: number
  // Vault reserve
  vault_reserve_usdc: number
  vault_new_stake_today_usdc: number
  // Referral
  referral_payout_today: number
  total_referral_payout: number
  // V级业绩
  perf_pass_rate: number
  perf_penalty_usdc: number
  perf_carry_usdc: number
}

// ---- Milestone definitions ----

interface Milestone {
  target_days: number
  has_bonus: boolean
  required_vlevel: number
}

function getJuniorMilestones(p: ModelParams): Milestone[] {
  return [
    { target_days: p.junior_target_v2_days, has_bonus: false, required_vlevel: 2 },
    { target_days: p.junior_target_v3_days, has_bonus: true, required_vlevel: 3 },
  ]
}

function getSeniorMilestones(p: ModelParams): Milestone[] {
  return [
    { target_days: p.senior_target_v1_days, has_bonus: false, required_vlevel: 1 },
    { target_days: p.senior_target_v2_days, has_bonus: false, required_vlevel: 2 },
    { target_days: p.senior_target_v3_days, has_bonus: false, required_vlevel: 3 },
    { target_days: p.senior_target_v4_days, has_bonus: false, required_vlevel: 4 },
    { target_days: p.senior_target_v6_days, has_bonus: true, required_vlevel: 6 },
  ]
}

// ---- Main simulation ----

export function simulate(p: ModelParams): DailyRow[] {
  const rows: DailyRow[] = []

  const juniorCohorts: Cohort[] = []
  const seniorCohorts: Cohort[] = []
  const releaseQueue: ReleaseItem[] = []

  let lp_usdc_current = p.lp_usdc
  let lp_token_current = p.lp_token
  let prev_treasury_end = p.treasury_start_usdc
  let prev_price = lp_token_current > 0 ? lp_usdc_current / lp_token_current : p.price_token

  let cum_mx_emitted = 0
  let cum_mx_deferred = 0
  let cum_mx_sold = 0
  let cum_mx_burned = 0
  let cum_mx_redemptions = 0
  let cum_mx_buyback = 0

  let junior_cum = 0
  let senior_cum = 0

  // Track peak price for drawdown computation
  let peak_price = prev_price

  let cum_referral_payout = 0

  const burnRate = blendRateMap(p.burn_schedule, p.blend_mode)
  const jMilestones = getJuniorMilestones(p)
  const sMilestones = getSeniorMilestones(p)

  const vaultRate = blendRateMap(p.vault_rates, p.blend_mode)
  const vaultAvgLockDays = blendKeyMap(p.vault_rates, p.blend_mode)

  let vault_opened = false
  let vault_open_day_actual = 0 // the day vault actually opened

  const trigger = p.treasury_buyback_trigger

  for (let day = 1; day <= p.sim_days; day++) {
    const month_idx = Math.floor((day - 1) / 30) + 1

    // ---- Growth ----
    const monthlyNew = (base: number): number => {
      if (p.growth_mode === 1) return base
      return base * Math.pow(1 + p.growth_rate, month_idx - 1)
    }
    const junior_new = Math.min(
      Math.round(monthlyNew(p.junior_monthly_new) / 30),
      Math.max(0, p.junior_max_nodes - junior_cum),
    )
    const senior_new = Math.min(
      Math.round(monthlyNew(p.senior_monthly_new) / 30),
      Math.max(0, p.senior_max_nodes - senior_cum),
    )
    junior_cum += junior_new
    senior_cum += senior_new

    if (junior_new > 0) {
      juniorCohorts.push({ start_day: day, users: junior_new, invest_usdc: p.junior_invest_usdc, earned_usdc: 0, is_maxed: false, carry_usdc: 0 })
    }
    if (senior_new > 0) {
      seniorCohorts.push({ start_day: day, users: senior_new, invest_usdc: p.senior_invest_usdc, earned_usdc: 0, is_maxed: false, carry_usdc: 0 })
    }

    // ---- Referral payout ----
    let referral_payout_today = 0
    if (p.referral_enabled && p.referral_bonus_ratio > 0) {
      const new_invest = junior_new * p.junior_invest_usdc + senior_new * p.senior_invest_usdc
      referral_payout_today = new_invest * p.referral_bonus_ratio * p.referral_participation_rate
      cum_referral_payout += referral_payout_today
    }

    const current_price = lp_token_current > 0 ? lp_usdc_current / lp_token_current : p.price_token

    // ================================================================
    // PRE-STEP: Vault calculation (needed for V-level performance check)
    // ================================================================
    // ---- Vault phase check ----
    if (!vault_opened) {
      const cond1 = p.vault_open_day > 0 && day >= p.vault_open_day
      const cond2 = p.vault_open_on_node_full && junior_cum >= p.junior_max_nodes && senior_cum >= p.senior_max_nodes
      if (cond1 || cond2) {
        vault_opened = true
        vault_open_day_actual = day
      }
    }

    // ---- Vault stakers & principal ----
    let vault_stakers = 0
    let vault_total_staked_usdc = 0
    let vault_profit_today = 0
    let platform_vault_income_today = 0

    if (vault_opened) {
      const days_since_open = day - vault_open_day_actual
      const months_since_open = days_since_open / 30

      const convert_users = (junior_cum + senior_cum) * p.vault_convert_ratio

      let external_users = 0
      const full_months = Math.floor(months_since_open)
      for (let m = 0; m < full_months; m++) {
        external_users += p.vault_monthly_new * Math.pow(1 + p.vault_user_growth_rate, m)
      }
      const partial_days = days_since_open - full_months * 30
      if (partial_days > 0) {
        external_users += p.vault_monthly_new * Math.pow(1 + p.vault_user_growth_rate, full_months) * (partial_days / 30)
      }

      vault_stakers = Math.round(convert_users + external_users)
      vault_total_staked_usdc = vault_stakers * p.vault_avg_stake_usdc
      vault_profit_today = vault_total_staked_usdc * vaultRate
      platform_vault_income_today = vault_profit_today * p.platform_fee_ratio
    }

    // ================================================================
    // STEP 1: Milestone payouts (with V-level performance check)
    // ================================================================
    let day_perf_penalty = 0
    let day_perf_carry = 0
    let current_pass_rate = 0

    let junior_payout_raw = 0, junior_payout_capped = 0, junior_unlocked = 0, junior_active = 0, junior_maxed = 0
    for (const c of juniorCohorts) {
      if (c.is_maxed) { junior_maxed += c.users; continue }
      junior_active += c.users
    }

    let senior_payout_raw = 0, senior_payout_capped = 0, senior_unlocked = 0, senior_active = 0, senior_maxed = 0
    for (const c of seniorCohorts) {
      if (c.is_maxed) { senior_maxed += c.users; continue }
      senior_active += c.users
    }

    const total_active_agents = junior_active + senior_active

    for (const c of juniorCohorts) {
      if (c.is_maxed) continue
      const age = day - c.start_day
      for (let mi = 0; mi < jMilestones.length; mi++) {
        const m = jMilestones[mi]
        if (age !== m.target_days) continue
        junior_unlocked += c.users
        const stat = p.junior_package_usdc * p.junior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.junior_package_usdc : 0
        const base = stat + bonus + c.carry_usdc

        const pass_rate = computeVlevelPassRate(
          m.required_vlevel, vault_total_staked_usdc,
          total_active_agents, p.performance_discount_ratio,
          p.vlevel_targets, p.milestone_performance_enabled,
        )
        current_pass_rate = pass_rate

        const passed_payout = base * pass_rate
        const failed_payout = base * (1 - pass_rate)
        const penalty = failed_payout * 0.5
        const carry = failed_payout * 0.5
        day_perf_penalty += penalty * c.users
        day_perf_carry += carry * c.users

        const isLast = mi === jMilestones.length - 1
        if (isLast) {
          day_perf_penalty += carry * c.users
          c.carry_usdc = 0
        } else {
          c.carry_usdc = carry
        }

        const actual_total = passed_payout
        const cap = c.invest_usdc * p.max_out_multiple
        const rem = Math.max(0, cap - c.earned_usdc)
        const actual = Math.min(actual_total, rem)
        junior_payout_raw += base * c.users
        junior_payout_capped += actual * c.users
        c.earned_usdc += actual
        if (c.earned_usdc >= cap) c.is_maxed = true
      }
    }

    for (const c of seniorCohorts) {
      if (c.is_maxed) continue
      const age = day - c.start_day
      for (let mi = 0; mi < sMilestones.length; mi++) {
        const m = sMilestones[mi]
        if (age !== m.target_days) continue
        senior_unlocked += c.users
        const stat = p.senior_package_usdc * p.senior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.senior_package_usdc : 0
        const base = stat + bonus + c.carry_usdc

        const pass_rate = computeVlevelPassRate(
          m.required_vlevel, vault_total_staked_usdc,
          total_active_agents, p.performance_discount_ratio,
          p.vlevel_targets, p.milestone_performance_enabled,
        )
        current_pass_rate = pass_rate

        const passed_payout = base * pass_rate
        const failed_payout = base * (1 - pass_rate)
        const penalty = failed_payout * 0.5
        const carry = failed_payout * 0.5
        day_perf_penalty += penalty * c.users
        day_perf_carry += carry * c.users

        const isLast = mi === sMilestones.length - 1
        if (isLast) {
          day_perf_penalty += carry * c.users
          c.carry_usdc = 0
        } else {
          c.carry_usdc = carry
        }

        const actual_total = passed_payout
        const cap = c.invest_usdc * p.max_out_multiple
        const rem = Math.max(0, cap - c.earned_usdc)
        const actual = Math.min(actual_total, rem)
        senior_payout_raw += base * c.users
        senior_payout_capped += actual * c.users
        c.earned_usdc += actual
        if (c.earned_usdc >= cap) c.is_maxed = true
      }
    }

    const node_payout_usdc_today = junior_payout_raw + senior_payout_raw
    const node_payout_usdc_capped = junior_payout_capped + senior_payout_capped
    const payout_mx_today = current_price > 0 ? node_payout_usdc_capped / current_price : 0
    cum_mx_emitted += payout_mx_today

    // ================================================================
    // STEP 2: Burn schedule + release queue
    // ================================================================
    const burn_rate = burnRate
    const instant_release_ratio = 1 - burn_rate
    const instant_release_mx = payout_mx_today * instant_release_ratio
    const linear_total_mx = payout_mx_today * burn_rate
    cum_mx_deferred += linear_total_mx

    if (linear_total_mx > 0 && p.linear_release_days > 0) {
      releaseQueue.push({ remaining_mx: linear_total_mx, days_left: p.linear_release_days })
    }

    let linear_release_mx = 0
    for (let i = releaseQueue.length - 1; i >= 0; i--) {
      const item = releaseQueue[i]
      if (item.days_left <= 0) { releaseQueue.splice(i, 1); continue }
      const portion = item.remaining_mx / item.days_left
      linear_release_mx += portion
      item.remaining_mx -= portion
      item.days_left -= 1
      if (item.days_left <= 0) releaseQueue.splice(i, 1)
    }

    const released_mx_today = instant_release_mx + linear_release_mx

    // ================================================================
    // STEP 3: MX Burn Gate — BEFORE selling MX
    // ================================================================
    let mx_buy_usdc = 0
    let mx_burn_amount = 0

    if (p.mx_burn_per_withdraw_ratio > 0 && released_mx_today > 0) {
      let withdraw_value_usdc: number
      if (p.mx_burn_mode === "usdc_value") {
        withdraw_value_usdc = node_payout_usdc_capped
      } else {
        withdraw_value_usdc = payout_mx_today * current_price
      }
      mx_buy_usdc = withdraw_value_usdc * p.mx_burn_per_withdraw_ratio
      mx_burn_amount = p.mx_price_usdc > 0 ? mx_buy_usdc / p.mx_price_usdc : 0
      cum_mx_burned += mx_burn_amount
    }

    // ================================================================
    // STEP 4: Treasury redemption (兑付) — 直接扣减释放的 MX，不消耗国库 USDC
    // ================================================================
    let redemption_mx = 0
    let released_mx_after_redemption = released_mx_today

    if (p.treasury_defense_enabled && p.treasury_redemption_ratio > 0 && released_mx_today > 0) {
      redemption_mx = released_mx_today * p.treasury_redemption_ratio
      released_mx_after_redemption = released_mx_today - redemption_mx
      cum_mx_redemptions += redemption_mx
    }

    // ================================================================
    // STEP 5: Sell pressure
    // ================================================================
    const sold_mx_today = released_mx_after_redemption * p.sell_pressure_ratio
    cum_mx_sold += sold_mx_today

    // ================================================================
    // STEP 6: AMM MX->USDC swap (sell)
    // ================================================================
    const lp_usdc_begin = lp_usdc_current
    const lp_token_begin = lp_token_current
    let usdc_out = 0
    let price_after_sell = current_price

    if (sold_mx_today > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
      const k = lp_usdc_current * lp_token_current
      const mx_eff = sold_mx_today * (1 - p.amm_fee_rate)
      const new_lp_token = lp_token_current + mx_eff
      const new_lp_usdc = k / new_lp_token
      usdc_out = lp_usdc_current - new_lp_usdc
      lp_usdc_current = new_lp_usdc
      lp_token_current = new_lp_token
      price_after_sell = lp_usdc_current / lp_token_current
    }

    // ================================================================
    // STEP 7: Treasury buyback (USDC->MX, supports price)
    // ================================================================
    let treasury_defense_active = false
    let buyback_budget_usdc = 0
    let mx_buyback_out = 0
    let price_after_buyback = price_after_sell

    // Compute treasury inflow first (needed for budget)
    const inflow_node = junior_new * p.junior_invest_usdc + senior_new * p.senior_invest_usdc
    const external_profit_daily = (p.external_profit_monthly / 30) * Math.pow(1 + p.external_profit_growth_rate, month_idx - 1)
    const treasury_inflow_raw = inflow_node + external_profit_daily + platform_vault_income_today

    if (p.treasury_defense_enabled && p.treasury_buyback_ratio > 0) {
      // Check trigger conditions
      const drawdown_to_date = peak_price > 0 ? (price_after_sell - peak_price) / peak_price : 0
      const sold_over_lp_today = lp_usdc_begin > 0 ? usdc_out / lp_usdc_begin : 0

      if (
        drawdown_to_date <= p.treasury_buyback_trigger.drawdown_threshold ||
        sold_over_lp_today >= p.treasury_buyback_trigger.sold_over_lp_threshold ||
        lp_usdc_current <= p.treasury_buyback_trigger.lp_usdc_min_threshold
      ) {
        treasury_defense_active = true
      }

      let budget = treasury_inflow_raw * p.treasury_buyback_ratio
      if (treasury_defense_active) budget *= 2

      // Cannot exceed treasury - min buffer
      // Use projected treasury: begin + inflow - other outflows so far
      const projected = prev_treasury_end + treasury_inflow_raw - (p.mx_burn_from === "treasury" ? mx_buy_usdc : 0)
      const max_spend = Math.max(0, projected - trigger.treasury_min_buffer)
      budget = Math.min(budget, max_spend)

      if (budget > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
        buyback_budget_usdc = budget
        const k = lp_usdc_current * lp_token_current
        const usdc_eff = buyback_budget_usdc * (1 - p.amm_fee_rate)
        const new_lp_usdc = lp_usdc_current + usdc_eff
        const new_lp_token = k / new_lp_usdc
        mx_buyback_out = lp_token_current - new_lp_token
        lp_usdc_current = new_lp_usdc
        lp_token_current = new_lp_token
        price_after_buyback = lp_usdc_current / lp_token_current
        cum_mx_buyback += mx_buyback_out
      }
    }

    const net_sell_mx = sold_mx_today - mx_buyback_out

    // ================================================================
    // STEP 8: Final price
    // ================================================================
    const price_end = price_after_buyback
    if (price_end > peak_price) peak_price = price_end

    // ---- Insurance ----
    let insurance_payout_today = 0
    if (p.insurance_enabled) {
      const loss = 1 - (price_end / p.price_token)
      if (loss > 0) {
        const avg = (p.junior_invest_usdc + p.senior_invest_usdc) / 2
        const mult = loss < 0.1 ? p.insurance_payout_low_loss_multiple : p.insurance_payout_high_loss_multiple
        insurance_payout_today = avg * mult * (junior_new + senior_new) * 0.01
      }
    }

    // ---- Treasury ----
    const treasury_begin = prev_treasury_end
    const treasury_inflow = treasury_inflow_raw
    const treasury_outflow =
      buyback_budget_usdc +
      (p.mx_burn_from === "treasury" ? mx_buy_usdc : 0) +
      (p.lp_owned_by_treasury ? usdc_out : 0) +
      insurance_payout_today +
      referral_payout_today
    const treasury_end = treasury_begin + treasury_inflow - treasury_outflow
    prev_treasury_end = treasury_end

    // ---- Derived ----
    const sold_over_lp = lp_usdc_begin === 0 ? 0 : usdc_out / lp_usdc_begin
    const price_change = prev_price === 0 ? 0 : price_end / prev_price - 1
    prev_price = price_end

    rows.push({
      day, month_idx,
      junior_new, senior_new, junior_cum, senior_cum,
      junior_unlocked_users: junior_unlocked,
      senior_unlocked_users: senior_unlocked,
      junior_active_cohorts: junior_active,
      senior_active_cohorts: senior_active,
      junior_maxed_cohorts: junior_maxed,
      senior_maxed_cohorts: senior_maxed,
      junior_daily_income_usdc: p.junior_package_usdc * p.junior_daily_rate,
      senior_daily_income_usdc: p.senior_package_usdc * p.senior_daily_rate,
      node_payout_usdc_today, node_payout_usdc_capped, payout_mx_today,
      mx_buy_usdc, mx_burn_amount,
      redemption_mx,
      burn_rate, instant_release_ratio,
      instant_release_mx, linear_release_mx,
      released_mx_today, released_mx_after_redemption, sold_mx_today,
      lp_usdc_begin, lp_token_begin, usdc_out, price_after_sell,
      treasury_defense_active, buyback_budget_usdc, mx_buyback_out, price_after_buyback, net_sell_mx,
      lp_usdc_end: lp_usdc_current, lp_token_end: lp_token_current,
      amm_fee_rate: p.amm_fee_rate, price_end,
      treasury_begin, treasury_inflow, treasury_outflow, treasury_end,
      sold_over_lp, price_change,
      total_mx_emitted: cum_mx_emitted, total_mx_deferred: cum_mx_deferred, total_mx_sold: cum_mx_sold,
      total_mx_burned: cum_mx_burned, total_mx_redemptions: cum_mx_redemptions, total_mx_buyback: cum_mx_buyback,
      vault_open: vault_opened,
      vault_stakers,
      vault_total_staked_usdc,
      vault_avg_lock_days: vault_opened ? vaultAvgLockDays : 0,
      vault_stake_ratio: (junior_cum * p.junior_invest_usdc + senior_cum * p.senior_invest_usdc) > 0
        ? vault_total_staked_usdc / (junior_cum * p.junior_invest_usdc + senior_cum * p.senior_invest_usdc)
        : 0,
      vault_profit_today, platform_vault_income_today, insurance_payout_today,
      vault_reserve_usdc: vault_total_staked_usdc,
      vault_new_stake_today_usdc: vault_total_staked_usdc - (rows.length > 0 ? rows[rows.length - 1].vault_total_staked_usdc : 0),
      referral_payout_today,
      total_referral_payout: cum_referral_payout,
      perf_pass_rate: current_pass_rate,
      perf_penalty_usdc: day_perf_penalty,
      perf_carry_usdc: day_perf_carry,
    })
  }

  return rows
}
