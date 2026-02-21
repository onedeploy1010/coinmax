import React, { useRef, useState } from "react"
import type { DailyRow } from "../engine/simulate"
import { exportCSV } from "../utils/csv"

interface Props { rows: DailyRow[] }

const COLUMNS: { key: keyof DailyRow; label: string; fmt?: (v: number | boolean) => string }[] = [
  { key: "day", label: "天" },
  { key: "month_idx", label: "月" },
  { key: "junior_new", label: "初级+" },
  { key: "senior_new", label: "高级+" },
  { key: "junior_cum", label: "初级累" },
  { key: "senior_cum", label: "高级累" },
  { key: "node_payout_usdc_capped", label: "支付(限)", fmt: (v) => (v as number).toFixed(2) },
  { key: "payout_mx_today", label: "MX发行", fmt: (v) => (v as number).toFixed(2) },
  { key: "mx_buy_usdc", label: "MX$", fmt: (v) => (v as number).toFixed(2) },
  { key: "mx_burn_amount", label: "MX烧", fmt: (v) => (v as number).toFixed(2) },
  { key: "redemption_mx", label: "兑付MX", fmt: (v) => (v as number).toFixed(2) },
  { key: "released_mx_after_redemption", label: "释放(后)", fmt: (v) => (v as number).toFixed(2) },
  { key: "sold_mx_today", label: "售MX", fmt: (v) => (v as number).toFixed(2) },
  { key: "price_after_sell", label: "卖后价", fmt: (v) => (v as number).toFixed(6) },
  { key: "treasury_defense_active", label: "防御", fmt: (v) => (v as boolean) ? "ON" : "-" },
  { key: "buyback_budget_usdc", label: "回购$", fmt: (v) => (v as number).toFixed(2) },
  { key: "mx_buyback_out", label: "回购MX", fmt: (v) => (v as number).toFixed(2) },
  { key: "net_sell_mx", label: "净卖", fmt: (v) => (v as number).toFixed(2) },
  { key: "price_end", label: "价格", fmt: (v) => (v as number).toFixed(6) },
  { key: "price_change", label: "变化", fmt: (v) => ((v as number) * 100).toFixed(3) + "%" },
  { key: "lp_usdc_end", label: "LP$", fmt: (v) => (v as number).toFixed(0) },
  { key: "treasury_end", label: "国库", fmt: (v) => (v as number).toFixed(0) },
  { key: "sold_over_lp", label: "卖/LP", fmt: (v) => ((v as number) * 100).toFixed(3) + "%" },
  { key: "total_mx_buyback", label: "累回购", fmt: (v) => (v as number).toFixed(0) },
  { key: "total_mx_burned", label: "累MX烧", fmt: (v) => (v as number).toFixed(0) },
]

const PAGE_SIZE = 50

export const TableTab: React.FC<Props> = ({ rows }) => {
  const tableRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <button className="btn-sm" onClick={() => exportCSV(rows)}>导出 CSV</button>
        <div className="pagination">
          <button className="btn-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span>{page + 1} / {totalPages}</span>
          <button className="btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </div>
      <div className="table-scroll" ref={tableRef}>
        <table>
          <thead><tr>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.day}>
                {COLUMNS.map((c) => {
                  const v = row[c.key]
                  return <td key={c.key}>{c.fmt ? c.fmt(v as number | boolean) : String(v)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
