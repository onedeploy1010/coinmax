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
  // Treasury buyback: treasury spends USDC to buy AR from AMM
  treasury_buyback_usdc: number
  treasury_buyback_ar: number
  burn_rate: number
  instant_release_ratio: number
  instant_release_ar: number
  linear_release_ar: number
  released_ar_today: number
  sold_ar_today: number
  lp_usdc_begin: number
  lp_token_begin: number
  lp_usdc_end: number
  lp_token_end: number
  amm_fee_rate: number
  usdc_out: number
  price_end: number
  treasury_begin: number
  treasury_inflow: number
  treasury_outflow: number
  treasury_end: number
  sold_over_lp: number
  price_change: number
  total_ar_emitted: number
  total_ar_burned: number
  total_ar_sold: number
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

  let cumulative_ar_emitted = 0
  let cumulative_ar_burned = 0
  let cumulative_ar_sold = 0

  let junior_cum = 0
  let senior_cum = 0

  const burnRate = p.burn_schedule[p.withdraw_delay_days] ?? 0

  const jMilestones = getJuniorMilestones(p)
  const sMilestones = getSeniorMilestones(p)

  // Vault: use middle vault rate as representative daily model
  const vaultKeys = Object.keys(p.vault_rates).map(Number).sort((a, b) => a - b)
  const vaultLockDays = vaultKeys.length > 0 ? vaultKeys[Math.floor(vaultKeys.length / 2)] : 30
  const vaultRate = p.vault_rates[vaultLockDays] ?? 0

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

    // ---- Create cohorts ----
    if (junior_new > 0) {
      juniorCohorts.push({
        start_day: day,
        users: junior_new,
        invest_usdc: p.junior_invest_usdc,
        earned_usdc: 0,
        is_maxed: false,
      })
    }
    if (senior_new > 0) {
      seniorCohorts.push({
        start_day: day,
        users: senior_new,
        invest_usdc: p.senior_invest_usdc,
        earned_usdc: 0,
        is_maxed: false,
      })
    }

    // ---- Current price (before any swaps today) ----
    const current_price = lp_token_current > 0 ? lp_usdc_current / lp_token_current : p.price_token

    // ============================================================
    // STEP 1: Treasury buyback — spend USDC to buy AR from AMM
    // ============================================================
    // Compute how much USDC the payout requires, then treasury
    // uses usdc_payout_cover_ratio of that to buy AR from AMM.
    // The buyback is a USDC→AR swap (reverse direction), which
    // INCREASES the AR price (removes AR from pool, adds USDC).
    // ============================================================

    // ---- Process junior cohort milestones ----
    let junior_payout_usdc_raw = 0
    let junior_payout_usdc_capped = 0
    let junior_unlocked_users = 0
    let junior_active = 0
    let junior_maxed = 0

    for (const c of juniorCohorts) {
      if (c.is_maxed) { junior_maxed += c.users; continue }
      junior_active += c.users
      const age = day - c.start_day
      for (const m of jMilestones) {
        if (age !== m.target_days) continue
        junior_unlocked_users += c.users

        const static_reward = p.junior_package_usdc * p.junior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.junior_package_usdc : 0
        const total_potential = static_reward + bonus

        const cap_usdc = c.invest_usdc * p.max_out_multiple
        const remaining_cap = Math.max(0, cap_usdc - c.earned_usdc)
        const actual_per_user = Math.min(total_potential, remaining_cap)

        junior_payout_usdc_raw += total_potential * c.users
        junior_payout_usdc_capped += actual_per_user * c.users

        c.earned_usdc += actual_per_user
        if (c.earned_usdc >= cap_usdc) c.is_maxed = true
      }
    }

    // ---- Process senior cohort milestones ----
    let senior_payout_usdc_raw = 0
    let senior_payout_usdc_capped = 0
    let senior_unlocked_users = 0
    let senior_active = 0
    let senior_maxed = 0

    for (const c of seniorCohorts) {
      if (c.is_maxed) { senior_maxed += c.users; continue }
      senior_active += c.users
      const age = day - c.start_day
      for (const m of sMilestones) {
        if (age !== m.target_days) continue
        senior_unlocked_users += c.users

        const static_reward = p.senior_package_usdc * p.senior_daily_rate * m.target_days
        const bonus = m.has_bonus ? p.senior_package_usdc : 0
        const total_potential = static_reward + bonus

        const cap_usdc = c.invest_usdc * p.max_out_multiple
        const remaining_cap = Math.max(0, cap_usdc - c.earned_usdc)
        const actual_per_user = Math.min(total_potential, remaining_cap)

        senior_payout_usdc_raw += total_potential * c.users
        senior_payout_usdc_capped += actual_per_user * c.users

        c.earned_usdc += actual_per_user
        if (c.earned_usdc >= cap_usdc) c.is_maxed = true
      }
    }

    const node_payout_usdc_today = junior_payout_usdc_raw + senior_payout_usdc_raw
    const node_payout_usdc_capped = junior_payout_usdc_capped + senior_payout_usdc_capped

    // ---- Treasury buyback: USDC → AR swap (price-supportive) ----
    // Treasury spends usdc_payout_cover_ratio * capped_payout to buy AR
    // This AR is what gets distributed to users
    const buyback_usdc_budget = p.usdc_payout_cover_ratio * node_payout_usdc_capped
    let treasury_buyback_usdc = 0
    let treasury_buyback_ar = 0

    const lp_usdc_begin = lp_usdc_current
    const lp_token_begin = lp_token_current

    if (buyback_usdc_budget > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
      // CPMM swap: USDC → AR (treasury puts USDC in, takes AR out)
      const k = lp_usdc_current * lp_token_current
      const usdc_eff = buyback_usdc_budget * (1 - p.amm_fee_rate)
      const new_lp_usdc = lp_usdc_current + usdc_eff
      const new_lp_token = k / new_lp_usdc
      const ar_bought = lp_token_current - new_lp_token

      treasury_buyback_usdc = buyback_usdc_budget
      treasury_buyback_ar = ar_bought

      // Update pool — price goes UP after buyback
      lp_usdc_current = new_lp_usdc
      lp_token_current = new_lp_token
    }

    // ---- Convert remaining payout to AR at (post-buyback) price ----
    const price_after_buyback = lp_token_current > 0
      ? lp_usdc_current / lp_token_current
      : current_price

    // AR emitted = buyback AR + minted AR for uncovered portion
    const uncovered_payout_usdc = node_payout_usdc_capped - treasury_buyback_usdc
    const minted_ar = uncovered_payout_usdc > 0 && price_after_buyback > 0
      ? uncovered_payout_usdc / price_after_buyback
      : 0
    const payout_ar_today = treasury_buyback_ar + minted_ar
    cumulative_ar_emitted += payout_ar_today

    // ---- Burn + Release ----
    const burn_rate = burnRate
    const instant_release_ratio = 1 - burn_rate
    const instant_release_ar = payout_ar_today * instant_release_ratio
    const linear_total_ar = payout_ar_today * burn_rate
    cumulative_ar_burned += linear_total_ar

    if (linear_total_ar > 0 && p.linear_release_days > 0) {
      releaseQueue.push({
        remaining_ar: linear_total_ar,
        days_left: p.linear_release_days,
      })
    }

    // ---- Process linear release queue ----
    let linear_release_ar = 0
    for (let i = releaseQueue.length - 1; i >= 0; i--) {
      const item = releaseQueue[i]
      if (item.days_left <= 0) {
        releaseQueue.splice(i, 1)
        continue
      }
      const daily_portion = item.remaining_ar / item.days_left
      linear_release_ar += daily_portion
      item.remaining_ar -= daily_portion
      item.days_left -= 1
      if (item.days_left <= 0) {
        releaseQueue.splice(i, 1)
      }
    }

    const released_ar_today = instant_release_ar + linear_release_ar

    // ---- Sell pressure: users sell released AR ----
    const sold_ar_today = released_ar_today * p.sell_pressure_ratio
    cumulative_ar_sold += sold_ar_today

    // ---- AMM CPMM: AR → USDC sell (price-depressive) ----
    let usdc_out = 0
    let price_end = price_after_buyback

    if (sold_ar_today > 0 && lp_usdc_current > 0 && lp_token_current > 0) {
      const k = lp_usdc_current * lp_token_current
      const ar_eff = sold_ar_today * (1 - p.amm_fee_rate)
      const new_lp_token = lp_token_current + ar_eff
      const new_lp_usdc = k / new_lp_token
      usdc_out = lp_usdc_current - new_lp_usdc
      lp_usdc_current = new_lp_usdc
      lp_token_current = new_lp_token
      price_end = lp_usdc_current / lp_token_current
    }

    // ---- Vault module ----
    const vault_principal_estimate = (junior_cum * p.junior_invest_usdc + senior_cum * p.senior_invest_usdc) * 0.1
    const vault_profit_today = vault_principal_estimate * vaultRate
    const platform_vault_income_today = vault_profit_today * p.platform_fee_ratio

    // ---- Insurance module ----
    let insurance_payout_today = 0
    if (p.insurance_enabled) {
      const price_loss = 1 - (price_end / p.price_token)
      if (price_loss > 0) {
        const avg_invest = (p.junior_invest_usdc + p.senior_invest_usdc) / 2
        const multiplier = price_loss < 0.1
          ? p.insurance_payout_low_loss_multiple
          : p.insurance_payout_high_loss_multiple
        insurance_payout_today = avg_invest * multiplier * (junior_new + senior_new) * 0.01
      }
    }

    // ---- Treasury ----
    const treasury_begin = prev_treasury_end
    const inflow_node = junior_new * p.junior_invest_usdc + senior_new * p.senior_invest_usdc
    const external_profit_daily =
      (p.external_profit_monthly / 30) *
      Math.pow(1 + p.external_profit_growth_rate, month_idx - 1)
    const treasury_inflow = inflow_node + external_profit_daily + platform_vault_income_today
    // Treasury outflow: buyback USDC + LP ownership cost + insurance
    const treasury_outflow =
      treasury_buyback_usdc +
      (p.lp_owned_by_treasury ? usdc_out : 0) +
      insurance_payout_today
    const treasury_end = treasury_begin + treasury_inflow - treasury_outflow
    prev_treasury_end = treasury_end

    // ---- Derived ----
    const sold_over_lp = lp_usdc_begin === 0 ? 0 : usdc_out / lp_usdc_begin
    const price_change = prev_price === 0 ? 0 : price_end / prev_price - 1
    prev_price = price_end

    rows.push({
      day,
      month_idx,
      junior_new,
      senior_new,
      junior_cum,
      senior_cum,
      junior_unlocked_users,
      senior_unlocked_users,
      junior_active_cohorts: junior_active,
      senior_active_cohorts: senior_active,
      junior_maxed_cohorts: junior_maxed,
      senior_maxed_cohorts: senior_maxed,
      junior_daily_income_usdc: p.junior_package_usdc * p.junior_daily_rate,
      senior_daily_income_usdc: p.senior_package_usdc * p.senior_daily_rate,
      node_payout_usdc_today,
      node_payout_usdc_capped,
      payout_ar_today,
      treasury_buyback_usdc,
      treasury_buyback_ar,
      burn_rate,
      instant_release_ratio,
      instant_release_ar,
      linear_release_ar,
      released_ar_today,
      sold_ar_today,
      lp_usdc_begin,
      lp_token_begin,
      lp_usdc_end: lp_usdc_current,
      lp_token_end: lp_token_current,
      amm_fee_rate: p.amm_fee_rate,
      usdc_out,
      price_end,
      treasury_begin,
      treasury_inflow,
      treasury_outflow,
      treasury_end,
      sold_over_lp,
      price_change,
      total_ar_emitted: cumulative_ar_emitted,
      total_ar_burned: cumulative_ar_burned,
      total_ar_sold: cumulative_ar_sold,
      vault_profit_today,
      platform_vault_income_today,
      insurance_payout_today,
    })
  }

  return rows
}
