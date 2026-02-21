import React from "react"
import type { DailyRow } from "../engine/simulate"

interface Props { rows: DailyRow[] }

function fmt(n: number, d = 2): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string { return (n * 100).toFixed(4) + "%" }

export const OverviewTab: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  const last = rows[rows.length - 1]
  const minTreasury = Math.min(...rows.map((r) => r.treasury_end))
  const maxSol = Math.max(...rows.map((r) => r.sold_over_lp))
  const totCapped = rows.reduce((s, r) => s + r.node_payout_usdc_capped, 0)
  const totRaw = rows.reduce((s, r) => s + r.node_payout_usdc_today, 0)
  const priceMin = Math.min(...rows.map((r) => r.price_end))
  const priceMax = Math.max(...rows.map((r) => r.price_end))
  const maxDD = priceMax > 0 ? (priceMax - priceMin) / priceMax : 0
  const minLp = Math.min(...rows.map((r) => r.lp_usdc_end))
  const defDays = rows.filter((r) => r.treasury_defense_active).length

  const cards: { label: string; value: string; color?: string }[] = [
    { label: "最终代币价格", value: "$" + fmt(last.price_end, 6), color: last.price_end < 0.5 ? "#ef4444" : "#22c55e" },
    { label: "价格最低点", value: "$" + fmt(priceMin, 6), color: priceMin < 0.5 ? "#ef4444" : "#f59e0b" },
    { label: "最大回撤", value: pct(maxDD), color: maxDD > 0.3 ? "#ef4444" : "#22c55e" },
    { label: "最终 LP USDC", value: "$" + fmt(last.lp_usdc_end) },
    { label: "最低 LP USDC", value: "$" + fmt(minLp), color: minLp < 10000 ? "#ef4444" : "#22c55e" },
    { label: "国库最低值", value: "$" + fmt(minTreasury), color: minTreasury < 0 ? "#ef4444" : "#22c55e" },
    { label: "最终国库", value: "$" + fmt(last.treasury_end) },
    { label: "最大卖压/LP", value: pct(maxSol), color: maxSol > 0.05 ? "#ef4444" : "#22c55e" },
    // Defense section
    { label: "总回购 USDC", value: "$" + fmt(rows.reduce((s, r) => s + r.buyback_budget_usdc, 0)), color: "#06b6d4" },
    { label: "总回购 AR", value: fmt(last.total_ar_buyback), color: "#06b6d4" },
    { label: "总 USDC 兑付", value: "$" + fmt(last.total_usdc_redemptions), color: "#8b5cf6" },
    { label: "总 MX 销毁", value: fmt(last.total_mx_burned), color: "#f97316" },
    { label: "净卖压 AR", value: fmt(last.total_ar_sold - last.total_ar_buyback), color: last.total_ar_sold > last.total_ar_buyback ? "#ef4444" : "#22c55e" },
    { label: "防御激活天数", value: String(defDays), color: defDays > 0 ? "#f59e0b" : "#22c55e" },
    // Basics
    { label: "总支付(受限)", value: "$" + fmt(totCapped) },
    { label: "总支付(原始)", value: "$" + fmt(totRaw) },
    { label: "总 AR 发行", value: fmt(last.total_ar_emitted) },
    { label: "总 AR 销毁(池)", value: fmt(last.total_ar_burned) },
    { label: "初级用户", value: fmt(last.junior_cum, 0) },
    { label: "高级用户", value: fmt(last.senior_cum, 0) },
    { label: "初级封顶", value: fmt(last.junior_maxed_cohorts, 0) },
    { label: "高级封顶", value: fmt(last.senior_maxed_cohorts, 0) },
    { label: "平台Vault收入", value: "$" + fmt(rows.reduce((s, r) => s + r.platform_vault_income_today, 0)) },
  ]

  return (
    <div className="overview-grid">
      {cards.map((c) => (
        <div className="kpi-card" key={c.label}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value" style={c.color ? { color: c.color } : undefined}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}
