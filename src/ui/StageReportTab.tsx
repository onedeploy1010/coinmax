import React, { useMemo, useState } from "react"
import type { DailyRow } from "../engine/simulate"
import type { ModelParams, StageCheckpoint, PressureTargets, GrowthTargets } from "../config/types"
import { computeStageReport, DEFAULT_PRESSURE_TARGETS, DEFAULT_GROWTH_TARGETS } from "../engine/stageReport"
import { exportStageCSV } from "../utils/csv"

interface Props {
  rows: DailyRow[]
  config: ModelParams
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string { return (n * 100).toFixed(2) + "%" }

const PRESSURE_COLORS: Record<string, string> = {
  SAFE: "#22c55e", WATCH: "#f59e0b", RISK: "#f97316", DANGER: "#ef4444",
}
const SUST_COLORS: Record<string, string> = {
  HEALTHY: "#22c55e", TIGHT: "#f59e0b", UNSUSTAINABLE: "#ef4444",
}

export const StageReportTab: React.FC<Props> = ({ rows, config }) => {
  const [pressureTargets, setPressureTargets] = useState<PressureTargets>({ ...DEFAULT_PRESSURE_TARGETS })
  const [growthTargets, setGrowthTargets] = useState<GrowthTargets>({ ...DEFAULT_GROWTH_TARGETS })
  const [minLpThreshold, setMinLpThreshold] = useState(20000)
  const [showConfig, setShowConfig] = useState(false)

  const stages = useMemo(
    () => computeStageReport(rows, config, pressureTargets, growthTargets, minLpThreshold),
    [rows, config, pressureTargets, growthTargets, minLpThreshold],
  )

  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  return (
    <div className="stage-report-container">
      <div className="stage-report-header">
        <h2>阶段压力 & KPI 报告</h2>
        <div className="stage-report-actions">
          <button className="btn-xs" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? "隐藏设置" : "调整阈值"}
          </button>
          <button className="btn-sm" onClick={() => exportStageCSV(stages)}>导出 CSV</button>
        </div>
      </div>

      {showConfig && (
        <div className="stage-config-panel">
          <div className="stage-config-row">
            <label>卖压/LP 目标</label>
            <input type="number" step="0.05" value={pressureTargets.targetSoldOverLP}
              onChange={(e) => setPressureTargets({ ...pressureTargets, targetSoldOverLP: parseFloat(e.target.value) || 0.25 })} />
          </div>
          <div className="stage-config-row">
            <label>回撤目标</label>
            <input type="number" step="0.05" value={pressureTargets.targetDrawdown}
              onChange={(e) => setPressureTargets({ ...pressureTargets, targetDrawdown: parseFloat(e.target.value) || 0.50 })} />
          </div>
          <div className="stage-config-row">
            <label>国库压力目标</label>
            <input type="number" step="0.01" value={pressureTargets.targetTreasuryStress}
              onChange={(e) => setPressureTargets({ ...pressureTargets, targetTreasuryStress: parseFloat(e.target.value) || 0.10 })} />
          </div>
          <div className="stage-config-row">
            <label>初级90天目标</label>
            <input type="number" value={growthTargets.target_junior_90}
              onChange={(e) => setGrowthTargets({ ...growthTargets, target_junior_90: parseInt(e.target.value) || 2000 })} />
          </div>
          <div className="stage-config-row">
            <label>高级90天目标</label>
            <input type="number" value={growthTargets.target_senior_90}
              onChange={(e) => setGrowthTargets({ ...growthTargets, target_senior_90: parseInt(e.target.value) || 500 })} />
          </div>
          <div className="stage-config-row">
            <label>最低LP阈值</label>
            <input type="number" value={minLpThreshold}
              onChange={(e) => setMinLpThreshold(parseFloat(e.target.value) || 20000)} />
          </div>
        </div>
      )}

      {stages.length > 0 && (
        <div className="table-scroll">
          <table className="stage-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>初级/高级</th>
                <th>价格</th>
                <th>LP USDC</th>
                <th>国库</th>
                <th>最大回撤</th>
                <th>最大卖压/LP</th>
                <th>压力指数</th>
                <th>压力等级</th>
                <th>增长KPI</th>
                <th>支付可持续</th>
                <th>流动性</th>
                <th>建议</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.day}>
                  <td><strong>{s.day}</strong></td>
                  <td>{fmt(s.junior_cum, 0)} / {fmt(s.senior_cum, 0)}</td>
                  <td>${fmt(s.price, 4)}</td>
                  <td>${fmt(s.lp_usdc, 0)}</td>
                  <td>${fmt(s.treasury, 0)}</td>
                  <td style={{ color: s.max_drawdown > 0.3 ? "#ef4444" : "#22c55e" }}>{pct(s.max_drawdown)}</td>
                  <td style={{ color: s.max_sold_over_lp > 0.1 ? "#ef4444" : "#22c55e" }}>{pct(s.max_sold_over_lp)}</td>
                  <td>{s.pressure_score.toFixed(1)}</td>
                  <td>
                    <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
                      {s.pressure_label}
                    </span>
                  </td>
                  <td style={{ color: s.growth_kpi === "PASS" ? "#22c55e" : "#ef4444" }}>{s.growth_kpi}</td>
                  <td style={{ color: SUST_COLORS[s.sustainability_label] }}>{s.sustainability_label}</td>
                  <td style={{ color: s.liquidity_label === "PASS" ? "#22c55e" : "#ef4444" }}>{s.liquidity_label}</td>
                  <td className="rec-cell">{s.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Cards per stage */}
      {stages.length > 0 && (
        <div className="stage-details-grid">
          {stages.map((s) => (
            <div className="stage-detail-card" key={s.day}>
              <div className="stage-detail-header">
                <span className="stage-detail-day">Day {s.day}</span>
                <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
                  {s.pressure_label} ({s.pressure_score.toFixed(0)})
                </span>
              </div>
              <div className="stage-detail-metrics">
                <div><span className="sdm-label">价格</span><span className="sdm-value">${fmt(s.price, 4)}</span></div>
                <div><span className="sdm-label">国库</span><span className="sdm-value">${fmt(s.treasury, 0)}</span></div>
                <div><span className="sdm-label">LP</span><span className="sdm-value">${fmt(s.lp_usdc, 0)}</span></div>
                <div><span className="sdm-label">支付率</span><span className="sdm-value">{pct(s.payout_ratio)}</span></div>
                <div><span className="sdm-label">回购MX</span><span className="sdm-value">{fmt(s.total_ar_buyback, 0)}</span></div>
                <div><span className="sdm-label">MX销毁</span><span className="sdm-value">{fmt(s.total_mx_burned, 0)}</span></div>
              </div>
              <div className="stage-detail-rec">{s.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
