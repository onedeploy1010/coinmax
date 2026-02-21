import type { ModelParams, Cohort, ReleaseItem } from "../config/types"

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
  payout_ar_today: number
  // MX Burn Gate
  mx_buy_usdc: number
  mx_burn_amount: number
  // Treasury redemption
  redemption_usdc: number
  ar_redeemed_equivalent: number
  // Burn + release
  burn_rate: number
  instant_release_ratio: number
  instant_release_ar: number
  linear_release_ar: number
  released_ar_today: number
  released_ar_after_redemption: number
  sold_ar_today: number
  // AMM sell
  lp_usdc_begin: number
  lp_token_begin: number
  usdc_out: number
  price_after_sell: number
  // Treasury buyback
  treasury_defense_active: boolean
  buyback_budget_usdc: number
  ar_buyback_out: number
  price_after_buyback: number
  net_sell_ar: number
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
  total_ar_emitted: number
  total_ar_burned: number
  total_ar_sold: number
  total_mx_burned: number
  total_usdc_redemptions: number
  total_ar_buyback: number
  // Vault / insurance
  vault_profit_today: number
  platform_vault_income_today: number
  insurance_payout_today: number
}

// ---- Milestone definitions ----

interface Milestone {
  target_days: number
  has_bonus: boolean
}

function getJuniorMilestones(p: ModelParams): Milestone[] {
  return [
    { target_days: p.junior_target_v2_days, has_bonus: false },
    { target_days: p.junior_target_v3_days, has_bonus: true },
  ]
}

