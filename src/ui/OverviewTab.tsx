import React from "react"
import type { DailyRow } from "../engine/simulate"

interface Props {
  rows: DailyRow[]
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function pct(n: number): string {
  return (n * 100).toFixed(4) + "%"
}

export const OverviewTab: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) {
    return <div className="overview-empty">请先运行模拟</div>
  }

  const last = rows[rows.length - 1]
  const minTreasury = Math.min(...rows.map((r) => r.treasury_end))
  const maxSoldOverLp = Math.max(...rows.map((r) => r.sold_over_lp))
  const totalPayouts = rows.reduce((s, r) => s + r.node_payout_usdc_today, 0)
  const totalSoldAr = rows.reduce((s, r) => s + r.sold_ar_today, 0)
  const totalUsdcOut = rows.reduce((s, r) => s + r.usdc_out, 0)
  const priceDrawdown = Math.min(...rows.map((r) => r.price_end))

  const cards: { label: string; value: string; color?: string }[] = [
    { label: "最终代币价格", value: "$" + fmt(last.price_end, 6), color: last.price_end < 0.5 ? "#ef4444" : "#22c55e" },
    { label: "价格最低点", value: "$" + fmt(priceDrawdown, 6), color: priceDrawdown < 0.5 ? "#ef4444" : "#f59e0b" },
    { label: "最终 LP USDC", value: "$" + fmt(last.lp_usdc_end) },
    { label: "最终 LP Token", value: fmt(last.lp_token_end) },
    { label: "国库最低值", value: "$" + fmt(minTreasury), color: minTreasury < 0 ? "#ef4444" : "#22c55e" },
    { label: "最终国库", value: "$" + fmt(last.treasury_end) },
    { label: "最大卖压/LP比", value: pct(maxSoldOverLp), color: maxSoldOverLp > 0.05 ? "#ef4444" : "#22c55e" },
    { label: "总节点支付", value: "$" + fmt(totalPayouts) },
    { label: "总售出 AR", value: fmt(totalSoldAr) },
    { label: "总 USDC 流出", value: "$" + fmt(totalUsdcOut) },
    { label: "最终初级用户数", value: fmt(last.junior_cum, 0) },
    { label: "最终高级用户数", value: fmt(last.senior_cum, 0) },
  ]

  return (
    <div className="overview-grid">
      {cards.map((c) => (
        <div className="kpi-card" key={c.label}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value" style={c.color ? { color: c.color } : undefined}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  )
}
