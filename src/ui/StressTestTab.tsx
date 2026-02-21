import React, { useState, useCallback } from "react"
import type { ModelParams, StressConfig, StressRange, FailRules, StressSummary, ThresholdResult } from "../config/types"
import { runStressTest, findThresholds } from "../engine/stressTest"
import { exportStressCSV } from "../utils/csv"

interface Props {
  config: ModelParams
  isMobile: boolean
}

const DEFAULT_FAIL_RULES: FailRules = {
  min_treasury_usdc: 0,
  min_lp_usdc: 10000,
  max_price_drawdown: 0.5,
  max_sold_over_lp: 0.1,
}

const DEFAULT_RANGES: StressRange[] = [
  { key: "sell_pressure_ratio", min: 0.3, max: 0.9, step: 0.1 },
  { key: "junior_monthly_new", min: 300, max: 1000, step: 100 },
]

function fmt(n: number, d = 4): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + "%"
}

export const StressTestTab: React.FC<Props> = ({ config, isMobile }) => {
  const [ranges, setRanges] = useState<StressRange[]>(DEFAULT_RANGES)
  const [failRules, setFailRules] = useState<FailRules>(DEFAULT_FAIL_RULES)
  const [maxRuns, setMaxRuns] = useState(500)
  const [results, setResults] = useState<StressSummary[]>([])
  const [thresholds, setThresholds] = useState<ThresholdResult[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 30

  const handleAddRange = () => {
    setRanges([...ranges, { key: "lp_usdc", min: 50000, max: 200000, step: 25000 }])
  }

  const handleRemoveRange = (idx: number) => {
    setRanges(ranges.filter((_, i) => i !== idx))
  }

  const updateRange = (idx: number, field: keyof StressRange, val: string | number) => {
    const updated = [...ranges]
    updated[idx] = { ...updated[idx], [field]: typeof val === "string" ? val : val }
    setRanges(updated)
  }

  const handleRun = useCallback(() => {
    setRunning(true)
    setPage(0)
    setTimeout(() => {
      const stressCfg: StressConfig = { ranges, failRules, maxRuns }
      const res = runStressTest(config, stressCfg, (done, total) => {
        setProgress({ done, total })
      })
      setResults(res)

      // Also find thresholds
      const th = findThresholds(config, failRules)
      setThresholds(th)

      setRunning(false)
    }, 16)
  }, [config, ranges, failRules, maxRuns])

  const failCount = results.filter((r) => r.fail_reason !== null).length
  const passCount = results.length - failCount
  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const pageResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const paramKeys = results.length > 0 ? Object.keys(results[0].params) : []

  return (
    <div className="stress-container">
      {/* Config section */}
      <div className={`stress-config ${isMobile ? "stress-config-mobile" : ""}`}>
        {/* Ranges */}
        <div className="stress-section">
          <h3>参数范围</h3>
          {ranges.map((r, i) => (
            <div className="stress-range-row" key={i}>
              <input
                className="stress-input stress-input-key"
                type="text"
                value={r.key}
                onChange={(e) => updateRange(i, "key", e.target.value)}
                placeholder="参数名"
              />
              <input
                className="stress-input"
                type="number"
                value={r.min}
                onChange={(e) => updateRange(i, "min", parseFloat(e.target.value) || 0)}
                step="any"
              />
              <span className="stress-label">~</span>
              <input
                className="stress-input"
                type="number"
                value={r.max}
                onChange={(e) => updateRange(i, "max", parseFloat(e.target.value) || 0)}
                step="any"
              />
              <span className="stress-label">步</span>
              <input
                className="stress-input"
                type="number"
                value={r.step}
                onChange={(e) => updateRange(i, "step", parseFloat(e.target.value) || 0.01)}
                step="any"
              />
              <button className="btn-xs btn-danger" onClick={() => handleRemoveRange(i)}>删</button>
            </div>
          ))}
          <button className="btn-xs" onClick={handleAddRange}>+ 添加范围</button>
        </div>

        {/* Fail rules */}
        <div className="stress-section">
          <h3>失败规则</h3>
          <div className="field-row">
            <label>最低国库 USDC</label>
            <input type="number" value={failRules.min_treasury_usdc}
              onChange={(e) => setFailRules({ ...failRules, min_treasury_usdc: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最低 LP USDC</label>
            <input type="number" value={failRules.min_lp_usdc}
              onChange={(e) => setFailRules({ ...failRules, min_lp_usdc: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最大价格回撤</label>
            <input type="number" step="0.01" value={failRules.max_price_drawdown}
              onChange={(e) => setFailRules({ ...failRules, max_price_drawdown: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最大卖压/LP比</label>
            <input type="number" step="0.01" value={failRules.max_sold_over_lp}
              onChange={(e) => setFailRules({ ...failRules, max_sold_over_lp: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>

        <div className="stress-section">
          <div className="field-row">
            <label>最大运行数</label>
            <input type="number" value={maxRuns}
              onChange={(e) => setMaxRuns(parseInt(e.target.value) || 100)} />
          </div>
          <button className="btn-run" onClick={handleRun} disabled={running}>
            {running ? `运行中... ${progress.done}/${progress.total}` : "运行压力测试"}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="stress-results">
          {/* Summary cards */}
          <div className="stress-summary-bar">
            <div className="kpi-card">
              <div className="kpi-label">总运行数</div>
              <div className="kpi-value">{results.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">通过</div>
              <div className="kpi-value" style={{ color: "#22c55e" }}>{passCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">失败</div>
              <div className="kpi-value" style={{ color: "#ef4444" }}>{failCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">失败率</div>
              <div className="kpi-value" style={{ color: failCount > 0 ? "#ef4444" : "#22c55e" }}>
                {results.length > 0 ? pct(failCount / results.length) : "0%"}
              </div>
            </div>
          </div>

          {/* Threshold finder results */}
          {thresholds.length > 0 && (
            <div className="stress-thresholds">
              <h3>临界阈值发现</h3>
              <div className="stress-summary-bar">
                {thresholds.map((t) => (
                  <div className="kpi-card" key={t.key}>
                    <div className="kpi-label">{t.label}</div>
                    <div className="kpi-value" style={{ color: "#f59e0b" }}>
                      {t.safe_value.toLocaleString("zh-CN")}
                    </div>
                    <div className="kpi-sub">{t.direction === "max" ? "最大安全值" : "最小安全值"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="table-toolbar">
            <button className="btn-sm" onClick={() => exportStressCSV(results)}>
              导出压力测试 CSV
            </button>
            <div className="pagination">
              <button className="btn-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
              <span>{page + 1} / {totalPages}</span>
              <button className="btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>下一页</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {paramKeys.map((k) => <th key={k}>{k}</th>)}
                  <th>最终价格</th>
                  <th>最低价格</th>
                  <th>最大回撤</th>
                  <th>最低LP</th>
                  <th>最低国库</th>
                  <th>最终国库</th>
                  <th>最大卖压/LP</th>
                  <th>总支付</th>
                  <th>总MX发行</th>
                  <th>累回购MX</th>
                  <th>累MX销毁</th>
                  <th>累兑付</th>
                  <th>净卖压</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((r, i) => (
                  <tr key={page * PAGE_SIZE + i} className={r.fail_reason ? "row-fail" : "row-pass"}>
                    <td>{page * PAGE_SIZE + i + 1}</td>
                    {paramKeys.map((k) => <td key={k}>{r.params[k]}</td>)}
                    <td>{fmt(r.final_price, 6)}</td>
                    <td>{fmt(r.min_price, 6)}</td>
                    <td>{pct(r.max_drawdown)}</td>
                    <td>{fmt(r.min_lp_usdc, 2)}</td>
                    <td>{fmt(r.min_treasury, 2)}</td>
                    <td>{fmt(r.final_treasury, 2)}</td>
                    <td>{pct(r.max_sold_over_lp)}</td>
                    <td>{fmt(r.total_payout_usdc, 2)}</td>
                    <td>{fmt(r.total_mx_emitted, 2)}</td>
                    <td>{fmt(r.total_mx_buyback, 2)}</td>
                    <td>{fmt(r.total_mx_burned, 2)}</td>
                    <td>{fmt(r.total_mx_redemptions, 2)}</td>
                    <td>{fmt(r.net_sell_pressure, 2)}</td>
                    <td className={r.fail_reason ? "cell-fail" : "cell-pass"}>
                      {r.fail_reason ?? "通过"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