function getSeniorMilestones(p: ModelParams): Milestone[] {
  return [
    { target_days: p.senior_target_v1_days, has_bonus: false },
    { target_days: p.senior_target_v2_days, has_bonus: false },
    { target_days: p.senior_target_v3_days, has_bonus: false },
    { target_days: p.senior_target_v4_days, has_bonus: false },
    { target_days: p.senior_target_v6_days, has_bonus: true },
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

  let cum_ar_emitted = 0
  let cum_ar_burned = 0
  let cum_ar_sold = 0
  let cum_mx_burned = 0
  let cum_usdc_redemptions = 0
  let cum_ar_buyback = 0

  let junior_cum = 0
  let senior_cum = 0

  // Track peak price for drawdown computation
  let peak_price = prev_price

  const burnRate = p.burn_schedule[p.withdraw_delay_days] ?? 0
  const jMilestones = getJuniorMilestones(p)
  const sMilestones = getSeniorMilestones(p)

  const vaultKeys = Object.keys(p.vault_rates).map(Number).sort((a, b) => a - b)
  const vaultLockDays = vaultKeys.length > 0 ? vaultKeys[Math.floor(vaultKeys.length / 2)] : 30
  const vaultRate = p.vault_rates[vaultLockDays] ?? 0

  const trigger = p.treasury_buyback_trigger

  for (let day = 1; day <= p.sim_days; day++) {
    const month_idx = Math.floor((day - 1) / 30) + 1

    // ---- Growth ----
    const monthlyNew = (base: number): number => {
      if (p.growth_mode === 1) return base
      return base * Math.pow(1 + p.growth_rate, month_idx - 1)
    }
    const junior_new = Math.round(monthlyNew(p.junior_monthly_new) / 30)
    const senior_new = Math.round(monthlyNew(p.senior_monthly_new) / 30)
    junior_cum += junior_new
    senior_cum += senior_new

    if (junior_new > 0) {
      juniorCohorts.push({ start_day: day, users: junior_new, invest_usdc: p.junior_invest_usdc, earned_usdc: 0, is_maxed: false })
    }
    if (senior_new > 0) {
      seniorCohorts.push({ start_day: day, users: senior_new, invest_usdc: p.senior_invest_usdc, earned_usdc: 0, is_maxed: false })
    }

    const current_price = lp_token_current > 0 ? lp_usdc_current / lp_token_current : p.price_token

    // ================================================================
    // STEP 1: Milestone payouts
    // ================================================================
    let junior_payout_raw = 0, junior_payout_capped = 0, junior_unlocked = 0, junior_active = 0, junior_maxed = 0
    for (const c of juniorCohorts) {
      if (c.is_maxed) { junior_maxed += c.users; continue }
      junior_active += c.users
      const age = day - c.start_day
      for (const m of jMilestones) {
        if (age !== m.target_days) continue
        junior_unlocked += c.users
        const stat = p.junior_package_usdc * p.junior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.junior_package_usdc : 0
        const total = stat + bonus
        const cap = c.invest_usdc * p.max_out_multiple
        const rem = Math.max(0, cap - c.earned_usdc)
        const actual = Math.min(total, rem)
        junior_payout_raw += total * c.users
        junior_payout_capped += actual * c.users
        c.earned_usdc += actual
        if (c.earned_usdc >= cap) c.is_maxed = true
      }
    }

    let senior_payout_raw = 0, senior_payout_capped = 0, senior_unlocked = 0, senior_active = 0, senior_maxed = 0
    for (const c of seniorCohorts) {
      if (c.is_maxed) { senior_maxed += c.users; continue }
      senior_active += c.users
      const age = day - c.start_day
      for (const m of sMilestones) {
        if (age !== m.target_days) continue
        senior_unlocked += c.users
        const stat = p.senior_package_usdc * p.senior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.senior_package_usdc : 0
        const total = stat + bonus
        const cap = c.invest_usdc * p.max_out_multiple
        const rem = Math.max(0, cap - c.earned_usdc)
        const actual = Math.min(total, rem)
        senior_payout_raw += total * c.users
        senior_payout_capped += actual * c.users
        c.earned_usdc += actual
        if (c.earned_usdc >= cap) c.is_maxed = true
      }
    }

    const node_payout_usdc_today = junior_payout_raw + senior_payout_raw
    const node_payout_usdc_capped = junior_payout_capped + senior_payout_capped
    const payout_ar_today = current_price > 0 ? node_payout_usdc_capped / current_price : 0
    cum_ar_emitted += payout_ar_today

    // ================================================================
    // STEP 2: Burn schedule + release queue
    // ================================================================
    const burn_rate = burnRate
    const instant_release_ratio = 1 - burn_rate
    const instant_release_ar = payout_ar_today * instant_release_ratio
    const linear_total_ar = payout_ar_today * burn_rate
    cum_ar_burned += linear_total_ar

    if (linear_total_ar > 0 && p.linear_release_days > 0) {
      releaseQueue.push({ remaining_ar: linear_total_ar, days_left: p.linear_release_days })
    }

    let linear_release_ar = 0
    for (let i = releaseQueue.length - 1; i >= 0; i--) {
      const item = releaseQueue[i]
      if (item.days_left <= 0) { releaseQueue.splice(i, 1); continue }
      const portion = item.remaining_ar / item.days_left
      linear_release_ar += portion
      item.remaining_ar -= portion
      item.days_left -= 1
      if (item.days_left <= 0) releaseQueue.splice(i, 1)
    }

    const released_ar_today = instant_release_ar + linear_release_ar

    // ================================================================
    // STEP 3: MX Burn Gate — BEFORE selling AR
    // ================================================================
    let mx_buy_usdc = 0
    let mx_burn_amount = 0

    if (p.mx_burn_per_withdraw_ratio > 0 && released_ar_today > 0) {
      let withdraw_value_usdc: number
      if (p.mx_burn_mode === "usdc_value") {
        withdraw_value_usdc = node_payout_usdc_capped
      } else {
        withdraw_value_usdc = payout_ar_today * current_price
      }
      mx_buy_usdc = withdraw_value_usdc * p.mx_burn_per_withdraw_ratio
      mx_burn_amount = p.mx_price_usdc > 0 ? mx_buy_usdc / p.mx_price_usdc : 0
      cum_mx_burned += mx_burn_amount
    }

    // ================================================================
    // STEP 4: Treasury redemption (兑付) — reduces AR hitting market
    // ================================================================
    let redemption_usdc = 0
    let ar_redeemed_equivalent = 0
    let released_ar_after_redemption = released_ar_today

    if (p.treasury_defense_enabled && p.treasury_redemption_ratio > 0 && node_payout_usdc_capped > 0) {
      let budget = p.treasury_redemption_ratio * node_payout_usdc_capped
      // Cannot exceed treasury - min buffer
      const available = prev_treasury_end - trigger.treasury_min_buffer
      if (available > 0) {
        budget = Math.min(budget, available)
      } else {
        budget = 0
      }
      redemption_usdc = budget
      ar_redeemed_equivalent = current_price > 0 ? redemption_usdc / current_price : 0
      released_ar_after_redemption = Math.max(0, released_ar_today - ar_redeemed_equivalent)
      cum_usdc_redemptions += redemption_usdc
    }

    // ================================================================
    // STEP 5: Sell pressure
    // ================================================================
    const sold_ar_today = released_ar_after_redemption * p.sell_pressure_ratio
    cum_ar_sold += sold_ar_today

    // ================================================================
    // STEP 6: AMM AR->USDC swap (sell)
    // ================================================================
    const lp_usdc_begin = lp_usdc_current
    const lp_token_begin = lp_token_current
    let usdc_out = 0
    let price_after_sell = current_price

    if (sold_ar_today > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
      const k = lp_usdc_current * lp_token_current
      const ar_eff = sold_ar_today * (1 - p.amm_fee_rate)
      const new_lp_token = lp_token_current + ar_eff
      const new_lp_usdc = k / new_lp_token
      usdc_out = lp_usdc_current - new_lp_usdc
      lp_usdc_current = new_lp_usdc
      lp_token_current = new_lp_token
      price_after_sell = lp_usdc_current / lp_token_current
    }

    // ================================================================
    // STEP 7: Treasury buyback (USDC->AR, supports price)
    // ================================================================
    let treasury_defense_active = false
    let buyback_budget_usdc = 0
    let ar_buyback_out = 0
    let price_after_buyback = price_after_sell

    // Compute treasury inflow first (needed for budget)
    const inflow_node = junior_new * p.junior_invest_usdc + senior_new * p.senior_invest_usdc
    const external_profit_daily = (p.external_profit_monthly / 30) * Math.pow(1 + p.external_profit_growth_rate, month_idx - 1)

    // Vault
    const vault_principal_estimate = (junior_cum * p.junior_invest_usdc + senior_cum * p.senior_invest_usdc) * 0.1
    const vault_profit_today = vault_principal_estimate * vaultRate
    const platform_vault_income_today = vault_profit_today * p.platform_fee_ratio

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
      const projected = prev_treasury_end + treasury_inflow_raw - redemption_usdc - (p.mx_burn_from === "treasury" ? mx_buy_usdc : 0)
      const max_spend = Math.max(0, projected - trigger.treasury_min_buffer)
      budget = Math.min(budget, max_spend)

      if (budget > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
        buyback_budget_usdc = budget
        const k = lp_usdc_current * lp_token_current
        const usdc_eff = buyback_budget_usdc * (1 - p.amm_fee_rate)
        const new_lp_usdc = lp_usdc_current + usdc_eff
        const new_lp_token = k / new_lp_usdc
        ar_buyback_out = lp_token_current - new_lp_token
        lp_usdc_current = new_lp_usdc
        lp_token_current = new_lp_token
        price_after_buyback = lp_usdc_current / lp_token_current
        cum_ar_buyback += ar_buyback_out
      }
    }

    const net_sell_ar = sold_ar_today - ar_buyback_out

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
      redemption_usdc +
      buyback_budget_usdc +
      (p.mx_burn_from === "treasury" ? mx_buy_usdc : 0) +
      (p.lp_owned_by_treasury ? usdc_out : 0) +
      insurance_payout_today
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
      node_payout_usdc_today, node_payout_usdc_capped, payout_ar_today,
      mx_buy_usdc, mx_burn_amount,
      redemption_usdc, ar_redeemed_equivalent,
      burn_rate, instant_release_ratio,
      instant_release_ar, linear_release_ar,
      released_ar_today, released_ar_after_redemption, sold_ar_today,
      lp_usdc_begin, lp_token_begin, usdc_out, price_after_sell,
      treasury_defense_active, buyback_budget_usdc, ar_buyback_out, price_after_buyback, net_sell_ar,
      lp_usdc_end: lp_usdc_current, lp_token_end: lp_token_current,
      amm_fee_rate: p.amm_fee_rate, price_end,
      treasury_begin, treasury_inflow, treasury_outflow, treasury_end,
      sold_over_lp, price_change,
      total_ar_emitted: cum_ar_emitted, total_ar_burned: cum_ar_burned, total_ar_sold: cum_ar_sold,
      total_mx_burned: cum_mx_burned, total_usdc_redemptions: cum_usdc_redemptions, total_ar_buyback: cum_ar_buyback,
      vault_profit_today, platform_vault_income_today, insurance_payout_today,
    })
  }

  return rows
}
