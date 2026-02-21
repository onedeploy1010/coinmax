import React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts"
import type { DailyRow } from "../engine/simulate"

interface Props { rows: DailyRow[] }
interface ChartDef { title: string; type?: "line" | "area"; dataKeys: { key: keyof DailyRow; color: string; name: string }[] }

const CHARTS: ChartDef[] = [
  { title: "代币价格 (卖后/买后/最终)", dataKeys: [
    { key: "price_after_sell", color: "#ef4444", name: "卖后价格" },
    { key: "price_after_buyback", color: "#22c55e", name: "买后价格" },
    { key: "price_end", color: "#6366f1", name: "最终价格" },
  ]},
  { title: "卖压 / LP 比", dataKeys: [{ key: "sold_over_lp", color: "#f43f5e", name: "卖压比" }] },
  { title: "国库余额", type: "area", dataKeys: [{ key: "treasury_end", color: "#22c55e", name: "国库" }] },
  { title: "节点支付 (USDC)", dataKeys: [
    { key: "node_payout_usdc_today", color: "#f59e0b", name: "原始" },
    { key: "node_payout_usdc_capped", color: "#ef4444", name: "受限" },
  ]},
  { title: "国库防御 (回购 + 兑付)", dataKeys: [
    { key: "buyback_budget_usdc", color: "#06b6d4", name: "回购USDC" },
    { key: "ar_buyback_out", color: "#10b981", name: "回购AR" },
    { key: "redemption_usdc", color: "#8b5cf6", name: "兑付USDC" },
  ]},
  { title: "MX 销毁闸门", dataKeys: [
    { key: "mx_buy_usdc", color: "#f97316", name: "MX购买USDC" },
    { key: "mx_burn_amount", color: "#ef4444", name: "MX销毁量" },
  ]},
  { title: "净卖压 AR (卖出 - 回购)", dataKeys: [
    { key: "sold_ar_today", color: "#ef4444", name: "售出AR" },
    { key: "ar_buyback_out", color: "#22c55e", name: "回购AR" },
    { key: "net_sell_ar", color: "#f59e0b", name: "净卖压" },
  ]},
  { title: "LP 余额", dataKeys: [
    { key: "lp_usdc_end", color: "#06b6d4", name: "LP USDC" },
    { key: "lp_token_end", color: "#a855f7", name: "LP Token" },
  ]},
  { title: "每日 AR 流", dataKeys: [
    { key: "payout_ar_today", color: "#10b981", name: "发行" },
    { key: "released_ar_today", color: "#8b5cf6", name: "释放" },
    { key: "released_ar_after_redemption", color: "#f59e0b", name: "兑付后释放" },
    { key: "sold_ar_today", color: "#ef4444", name: "售出" },
  ]},
  { title: "累计防御指标", dataKeys: [
    { key: "total_ar_buyback", color: "#22c55e", name: "累计回购AR" },
    { key: "total_usdc_redemptions", color: "#8b5cf6", name: "累计兑付" },
    { key: "total_mx_burned", color: "#f97316", name: "累计MX销毁" },
  ]},
]

const fmtTick = (v: number) => {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K"
  return v.toFixed(2)
}

export const ChartsTab: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>
  return (
    <div className="charts-container">
      {CHARTS.map((chart) => (
        <div className="chart-card" key={chart.title}>
          <h3>{chart.title}</h3>
          <ResponsiveContainer width="100%" height={280}>
            {chart.type === "area" ? (
              <AreaChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="day" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={fmtTick} />
                <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8 }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => v.toFixed(4)} />
                <Legend />
                {chart.dataKeys.map((dk) => <Area key={dk.key} type="monotone" dataKey={dk.key} stroke={dk.color} fill={dk.color} fillOpacity={0.15} name={dk.name} dot={false} strokeWidth={2} />)}
              </AreaChart>
            ) : (
              <LineChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="day" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={fmtTick} />
                <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8 }} labelStyle={{ color: "#ccc" }} formatter={(v: number) => v.toFixed(4)} />
                <Legend />
                {chart.dataKeys.map((dk) => <Line key={dk.key} type="monotone" dataKey={dk.key} stroke={dk.color} name={dk.name} dot={false} strokeWidth={2} />)}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  )
}
