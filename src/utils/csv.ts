import type { DailyRow } from "../engine/simulate"

const HEADERS: (keyof DailyRow)[] = [
  "day", "month_idx",
  "junior_new", "senior_new",
  "junior_cum", "senior_cum",
  "junior_unlocked_users", "senior_unlocked_users",
  "junior_daily_income_usdc", "senior_daily_income_usdc",
  "node_payout_usdc_today", "payout_ar_today",
  "burn_rate", "instant_release_ratio",
  "instant_release_ar", "linear_release_ar", "released_ar_today", "sold_ar_today",
  "lp_usdc_begin", "lp_token_begin", "lp_usdc_end", "lp_token_end",
  "amm_fee_rate", "usdc_out", "price_end",
  "treasury_begin", "treasury_inflow", "treasury_outflow", "treasury_end",
  "sold_over_lp", "price_change",
]

export function exportCSV(rows: DailyRow[]): void {
  const lines: string[] = [HEADERS.join(",")]
  for (const row of rows) {
    const vals = HEADERS.map((h) => {
      const v = row[h]
      return typeof v === "number" ? v.toFixed(6) : String(v)
    })
    lines.push(vals.join(","))
  }
  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `coinmax_sim_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
