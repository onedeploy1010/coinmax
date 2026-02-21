import type { ModelParams } from "../config/types"

export interface DailyRow {
  day: number
  month_idx: number
  junior_new: number
  senior_new: number
  junior_cum: number
  senior_cum: number
  junior_unlocked_users: number
  senior_unlocked_users: number
  junior_daily_income_usdc: number
  senior_daily_income_usdc: number
  node_payout_usdc_today: number
  payout_ar_today: number
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
}

export function simulate(p: ModelParams): DailyRow[] {
  const rows: DailyRow[] = []

  // Arrays to store cumulative counts per day (index 0 = day 0 baseline)
  const juniorCumArr: number[] = [0]
  const seniorCumArr: number[] = [0]

  // Linear release buffer: queue of (amount, remaining_days)
  const linearReleaseQueue: { amount: number; remaining: number }[] = []

  let lp_usdc_current = p.lp_usdc
  let lp_token_current = p.lp_token
  let prev_treasury_end = p.treasury_start_usdc
  let prev_price = lp_usdc_current / lp_token_current

  // Burn rate lookup
  const burnRate = p.burn_schedule[p.withdraw_delay_days] ?? 0

  for (let day = 1; day <= p.sim_days; day++) {
    const month_idx = Math.floor((day - 1) / 30) + 1

    // Monthly new nodes
    const monthlyNew = (base: number): number => {
      if (p.growth_mode === 1) return base
      return base * Math.pow(1 + p.growth_rate, month_idx - 1)
    }

    const junior_new = Math.round(monthlyNew(p.junior_monthly_new) / 30)
    const senior_new = Math.round(monthlyNew(p.senior_monthly_new) / 30)

    const junior_cum = juniorCumArr[day - 1] + junior_new
    const senior_cum = seniorCumArr[day - 1] + senior_new
    juniorCumArr.push(junior_cum)
    seniorCumArr.push(senior_cum)

    // Unlock users (cohort subtraction)
    const junior_unlocked_users =
      day > p.junior_target_v2_days
        ? juniorCumArr[day] - juniorCumArr[day - p.junior_target_v2_days]
        : 0

    const senior_unlocked_users =
      day > p.senior_target_v1_days
        ? seniorCumArr[day] - seniorCumArr[day - p.senior_target_v1_days]
        : 0

    // Node daily income
    const junior_daily_income_usdc = p.junior_package_usdc * p.junior_daily_rate
    const senior_daily_income_usdc = p.senior_package_usdc * p.senior_daily_rate

    // Node payout
    const node_payout_usdc_today =
      junior_unlocked_users * junior_daily_income_usdc +
      senior_unlocked_users * senior_daily_income_usdc

    // Convert to AR using current price
    const current_price = lp_token_current > 0 ? lp_usdc_current / lp_token_current : p.price_token
    const payout_ar_today = current_price > 0 ? node_payout_usdc_today / current_price : 0

    // Burn schedule
    const burn_rate = burnRate
    const instant_release_ratio = 1 - burn_rate

    // Release calculation
    const instant_release_ar = payout_ar_today * instant_release_ratio

    // Add today's linear portion to the queue
    const linear_total = payout_ar_today * burn_rate
    if (linear_total > 0 && p.linear_release_days > 0) {
      linearReleaseQueue.push({
        amount: linear_total / p.linear_release_days,
        remaining: p.linear_release_days,
      })
    }

    // Sum up all active linear releases
    let linear_release_ar = 0
    for (const entry of linearReleaseQueue) {
      if (entry.remaining > 0) {
        linear_release_ar += entry.amount
        entry.remaining--
      }
    }
    // Clean up expired entries periodically
    if (day % 30 === 0) {
      for (let i = linearReleaseQueue.length - 1; i >= 0; i--) {
        if (linearReleaseQueue[i].remaining <= 0) {
          linearReleaseQueue.splice(i, 1)
        }
      }
    }

    const released_ar_today = instant_release_ar + linear_release_ar

    // Sell pressure
    const sold_ar_today = released_ar_today * p.sell_pressure_ratio

    // AMM CPMM swap AR -> USDC
    const lp_usdc_begin = lp_usdc_current
    const lp_token_begin = lp_token_current

    let usdc_out = 0
    let price_end = current_price

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

    const lp_usdc_end = lp_usdc_current
    const lp_token_end = lp_token_current

    // Treasury
    const treasury_begin = prev_treasury_end
    const inflow_node = junior_new * p.junior_invest_usdc + senior_new * p.senior_invest_usdc
    const external_profit_daily =
      (p.external_profit_monthly / 30) *
      Math.pow(1 + p.external_profit_growth_rate, month_idx - 1)
    const treasury_inflow = inflow_node + external_profit_daily
    const treasury_outflow =
      p.usdc_payout_cover_ratio * node_payout_usdc_today +
      (p.lp_owned_by_treasury ? usdc_out : 0)
    const treasury_end = treasury_begin + treasury_inflow - treasury_outflow
    prev_treasury_end = treasury_end

    // Derived
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
      junior_daily_income_usdc,
      senior_daily_income_usdc,
      node_payout_usdc_today,
      payout_ar_today,
      burn_rate,
      instant_release_ratio,
      instant_release_ar,
      linear_release_ar,
      released_ar_today,
      sold_ar_today,
      lp_usdc_begin,
      lp_token_begin,
      lp_usdc_end,
      lp_token_end,
      amm_fee_rate: p.amm_fee_rate,
      usdc_out,
      price_end,
      treasury_begin,
      treasury_inflow,
      treasury_outflow,
      treasury_end,
      sold_over_lp,
      price_change,
    })
  }

  return rows
}
