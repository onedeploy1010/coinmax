import React, { useRef, useState } from "react"
import type { DailyRow } from "../engine/simulate"
import { exportCSV } from "../utils/csv"

interface Props {
  rows: DailyRow[]
}

const COLUMNS: { key: keyof DailyRow; label: string; fmt?: (v: number) => string }[] = [
  { key: "day", label: "天" },
  { key: "month_idx", label: "月" },
  { key: "junior_new", label: "初级新增" },
  { key: "senior_new", label: "高级新增" },
  { key: "junior_cum", label: "初级累计" },
  { key: "senior_cum", label: "高级累计" },
  { key: "junior_unlocked_users", label: "初级解锁" },
  { key: "senior_unlocked_users", label: "高级解锁" },
  { key: "junior_active_cohorts", label: "初级活跃" },
  { key: "senior_active_cohorts", label: "高级活跃" },
  { key: "junior_maxed_cohorts", label: "初级封顶" },
  { key: "senior_maxed_cohorts", label: "高级封顶" },
  { key: "node_payout_usdc_today", label: "日支付(原)", fmt: (v) => v.toFixed(2) },
  { key: "node_payout_usdc_capped", label: "日支付(限)", fmt: (v) => v.toFixed(2) },
  { key: "payout_ar_today", label: "支付AR", fmt: (v) => v.toFixed(2) },
  { key: "treasury_buyback_usdc", label: "回购USDC", fmt: (v) => v.toFixed(2) },
  { key: "treasury_buyback_ar", label: "回购AR", fmt: (v) => v.toFixed(2) },
  { key: "burn_rate", label: "销毁率", fmt: (v) => (v * 100).toFixed(1) + "%" },
  { key: "released_ar_today", label: "释放AR", fmt: (v) => v.toFixed(2) },
  { key: "sold_ar_today", label: "售出AR", fmt: (v) => v.toFixed(2) },
  { key: "usdc_out", label: "USDC流出", fmt: (v) => v.toFixed(2) },
  { key: "price_end", label: "价格", fmt: (v) => v.toFixed(6) },
  { key: "price_change", label: "价格变化", fmt: (v) => (v * 100).toFixed(4) + "%" },
  { key: "lp_usdc_end", label: "LP USDC", fmt: (v) => v.toFixed(2) },
  { key: "lp_token_end", label: "LP Token", fmt: (v) => v.toFixed(2) },
  { key: "treasury_end", label: "国库", fmt: (v) => v.toFixed(2) },
  { key: "sold_over_lp", label: "卖压/LP", fmt: (v) => (v * 100).toFixed(4) + "%" },
  { key: "total_ar_emitted", label: "累计发行", fmt: (v) => v.toFixed(2) },
  { key: "total_ar_burned", label: "累计销毁", fmt: (v) => v.toFixed(2) },
  { key: "total_ar_sold", label: "累计售出", fmt: (v) => v.toFixed(2) },
  { key: "vault_profit_today", label: "Vault利润", fmt: (v) => v.toFixed(2) },
  { key: "platform_vault_income_today", label: "平台收入", fmt: (v) => v.toFixed(2) },
]

const PAGE_SIZE = 50

export const TableTab: React.FC<Props> = ({ rows }) => {
  const tableRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  if (rows.length === 0) {
    return <div className="overview-empty">请先运行模拟</div>
  }

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="table-container">
      <div className="table-toolbar">
        <button className="btn-sm" onClick={() => exportCSV(rows)}>
          导出 CSV
        </button>
        <div className="pagination">
          <button className="btn-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button className="btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      </div>
      <div className="table-scroll" ref={tableRef}>
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.day}>
                {COLUMNS.map((c) => {
                  const v = row[c.key] as number
                  return <td key={c.key}>{c.fmt ? c.fmt(v) : v}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
