import React, { useState, useCallback } from "react"
import type { ModelParams, OptObjective, OptimizerConstraints, OptSearchRange, OptRunResult, OptResultItem } from "../config/types"
import { runOptimizerV2, DEFAULT_OPT_RANGES, DEFAULT_OPT_CONSTRAINTS } from "../engine/stressTest"
import { exportOptimizerCSV } from "../utils/csv"

interface Props {
  config: ModelParams
  onApply: (overrides: Record<string, number>) => void
  isMobile: boolean
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string { return (n * 100).toFixed(2) + "%" }

const OBJ_OPTIONS: { value: OptObjective; label: string; desc: string }[] = [
  { value: "max_safety", label: "最大安全", desc: "优先最小回撤和卖压" },
  { value: "balanced", label: "均衡", desc: "安全与增长平衡" },
  { value: "max_growth", label: "最大增长", desc: "在安全范围内最大化增长" },
]

const PARAM_LABELS: Record<string, string> = {
  sell_pressure_ratio: "卖压比例",
  lp_usdc: "LP USDC",
  growth_rate: "增长率",
  junior_monthly_new: "初级月新增",
  senior_monthly_new: "高级月新增",
  treasury_buyback_ratio: "回购比例",
  treasury_redemption_ratio: "兑付比例",
  mx_burn_per_withdraw_ratio: "MX销毁比例",
  max_out_multiple: "最大回本倍数",
  vault_convert_ratio: "质押转化率",
  vault_monthly_new: "质押月新增",
  vault_avg_stake_usdc: "人均质押USDC",
  referral_bonus_ratio: "推荐奖金比例",
}

export const OptimizerTab: React.FC<Props> = ({ config, onApply, isMobile }) => {
  const [objective, setObjective] = useState<OptObjective>("balanced")
  const [constraints, setConstraints] = useState<OptimizerConstraints>({ ...DEFAULT_OPT_CONSTRAINTS })
  const [searchRanges, setSearchRanges] = useState<OptSearchRange[]>(DEFAULT_OPT_RANGES.map((r) => ({ ...r })))
  const [maxIterations, setMaxIterations] = useState(500)
  const [result, setResult] = useState<OptRunResult | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [applied, setApplied] = useState<Record<string, number> | null>(null)

  const toggleRange = (idx: number) => {
    const updated = [...searchRanges]
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
    setSearchRanges(updated)
  }

  const handleRun = useCallback(() => {
    setRunning(true)
    setSelectedIdx(null)
    setApplied(null)
    setTimeout(() => {
      const res = runOptimizerV2(config, objective, constraints, searchRanges, maxIterations, (done, total) => {
        setProgress({ done, total })
      })
      setResult(res)
      setRunning(false)
    }, 16)
  }, [config, objective, constraints, searchRanges, maxIterations])

  const handleApply = (item: OptResultItem) => {
    setApplied(item.overrides)
    onApply(item.overrides)
  }

  const selected = selectedIdx !== null && result ? result.results[selectedIdx] : null
  const baseline = result?.baseline

  return (
    <div className="optimizer-container">
      {/* Config Section */}
      <div className={`optimizer-config ${isMobile ? "optimizer-config-mobile" : ""}`}>
        {/* Objective */}
        <div className="opt-section">
          <h3>优化目标</h3>
          <div className="opt-objectives">
            {OBJ_OPTIONS.map((o) => (
              <label key={o.value} className={`opt-obj-card ${objective === o.value ? "opt-obj-active" : ""}`}>
                <input type="radio" name="objective" value={o.value} checked={objective === o.value}
                  onChange={() => setObjective(o.value)} />
                <div className="opt-obj-label">{o.label}</div>
                <div className="opt-obj-desc">{o.desc}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Constraints */}
        <div className="opt-section">
          <h3>约束条件</h3>
          <div className="field-row">
            <label>最低国库 USDC</label>
            <input type="number" value={constraints.min_treasury_usdc}
              onChange={(e) => setConstraints({ ...constraints, min_treasury_usdc: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最低 LP USDC</label>
            <input type="number" value={constraints.min_lp_usdc}
              onChange={(e) => setConstraints({ ...constraints, min_lp_usdc: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最大回撤</label>
            <input type="number" step="0.05" value={constraints.max_drawdown}
              onChange={(e) => setConstraints({ ...constraints, max_drawdown: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最大卖压/LP</label>
            <input type="number" step="0.05" value={constraints.max_sold_over_lp}
              onChange={(e) => setConstraints({ ...constraints, max_sold_over_lp: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field-row">
            <label>最低质押用户</label>
            <input type="number" value={constraints.min_vault_stakers}
              onChange={(e) => setConstraints({ ...constraints, min_vault_stakers: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>

        {/* Search Ranges */}
        <div className="opt-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3>搜索参数</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-xs" onClick={() => setSearchRanges(searchRanges.map((r) => ({ ...r, enabled: true })))}>全选</button>
              <button className="btn-xs" onClick={() => setSearchRanges(searchRanges.map((r) => ({ ...r, enabled: false })))}>全不选</button>
            </div>
          </div>
          <div className="opt-ranges">
            {searchRanges.map((r, i) => (
              <label key={r.key} className="opt-range-item">
                <input type="checkbox" checked={r.enabled} onChange={() => toggleRange(i)} />
                <span className="opt-range-label">{r.label}</span>
                <span className="opt-range-values">[{r.values.length} 值]</span>
              </label>
            ))}
          </div>
          <div className="field-row" style={{ marginTop: 8 }}>
            <label>迭代次数</label>
            <input type="number" value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value) || 500)} />
          </div>
        </div>

        <button className="btn-run" onClick={handleRun} disabled={running}>
          {running ? `优化中... ${progress.done}/${progress.total}` : "运行优化"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="opt-results">
          <div className="opt-results-header">
            <h3>优化结果 Top 5 ({OBJ_OPTIONS.find((o) => o.value === result.objective)?.label})</h3>
            <button className="btn-sm" onClick={() => exportOptimizerCSV(result)}>导出 CSV</button>
          </div>

          {/* Top 5 Table */}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {Object.keys(result.results[0]?.overrides ?? {}).map((k) => (
                    <th key={k}>{PARAM_LABELS[k] ?? k}</th>
                  ))}
                  <th>最终价格</th>
                  <th>最大回撤</th>
                  <th>最大卖压/LP</th>
                  <th>最低国库</th>
                  <th>质押用户</th>
                  <th>质押USDC</th>
                  <th>平台收入</th>
                  <th>分数</th>
                  <th>结果</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item, i) => (
                  <tr key={i} className={selectedIdx === i ? "row-highlight" : item.summary.fail_reason ? "row-fail" : "row-pass"}
                    onClick={() => setSelectedIdx(selectedIdx === i ? null : i)} style={{ cursor: "pointer" }}>
                    <td>{item.rank}</td>
                    {Object.values(item.overrides).map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                    <td>${fmt(item.summary.final_price, 6)}</td>
                    <td>{pct(item.summary.max_drawdown)}</td>
                    <td>{pct(item.summary.max_sold_over_lp)}</td>
                    <td>${fmt(item.summary.min_treasury, 0)}</td>
                    <td>{fmt(item.summary.vault_stakers, 0)}</td>
                    <td>${fmt(item.summary.vault_total_staked_usdc, 0)}</td>
                    <td>${fmt(item.summary.vault_platform_income, 0)}</td>
                    <td>{item.score.toFixed(1)}</td>
                    <td className={item.summary.fail_reason ? "cell-fail" : "cell-pass"}>
                      {item.summary.fail_reason ?? "通过"}
                    </td>
                    <td>
                      <button className="btn-xs" style={{ color: "#22c55e", borderColor: "#22c55e" }}
                        onClick={(e) => { e.stopPropagation(); handleApply(item) }}>
                        {applied && JSON.stringify(applied) === JSON.stringify(item.overrides) ? "已应用" : "应用"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Before/After Comparison */}
          {selected && baseline && (
            <div className="before-after-section">
              <h3>对比：当前 vs 方案 #{selected.rank}</h3>
              <div className="before-after-grid">
                {([
                  { label: "最终价格", before: baseline.final_price, after: selected.summary.final_price, fmt: (v: number) => "$" + fmt(v, 6), higher_better: true },
                  { label: "最大回撤", before: baseline.max_drawdown, after: selected.summary.max_drawdown, fmt: pct, higher_better: false },
                  { label: "最大卖压/LP", before: baseline.max_sold_over_lp, after: selected.summary.max_sold_over_lp, fmt: pct, higher_better: false },
                  { label: "最低国库", before: baseline.min_treasury, after: selected.summary.min_treasury, fmt: (v: number) => "$" + fmt(v, 0), higher_better: true },
                  { label: "最低 LP USDC", before: baseline.min_lp_usdc, after: selected.summary.min_lp_usdc, fmt: (v: number) => "$" + fmt(v, 0), higher_better: true },
                  { label: "最终国库", before: baseline.final_treasury, after: selected.summary.final_treasury, fmt: (v: number) => "$" + fmt(v, 0), higher_better: true },
                  { label: "净卖压", before: baseline.net_sell_pressure, after: selected.summary.net_sell_pressure, fmt: (v: number) => fmt(v, 0), higher_better: false },
                  { label: "质押用户", before: baseline.vault_stakers, after: selected.summary.vault_stakers, fmt: (v: number) => fmt(v, 0), higher_better: true },
                  { label: "质押USDC", before: baseline.vault_total_staked_usdc, after: selected.summary.vault_total_staked_usdc, fmt: (v: number) => "$" + fmt(v, 0), higher_better: true },
                  { label: "平台收入", before: baseline.vault_platform_income, after: selected.summary.vault_platform_income, fmt: (v: number) => "$" + fmt(v, 0), higher_better: true },
                ] as const).map((item) => {
                  const diff = item.after - item.before
                  const improved = item.higher_better ? diff > 0 : diff < 0
                  return (
                    <div className="ba-card" key={item.label}>
                      <div className="ba-label">{item.label}</div>
                      <div className="ba-row">
                        <div className="ba-before">
                          <span className="ba-tag">当前</span>
                          <span className="ba-val">{item.fmt(item.before)}</span>
                        </div>
                        <span className="ba-arrow">→</span>
                        <div className="ba-after">
                          <span className="ba-tag">优化</span>
                          <span className="ba-val" style={{ color: improved ? "#22c55e" : diff === 0 ? "#888" : "#ef4444" }}>
                            {item.fmt(item.after)}
                          </span>
                        </div>
                      </div>
                      {diff !== 0 && (
                        <div className="ba-diff" style={{ color: improved ? "#22c55e" : "#ef4444" }}>
                          {improved ? "▲" : "▼"} {Math.abs(diff) < 0.01 ? item.fmt(Math.abs(diff)) : item.fmt(Math.abs(diff))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Parameter Changes */}
              <div className="ba-params">
                <h4>参数变更</h4>
                <div className="ba-params-grid">
                  {Object.entries(selected.overrides).map(([k, v]) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const currentVal = (config as any)[k]
                    const changed = currentVal !== v
                    return (
                      <div key={k} className={`ba-param-item ${changed ? "ba-param-changed" : ""}`}>
                        <span className="ba-param-key">{PARAM_LABELS[k] ?? k}</span>
                        <span className="ba-param-from">{currentVal}</span>
                        <span className="ba-param-arrow">→</span>
                        <span className="ba-param-to" style={{ color: changed ? "#22c55e" : "#888" }}>{v}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button className="btn-run" onClick={() => handleApply(selected)} style={{ marginTop: 12 }}>
                应用此方案并重新运行
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
