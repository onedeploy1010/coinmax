import React, { useState, useMemo } from "react"
import type { DailyRow } from "../engine/simulate"
import type { ModelParams, StageCheckpoint, PressureTargets, GrowthTargets } from "../config/types"
import { computeStageReport, DEFAULT_PRESSURE_TARGETS, DEFAULT_GROWTH_TARGETS, STAGE_DAYS } from "../engine/stageReport"

interface Props {
  rows: DailyRow[]
  config: ModelParams
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string { return (n * 100).toFixed(2) + "%" }

const PRESSURE_COLORS: Record<string, string> = {
  SAFE: "#22c55e",
  WATCH: "#f59e0b",
  RISK: "#f97316",
  DANGER: "#ef4444",
}

const SUST_COLORS: Record<string, string> = {
  HEALTHY: "#22c55e",
  TIGHT: "#f59e0b",
  UNSUSTAINABLE: "#ef4444",
}

const TOOLTIPS: Record<string, string> = {
  pressure: "Pressure Index (0-100) measures sell pressure vs LP, price drawdown, and treasury stress. Lower is safer.",
  growth: "Growth KPI checks if node acquisition meets 80% of targets interpolated from your 90-day goals.",
  sustainability: "Payout ratio = total payouts / total principal inflow. Below 60% is healthy, above 100% is unsustainable.",
  liquidity: "Checks if LP USDC balance stays above the minimum threshold (default 20,000).",
  drawdown: "Maximum peak-to-trough price drop as a percentage. Lower values indicate price stability.",
  sold_over_lp: "Maximum daily USDC sold as a fraction of LP USDC. High values indicate liquidity stress.",
}

interface TooltipProps {
  text: string
}

const Tooltip: React.FC<TooltipProps> = ({ text }) => (
  <span className="tooltip-trigger">
    <span className="tooltip-icon">?</span>
    <span className="tooltip-text">{text}</span>
  </span>
)

export const InvestorDashboardTab: React.FC<Props> = ({ rows, config }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [pressureTargets] = useState<PressureTargets>(DEFAULT_PRESSURE_TARGETS)
  const [growthTargets] = useState<GrowthTargets>(DEFAULT_GROWTH_TARGETS)

  const stages = useMemo(
    () => computeStageReport(rows, config, pressureTargets, growthTargets),
    [rows, config, pressureTargets, growthTargets],
  )

  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  const last = rows[rows.length - 1]
  const totalNodes = last.junior_cum + last.senior_cum

  // Find the latest stage data for summary
  const latestStage = stages.length > 0 ? stages[stages.length - 1] : null

  // Top 3 cards
  const growthStatus = latestStage?.growth_kpi === "PASS" ? "PASS" : "FAIL"
  const stabilityStatus = latestStage ? latestStage.pressure_label : "N/A"
  const cashflowStatus = latestStage ? latestStage.sustainability_label : "N/A"

  const selectedStage = selectedDay ? stages.find((s) => s.day === selectedDay) : null

  return (
    <div className="investor-dashboard">
      {/* Top 3 Summary Cards */}
      <div className="top-cards">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">增长 Growth</span>
            <span className="summary-badge" style={{ background: growthStatus === "PASS" ? "#22c55e22" : "#ef444422", color: growthStatus === "PASS" ? "#22c55e" : "#ef4444" }}>
              {growthStatus}
            </span>
          </div>
          <div className="summary-card-value">{fmt(totalNodes, 0)} 节点</div>
          <div className="summary-card-sub">
            初级 {fmt(last.junior_cum, 0)} / 高级 {fmt(last.senior_cum, 0)}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">稳定性 Stability</span>
            <span className="summary-badge" style={{ background: (PRESSURE_COLORS[stabilityStatus] ?? "#666") + "22", color: PRESSURE_COLORS[stabilityStatus] ?? "#666" }}>
              {stabilityStatus}
            </span>
          </div>
          <div className="summary-card-value">${fmt(last.price_end, 6)}</div>
          <div className="summary-card-sub">
            回撤 {latestStage ? pct(latestStage.max_drawdown) : "N/A"} | 卖压/LP {latestStage ? pct(latestStage.max_sold_over_lp) : "N/A"}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">现金流 Cashflow</span>
            <span className="summary-badge" style={{ background: (SUST_COLORS[cashflowStatus] ?? "#666") + "22", color: SUST_COLORS[cashflowStatus] ?? "#666" }}>
              {cashflowStatus}
            </span>
          </div>
          <div className="summary-card-value">${fmt(last.treasury_end, 0)}</div>
          <div className="summary-card-sub">
            支付率 {latestStage ? pct(latestStage.payout_ratio) : "N/A"} | LP ${fmt(last.lp_usdc_end, 0)}
          </div>
        </div>
      </div>

      {/* Stage Day Pills */}
      <div className="stage-pills-section">
        <h3>阶段里程碑 Stage Milestones</h3>
        <div className="stage-pills">
          {STAGE_DAYS.filter((d) => d <= config.sim_days).map((d) => {
            const stage = stages.find((s) => s.day === d)
            const color = stage ? PRESSURE_COLORS[stage.pressure_label] : "#666"
            return (
              <button
                key={d}
                className={`stage-pill ${selectedDay === d ? "stage-pill-active" : ""}`}
                style={{ borderColor: color }}
                onClick={() => setSelectedDay(selectedDay === d ? null : d)}
              >
                <span className="stage-pill-day">Day {d}</span>
                {stage && (
                  <span className="stage-pill-label" style={{ color }}>
                    {stage.pressure_label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stage Snapshot Panel */}
      {selectedStage && (
        <div className="stage-snapshot">
          <h3>Day {selectedStage.day} 快照</h3>
          <div className="snapshot-explanation">
            在第 {selectedStage.day} 天：已累计 {selectedStage.junior_cum + selectedStage.senior_cum} 节点用户；
            代币价格 ${fmt(selectedStage.price, 6)}；
            日卖压影响 LP 比例最高 {pct(selectedStage.max_sold_over_lp)}；
            国库余额 ${fmt(selectedStage.treasury, 0)}。
          </div>

          <div className="snapshot-grid">
            <div className="snapshot-item">
              <div className="snapshot-label">价格 <Tooltip text={TOOLTIPS.drawdown} /></div>
              <div className="snapshot-value">${fmt(selectedStage.price, 6)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">最大回撤 <Tooltip text={TOOLTIPS.drawdown} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.max_drawdown > 0.3 ? "#ef4444" : "#22c55e" }}>
                {pct(selectedStage.max_drawdown)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">卖压/LP (max) <Tooltip text={TOOLTIPS.sold_over_lp} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.max_sold_over_lp > 0.1 ? "#ef4444" : "#22c55e" }}>
                {pct(selectedStage.max_sold_over_lp)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">LP USDC</div>
              <div className="snapshot-value">${fmt(selectedStage.lp_usdc, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">国库</div>
              <div className="snapshot-value">${fmt(selectedStage.treasury, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">国库最低</div>
              <div className="snapshot-value" style={{ color: selectedStage.min_treasury < 0 ? "#ef4444" : "#22c55e" }}>
                ${fmt(selectedStage.min_treasury, 0)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">压力指数 <Tooltip text={TOOLTIPS.pressure} /></div>
              <div className="snapshot-value" style={{ color: PRESSURE_COLORS[selectedStage.pressure_label] }}>
                {selectedStage.pressure_score.toFixed(1)} ({selectedStage.pressure_label})
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">增长 KPI <Tooltip text={TOOLTIPS.growth} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.growth_kpi === "PASS" ? "#22c55e" : "#ef4444" }}>
                {selectedStage.growth_kpi}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">支付可持续性 <Tooltip text={TOOLTIPS.sustainability} /></div>
              <div className="snapshot-value" style={{ color: SUST_COLORS[selectedStage.sustainability_label] }}>
                {selectedStage.sustainability_label} ({pct(selectedStage.payout_ratio)})
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">流动性 <Tooltip text={TOOLTIPS.liquidity} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.liquidity_label === "PASS" ? "#22c55e" : "#ef4444" }}>
                {selectedStage.liquidity_label}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">累计回购 MX</div>
              <div className="snapshot-value" style={{ color: "#06b6d4" }}>{fmt(selectedStage.total_ar_buyback, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">累计 MX 销毁</div>
              <div className="snapshot-value" style={{ color: "#f97316" }}>{fmt(selectedStage.total_mx_burned, 0)}</div>
            </div>
          </div>

          <div className="snapshot-recommendation">
            <strong>建议：</strong>{selectedStage.recommendation}
          </div>
        </div>
      )}

      {/* Quick Stage Overview Table */}
      {stages.length > 0 && (
        <div className="stage-quick-table">
          <h3>阶段概览</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>节点</th>
                  <th>价格</th>
                  <th>LP USDC</th>
                  <th>国库</th>
                  <th>压力</th>
                  <th>增长</th>
                  <th>可持续</th>
                  <th>流动性</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.day} className={selectedDay === s.day ? "row-highlight" : ""} onClick={() => setSelectedDay(s.day)} style={{ cursor: "pointer" }}>
                    <td>{s.day}</td>
                    <td>{s.junior_cum + s.senior_cum}</td>
                    <td>${fmt(s.price, 4)}</td>
                    <td>${fmt(s.lp_usdc, 0)}</td>
                    <td>${fmt(s.treasury, 0)}</td>
                    <td>
                      <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
                        {s.pressure_label}
                      </span>
                    </td>
                    <td style={{ color: s.growth_kpi === "PASS" ? "#22c55e" : "#ef4444" }}>{s.growth_kpi}</td>
                    <td style={{ color: SUST_COLORS[s.sustainability_label] }}>{s.sustainability_label}</td>
                    <td style={{ color: s.liquidity_label === "PASS" ? "#22c55e" : "#ef4444" }}>{s.liquidity_label}</td>
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
