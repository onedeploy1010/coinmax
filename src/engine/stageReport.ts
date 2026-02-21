import type { DailyRow } from "./simulate"

export const STAGE_DAYS = [15, 30, 60, 120, 150, 180, 210, 360]

export interface StageKPI {
  day: number
  price: number
  drawdown: number
  treasury: number
  min_treasury: number
  lp_usdc: number
  min_lp_usdc: number
  max_sold_over_lp: number
  total_payout_usdc: number
  total_buyback_usdc: number
  total_ar_buyback: number
  total_usdc_redemptions: number
  total_mx_burned: number
  net_sell_pressure: number
  junior_cum: number
  senior_cum: number
  recommendation: string
}

export function computeStageReport(rows: DailyRow[]): StageKPI[] {
  if (rows.length === 0) return []

  const result: StageKPI[] = []
  const initial_price = rows.length > 0 ? rows[0].price_end : 1

  for (const sd of STAGE_DAYS) {
    const idx = sd - 1
    if (idx >= rows.length) continue
    const r = rows[idx]
    const slice = rows.slice(0, idx + 1)

    let peak = 0, min_treasury = Infinity, min_lp = Infinity, max_sol = 0, total_payout = 0, total_bb_usdc = 0
    for (const s of slice) {
      if (s.price_end > peak) peak = s.price_end
      if (s.treasury_end < min_treasury) min_treasury = s.treasury_end
      if (s.lp_usdc_end < min_lp) min_lp = s.lp_usdc_end
      if (s.sold_over_lp > max_sol) max_sol = s.sold_over_lp
      total_payout += s.node_payout_usdc_capped
      total_bb_usdc += s.buyback_budget_usdc
    }
    const drawdown = peak > 0 ? (peak - r.price_end) / peak : 0

    // Generate recommendation
    const recs: string[] = []
    if (drawdown > 0.2) {
      recs.push("价格保护已激活：建议提高 treasury_buyback_ratio 至 0.20 以增强回购力度")
    }
    if (max_sol > 0.1) {
      recs.push("卖压偏高：建议临时提高兑付比例(redemption_ratio)以降低市场抛压")
    }
    if (r.total_mx_burned < total_payout * 0.05 && sd >= 60) {
      recs.push("MX 销毁量偏低：建议提高 mx_burn_per_withdraw_ratio 以抑制高频提现")
    }
    if (min_treasury < 30000 && sd >= 30) {
      recs.push("国库余量告急：建议降低 buyback_ratio 或增加外部收入注入")
    }
    if (r.total_ar_buyback > 0 && drawdown < 0.1) {
      recs.push("价格保护运行良好：国库回购已吸收 " + r.total_ar_buyback.toFixed(0) + " AR")
    }
    if (recs.length === 0) {
      const price_change_pct = ((r.price_end / initial_price - 1) * 100).toFixed(1)
      recs.push(
        `系统运行平稳。兑付覆盖 $${r.total_usdc_redemptions.toFixed(0)} USDC；` +
        `MX 销毁 ${r.total_mx_burned.toFixed(0)} 枚；价格变动 ${price_change_pct}%`
      )
    }

    result.push({
      day: sd,
      price: r.price_end,
      drawdown,
      treasury: r.treasury_end,
      min_treasury,
      lp_usdc: r.lp_usdc_end,
      min_lp_usdc: min_lp,
      max_sold_over_lp: max_sol,
      total_payout_usdc: total_payout,
      total_buyback_usdc: total_bb_usdc,
      total_ar_buyback: r.total_ar_buyback,
      total_usdc_redemptions: r.total_usdc_redemptions,
      total_mx_burned: r.total_mx_burned,
      net_sell_pressure: r.total_ar_sold - r.total_ar_buyback,
      junior_cum: r.junior_cum,
      senior_cum: r.senior_cum,
      recommendation: recs.join("；"),
    })
  }

  return result
}
