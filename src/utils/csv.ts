import type { DailyRow } from "../engine/simulate"
import type { StressSummary, StageCheckpoint, OptRunResult } from "../config/types"

const HEADERS: (keyof DailyRow)[] = [
  "day", "month_idx",
  "junior_new", "senior_new", "junior_cum", "senior_cum",
  "junior_unlocked_users", "senior_unlocked_users",
  "junior_active_cohorts", "senior_active_cohorts",
  "junior_maxed_cohorts", "senior_maxed_cohorts",
  "node_payout_usdc_today", "node_payout_usdc_capped", "payout_mx_today",
  "mx_buy_usdc", "mx_burn_amount",
  "redemption_mx",
  "burn_rate", "instant_release_ratio",
  "instant_release_mx", "linear_release_mx",
  "released_mx_today", "released_mx_after_redemption", "sold_mx_today",
  "usdc_out", "price_after_sell",
  "treasury_defense_active", "buyback_budget_usdc", "mx_buyback_out",
  "price_after_buyback", "net_sell_mx",
  "lp_usdc_begin", "lp_token_begin", "lp_usdc_end", "lp_token_end",
  "price_end",
  "treasury_begin", "treasury_inflow", "treasury_outflow", "treasury_end",
  "sold_over_lp", "price_change",
  "total_mx_emitted", "total_mx_deferred", "total_mx_sold",
  "total_mx_burned", "total_mx_redemptions", "total_mx_buyback",
  "vault_open", "vault_stakers", "vault_total_staked_usdc", "vault_avg_lock_days", "vault_stake_ratio",
  "vault_profit_today", "platform_vault_income_today", "insurance_payout_today",
  "vault_reserve_usdc", "vault_new_stake_today_usdc",
  "referral_payout_today", "total_referral_payout",
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
    "max_sold_over_lp", "total_payout_usdc", "total_mx_emitted",
    "total_mx_buyback", "total_mx_burned", "total_mx_redemptions", "net_sell_pressure",
    "vault_stakers", "vault_total_staked_usdc", "vault_platform_income",
    "total_referral_payout",
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

// Stage report: field key → Chinese header
const STAGE_COLUMNS: { key: keyof StageCheckpoint; label: string }[] = [
  // 基础信息
  { key: "day", label: "天数" },
  { key: "junior_cum", label: "初级节点(累计)" },
  { key: "senior_cum", label: "高级节点(累计)" },
  { key: "price", label: "代币价格" },
  { key: "lp_usdc", label: "LP USDC" },
  { key: "treasury", label: "国库余额" },

  // 节点招募 KPI
  { key: "junior_target", label: "初级目标" },
  { key: "junior_completion", label: "初级完成率" },
  { key: "senior_target", label: "高级目标" },
  { key: "senior_completion", label: "高级完成率" },
  { key: "total_node_target", label: "总节点目标" },
  { key: "total_node_completion", label: "总节点完成率" },
  { key: "node_growth_velocity", label: "日均招募速度" },
  { key: "growth_kpi", label: "增长KPI" },

  // 质押业绩 KPI
  { key: "vault_open", label: "金库状态" },
  { key: "vault_stakers", label: "质押用户(实际)" },
  { key: "vault_staker_target", label: "质押用户(目标)" },
  { key: "vault_staker_completion", label: "质押用户完成率" },
  { key: "vault_total_staked_usdc", label: "质押金额(实际)" },
  { key: "vault_staked_target", label: "质押金额(目标)" },
  { key: "vault_staked_completion", label: "质押金额完成率" },
  { key: "vault_reserve_usdc", label: "可调用储备金" },
  { key: "vault_platform_income", label: "平台收入" },
  { key: "vault_kpi", label: "金库KPI" },

  // 市场成本
  { key: "total_principal_inflow", label: "累计本金流入" },
  { key: "total_referral_payout", label: "累计推荐奖金" },
  { key: "referral_cost_ratio", label: "推荐成本占比" },
  { key: "avg_invest_per_node", label: "人均投资额" },
  { key: "total_payout_usdc", label: "累计支付USDC" },
  { key: "payout_ratio", label: "支付率" },

  // 压力指标
  { key: "pressure_score", label: "压力指数" },
  { key: "pressure_label", label: "压力等级" },
  { key: "max_drawdown", label: "最大回撤" },
  { key: "max_sold_over_lp", label: "最大卖压/LP" },
  { key: "min_treasury", label: "国库最低" },
  { key: "min_lp_usdc", label: "LP最低" },
  { key: "sustainability_label", label: "可持续性" },
  { key: "liquidity_label", label: "流动性" },

  // MX 数据
  { key: "total_mx_emitted", label: "MX累计发行" },
  { key: "total_mx_buyback", label: "MX累计回购" },
  { key: "total_mx_burned", label: "MX累计销毁" },
  { key: "total_mx_redemptions", label: "MX累计兑付" },
  { key: "net_sell_pressure", label: "净卖压" },

  // 建议
  { key: "recommendation", label: "建议" },
]

export function exportStageCSV(stages: StageCheckpoint[]): void {
  if (stages.length === 0) return
  const header = STAGE_COLUMNS.map((c) => c.label).join(",")
  const lines: string[] = [header]
  for (const s of stages) {
    const vals = STAGE_COLUMNS.map((c) => {
      const v = s[c.key]
      if (typeof v === "boolean") return v ? "是" : "否"
      if (typeof v === "number") return v.toFixed(6)
      return `"${String(v).replace(/"/g, '""')}"`
    })
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_market_kpi_report_${Date.now()}.csv`)
}

export function exportOptimizerCSV(result: OptRunResult): void {
  if (result.results.length === 0) return
  const paramKeys = Object.keys(result.results[0].overrides)
  const metricKeys = ["final_price", "max_drawdown", "max_sold_over_lp", "min_treasury", "min_lp_usdc", "final_treasury", "net_sell_pressure", "vault_stakers", "vault_total_staked_usdc", "vault_platform_income", "total_referral_payout", "score", "fail_reason"]
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
      r.summary.total_referral_payout.toFixed(2),
      r.score.toFixed(2),
      r.summary.fail_reason ?? "PASS",
    ]
    lines.push(vals.join(","))
  }
  downloadCSV(lines.join("\n"), `coinmax_optimizer_${Date.now()}.csv`)
}
