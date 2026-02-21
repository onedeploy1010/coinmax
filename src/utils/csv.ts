import type { DailyRow } from "../engine/simulate"
import type { StressSummary } from "../config/types"

const HEADERS: (keyof DailyRow)[] = [
  "day", "month_idx",
  "junior_new", "senior_new",
  "junior_cum", "senior_cum",
  "junior_unlocked_users", "senior_unlocked_users",
  "junior_active_cohorts", "senior_active_cohorts",
  "junior_maxed_cohorts", "senior_maxed_cohorts",
  "junior_daily_income_usdc", "senior_daily_income_usdc",
  "node_payout_usdc_today", "node_payout_usdc_capped", "payout_ar_today",
  "treasury_buyback_usdc", "treasury_buyback_ar",
  "burn_rate", "instant_release_ratio",
  "instant_release_ar", "linear_release_ar", "released_ar_today", "sold_ar_today",
  "lp_usdc_begin", "lp_token_begin", "lp_usdc_end", "lp_token_end",
  "amm_fee_rate", "usdc_out", "price_end",
  "treasury_begin", "treasury_inflow", "treasury_outflow", "treasury_end",
  "sold_over_lp", "price_change",
  "total_ar_emitted", "total_ar_burned", "total_ar_sold",
  "vault_profit_today", "platform_vault_income_today", "insurance_payout_today",
]

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCSV(rows: DailyRow[]): void {
  const lines: string[] = [HEADERS.join(",")]
  for (const row of rows) {
    const vals = HEADERS.map((h) => {
      const v = row[h]
      return typeof v === "number" ? v.toFixed(6) : String(v)
    })
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_sim_${Date.now()}.csv`)
}

export function exportStressCSV(results: StressSummary[]): void {
  if (results.length === 0) return
  const paramKeys = Object.keys(results[0].params)
  const metricKeys: (keyof StressSummary)[] = [
    "final_price", "min_price", "max_drawdown",
    "final_lp_usdc", "min_lp_usdc",
    "min_treasury", "final_treasury",
    "max_sold_over_lp", "total_payout_usdc", "total_ar_emitted",
    "fail_reason",
  ]
  const header = [...paramKeys, ...metricKeys].join(",")
  const lines = [header]
  for (const r of results) {
    const vals = [
      ...paramKeys.map((k) => String(r.params[k] ?? "")),
      ...metricKeys.map((k) => {
        const v = r[k]
        return typeof v === "number" ? v.toFixed(6) : String(v ?? "PASS")
      }),
    ]
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_stress_${Date.now()}.csv`)
}
