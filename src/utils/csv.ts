import type { DailyRow } from "../engine/simulate"
import type { StressSummary, StageCheckpoint, OptRunResult } from "../config/types"

const HEADERS: (keyof DailyRow)[] = [
  "day", "month_idx",
  "junior_new", "senior_new", "junior_cum", "senior_cum",
  "junior_unlocked_users", "senior_unlocked_users",
  "junior_active_cohorts", "senior_active_cohorts",
  "junior_maxed_cohorts", "senior_maxed_cohorts",
  "node_payout_usdc_today", "node_payout_usdc_capped", "payout_ar_today",
  "mx_buy_usdc", "mx_burn_amount",
  "redemption_usdc", "ar_redeemed_equivalent",
  "burn_rate", "instant_release_ratio",
  "instant_release_ar", "linear_release_ar",
  "released_ar_today", "released_ar_after_redemption", "sold_ar_today",
  "usdc_out", "price_after_sell",
  "treasury_defense_active", "buyback_budget_usdc", "ar_buyback_out",
  "price_after_buyback", "net_sell_ar",
  "lp_usdc_begin", "lp_token_begin", "lp_usdc_end", "lp_token_end",
  "price_end",
  "treasury_begin", "treasury_inflow", "treasury_outflow", "treasury_end",
  "sold_over_lp", "price_change",
  "total_ar_emitted", "total_ar_burned", "total_ar_sold",
  "total_mx_burned", "total_usdc_redemptions", "total_ar_buyback",
  "vault_open", "vault_stakers", "vault_total_staked_usdc", "vault_avg_lock_days", "vault_stake_ratio",
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
      if (typeof v === "boolean") return v ? "1" : "0"
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
    "final_lp_usdc", "min_lp_usdc", "min_treasury", "final_treasury",
    "max_sold_over_lp", "total_payout_usdc", "total_ar_emitted",
    "total_ar_buyback", "total_mx_burned", "total_usdc_redemptions", "net_sell_pressure",
    "vault_stakers", "vault_total_staked_usdc", "vault_platform_income",
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

const STAGE_HEADERS: (keyof StageCheckpoint)[] = [
  "day", "junior_cum", "senior_cum", "price", "lp_usdc", "treasury",
  "min_treasury", "min_lp_usdc", "max_drawdown", "max_sold_over_lp",
  "total_payout_usdc", "total_principal_inflow", "total_ar_emitted",
  "total_ar_buyback", "total_usdc_redemptions", "total_mx_burned",
  "net_sell_pressure", "pressure_score", "pressure_label",
  "growth_kpi", "sustainability_label", "liquidity_label",
  "payout_ratio",
  "vault_open", "vault_stakers", "vault_total_staked_usdc", "vault_platform_income", "vault_kpi",
  "recommendation",
]

export function exportStageCSV(stages: StageCheckpoint[]): void {
  if (stages.length === 0) return
  const lines: string[] = [STAGE_HEADERS.join(",")]
  for (const s of stages) {
    const vals = STAGE_HEADERS.map((h) => {
      const v = s[h]
      if (typeof v === "number") return v.toFixed(6)
      return `"${String(v).replace(/"/g, '""')}"`
    })
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_stage_report_${Date.now()}.csv`)
}

export function exportOptimizerCSV(result: OptRunResult): void {
  if (result.results.length === 0) return
  const paramKeys = Object.keys(result.results[0].overrides)
  const metricKeys = ["final_price", "max_drawdown", "max_sold_over_lp", "min_treasury", "min_lp_usdc", "final_treasury", "net_sell_pressure", "vault_stakers", "vault_total_staked_usdc", "vault_platform_income", "score", "fail_reason"]
  const header = ["rank", ...paramKeys, ...metricKeys].join(",")
  const lines = [header]
  for (const r of result.results) {
    const vals = [
      String(r.rank),
      ...paramKeys.map((k) => String(r.overrides[k] ?? "")),
      r.summary.final_price.toFixed(6),
      r.summary.max_drawdown.toFixed(6),
      r.summary.max_sold_over_lp.toFixed(6),
      r.summary.min_treasury.toFixed(2),
      r.summary.min_lp_usdc.toFixed(2),
      r.summary.final_treasury.toFixed(2),
      r.summary.net_sell_pressure.toFixed(2),
      r.summary.vault_stakers.toFixed(0),
      r.summary.vault_total_staked_usdc.toFixed(2),
      r.summary.vault_platform_income.toFixed(2),
      r.score.toFixed(2),
      r.summary.fail_reason ?? "PASS",
    ]
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_optimizer_${Date.now()}.csv`)
}
