import React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import type { DailyRow } from "../engine/simulate"

interface Props {
  rows: DailyRow[]
}

interface ChartDef {
  title: string
  type?: "line" | "area"
  dataKeys: { key: keyof DailyRow; color: string; name: string }[]
}

const CHARTS: ChartDef[] = [
  {
    title: "代币价格",
    type: "area",
    dataKeys: [{ key: "price_end", color: "#6366f1", name: "价格" }],
  },
  {
    title: "卖压 / LP 比",
    dataKeys: [{ key: "sold_over_lp", color: "#f43f5e", name: "卖压比" }],
  },
  {
    title: "国库余额",
    type: "area",
    dataKeys: [{ key: "treasury_end", color: "#22c55e", name: "国库" }],
  },
  {
    title: "节点日支付 (USDC)",
    dataKeys: [
      { key: "node_payout_usdc_today", color: "#f59e0b", name: "原始支付" },
      { key: "node_payout_usdc_capped", color: "#ef4444", name: "受限支付" },
    ],
  },
  {
    title: "国库回购 (USDC/AR)",
    dataKeys: [
      { key: "treasury_buyback_usdc", color: "#06b6d4", name: "回购USDC支出" },
      { key: "treasury_buyback_ar", color: "#10b981", name: "回购AR获得" },
    ],
  },
  {
    title: "LP 余额",
    dataKeys: [
      { key: "lp_usdc_end", color: "#06b6d4", name: "LP USDC" },
      { key: "lp_token_end", color: "#a855f7", name: "LP Token" },
    ],
  },
  {
    title: "每日 AR 流",
    dataKeys: [
      { key: "payout_ar_today", color: "#10b981", name: "发行 AR" },
      { key: "released_ar_today", color: "#8b5cf6", name: "释放 AR" },
      { key: "sold_ar_today", color: "#ef4444", name: "售出 AR" },
    ],
  },
  {
    title: "累计 AR 指标",
    dataKeys: [
      { key: "total_ar_emitted", color: "#22d3ee", name: "总发行" },
      { key: "total_ar_burned", color: "#f97316", name: "总销毁" },
      { key: "total_ar_sold", color: "#ef4444", name: "总售出" },
    ],
  },
  {
    title: "Vault / 保险",
    dataKeys: [
      { key: "vault_profit_today", color: "#84cc16", name: "Vault 利润" },
      { key: "platform_vault_income_today", color: "#06b6d4", name: "平台收入" },
      { key: "insurance_payout_today", color: "#f43f5e", name: "保险赔付" },
    ],
  },
]

const fmtTick = (v: number) => {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "K"
  return v.toFixed(2)
}

export const ChartsTab: React.FC<Props> = ({ rows }) => {
  if (rows.length === 0) {
    return <div className="overview-empty">请先运行模拟</div>
  }

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
                <Tooltip
                  contentStyle={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8 }}
                  labelStyle={{ color: "#ccc" }}
                  formatter={(v: number) => v.toFixed(4)}
                />
                <Legend />
                {chart.dataKeys.map((dk) => (
                  <Area
                    key={dk.key}
                    type="monotone"
                    dataKey={dk.key}
                    stroke={dk.color}
                    fill={dk.color}
                    fillOpacity={0.15}
                    name={dk.name}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="day" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={fmtTick} />
                <Tooltip
                  contentStyle={{ background: "#1e1e2e", border: "1px solid #444", borderRadius: 8 }}
                  labelStyle={{ color: "#ccc" }}
                  formatter={(v: number) => v.toFixed(4)}
                />
                <Legend />
                {chart.dataKeys.map((dk) => (
                  <Line
                    key={dk.key}
                    type="monotone"
                    dataKey={dk.key}
                    stroke={dk.color}
                    name={dk.name}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  )
}
