import React, { useMemo, useState, useEffect } from "react"
import type { DailyRow } from "../engine/simulate"
import type { ModelParams, PressureTargets, GrowthTargets, StageCheckpoint } from "../config/types"
import { computeStageReport, pressureTargetsFromConfig, growthTargetsFromConfig } from "../engine/stageReport"
import { exportStageCSV } from "../utils/csv"

interface Props {
  rows: DailyRow[]
  config: ModelParams
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d })
}
function pct(n: number): string { return (n * 100).toFixed(1) + "%" }

const PRESSURE_COLORS: Record<string, string> = {
  SAFE: "#22c55e", WATCH: "#f59e0b", RISK: "#f97316", DANGER: "#ef4444",
}
const SUST_COLORS: Record<string, string> = {
  HEALTHY: "#22c55e", TIGHT: "#f59e0b", UNSUSTAINABLE: "#ef4444",
}
const PRESSURE_LABELS_CN: Record<string, string> = {
  SAFE: "安全", WATCH: "关注", RISK: "风险", DANGER: "危险",
}
const SUST_LABELS_CN: Record<string, string> = {
  HEALTHY: "健康", TIGHT: "趋紧", UNSUSTAINABLE: "不可持续",
}
const KPI_LABELS_CN: Record<string, string> = {
  PASS: "达标", FAIL: "未达标", "N/A": "N/A",
}

function completionColor(ratio: number): string {
  if (ratio >= 1) return "#22c55e"
  if (ratio >= 0.8) return "#f59e0b"
  return "#ef4444"
}

function CompletionBar({ ratio, label }: { ratio: number; label: string }) {
  const w = Math.min(ratio * 100, 100)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
      <div style={{ flex: 1, background: "#333", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, background: completionColor(ratio), height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, color: completionColor(ratio), whiteSpace: "nowrap" }}>{label}</span>
    </div>
  )
}

function KpiTag({ status, label }: { status: string; label: string }) {
  const color = status === "PASS" ? "#22c55e" : status === "FAIL" ? "#ef4444" : "#666"
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: color + "22", color }}>
      {label}
    </span>
  )
}

export const StageReportTab: React.FC<Props> = ({ rows, config }) => {
  const [pressureTargets, setPressureTargets] = useState<PressureTargets>(() => pressureTargetsFromConfig(config))
  const [growthTargets, setGrowthTargets] = useState<GrowthTargets>(() => growthTargetsFromConfig(config))
  const [minLpThreshold, setMinLpThreshold] = useState(() => config.target_min_lp_usdc ?? 20000)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    setPressureTargets(pressureTargetsFromConfig(config))
    setGrowthTargets(growthTargetsFromConfig(config))
    setMinLpThreshold(config.target_min_lp_usdc ?? 20000)
  }, [config.target_sold_over_lp, config.target_drawdown, config.target_treasury_stress, config.target_junior_90, config.target_senior_90, config.target_min_lp_usdc])

  const stages = useMemo(
    () => computeStageReport(rows, config, pressureTargets, growthTargets, minLpThreshold),
    [rows, config, pressureTargets, growthTargets, minLpThreshold],
  )

  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  return (
    <div className="stage-report-container">
      <div className="stage-report-header">
        <h2>市场业绩 KPI 报告</h2>
        <div className="stage-report-actions">
          <button className="btn-xs" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? "隐藏设置" : "调整阈值"}
          </button>
          <button className="btn-sm" onClick={() => exportStageCSV(stages)}>导出完整报告</button>
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

      {/* ========== Section 1: Node Recruitment KPI ========== */}
      {stages.length > 0 && (
        <>
          <h3 style={{ margin: "16px 0 8px" }}>节点招募 KPI</h3>
          <div className="table-scroll">
            <table className="stage-table">
              <thead>
                <tr>
                  <th>天数</th>
                  <th>初级(实际)</th>
                  <th>初级(目标)</th>
                  <th>初级完成率</th>
                  <th>高级(实际)</th>
                  <th>高级(目标)</th>
                  <th>高级完成率</th>
                  <th>总节点</th>
                  <th>总目标</th>
                  <th>总完成率</th>
                  <th>日均招募</th>
                  <th>增长KPI</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.day}>
                    <td><strong>{s.day}</strong></td>
                    <td>{fmt(s.junior_cum, 0)}</td>
                    <td style={{ color: "#888" }}>{fmt(s.junior_target, 0)}</td>
                    <td><CompletionBar ratio={s.junior_completion} label={pct(s.junior_completion)} /></td>
                    <td>{fmt(s.senior_cum, 0)}</td>
                    <td style={{ color: "#888" }}>{fmt(s.senior_target, 0)}</td>
                    <td><CompletionBar ratio={s.senior_completion} label={pct(s.senior_completion)} /></td>
                    <td><strong>{fmt(s.junior_cum + s.senior_cum, 0)}</strong></td>
                    <td style={{ color: "#888" }}>{fmt(s.total_node_target, 0)}</td>
                    <td><CompletionBar ratio={s.total_node_completion} label={pct(s.total_node_completion)} /></td>
                    <td>{s.node_growth_velocity.toFixed(1)}/天</td>
                    <td><KpiTag status={s.growth_kpi} label={KPI_LABELS_CN[s.growth_kpi]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ========== Section 2: Staking Performance KPI ========== */}
          <h3 style={{ margin: "16px 0 8px" }}>质押业绩 KPI</h3>
          <div className="table-scroll">
            <table className="stage-table">
              <thead>
                <tr>
                  <th>天数</th>
                  <th>金库状态</th>
                  <th>质押用户</th>
                  <th>用户目标</th>
                  <th>用户完成率</th>
                  <th>质押金额</th>
                  <th>金额目标</th>
                  <th>金额完成率</th>
                  <th>储备金</th>
                  <th>平台收入</th>
                  <th>金库KPI</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.day}>
                    <td><strong>{s.day}</strong></td>
                    <td>{s.vault_open ? "已开启" : "未开启"}</td>
                    <td>{fmt(s.vault_stakers, 0)}</td>
                    <td style={{ color: "#888" }}>{fmt(s.vault_staker_target, 0)}</td>
                    <td>{s.vault_open ? <CompletionBar ratio={s.vault_staker_completion} label={pct(s.vault_staker_completion)} /> : "-"}</td>
                    <td>${fmt(s.vault_total_staked_usdc, 0)}</td>
                    <td style={{ color: "#888" }}>${fmt(s.vault_staked_target, 0)}</td>
                    <td>{s.vault_open ? <CompletionBar ratio={s.vault_staked_completion} label={pct(s.vault_staked_completion)} /> : "-"}</td>
                    <td style={{ color: "#8b5cf6" }}>${fmt(s.vault_reserve_usdc, 0)}</td>
                    <td>${fmt(s.vault_platform_income, 0)}</td>
                    <td><KpiTag status={s.vault_kpi} label={KPI_LABELS_CN[s.vault_kpi]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ========== Section 3: Market Cost & Pressure ========== */}
          <h3 style={{ margin: "16px 0 8px" }}>市场成本 & 系统压力</h3>
          <div className="table-scroll">
            <table className="stage-table">
              <thead>
                <tr>
                  <th>天数</th>
                  <th>本金流入</th>
                  <th>人均投资</th>
                  <th>推荐奖金</th>
                  <th>推荐成本占比</th>
                  <th>累计支付</th>
                  <th>支付率</th>
                  <th>可持续性</th>
                  <th>价格</th>
                  <th>最大回撤</th>
                  <th>最大卖压/LP</th>
                  <th>压力指数</th>
                  <th>压力等级</th>
                  <th>流动性</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.day}>
                    <td><strong>{s.day}</strong></td>
                    <td>${fmt(s.total_principal_inflow, 0)}</td>
                    <td>${fmt(s.avg_invest_per_node, 0)}</td>
                    <td style={{ color: "#ec4899" }}>${fmt(s.total_referral_payout, 0)}</td>
                    <td style={{ color: s.referral_cost_ratio > 0.05 ? "#f59e0b" : "#22c55e" }}>{pct(s.referral_cost_ratio)}</td>
                    <td>${fmt(s.total_payout_usdc, 0)}</td>
                    <td>{pct(s.payout_ratio)}</td>
                    <td style={{ color: SUST_COLORS[s.sustainability_label] }}>{SUST_LABELS_CN[s.sustainability_label]}</td>
                    <td>${fmt(s.price, 4)}</td>
                    <td style={{ color: s.max_drawdown > 0.3 ? "#ef4444" : "#22c55e" }}>{pct(s.max_drawdown)}</td>
                    <td style={{ color: s.max_sold_over_lp > 0.1 ? "#ef4444" : "#22c55e" }}>{pct(s.max_sold_over_lp)}</td>
                    <td>{s.pressure_score.toFixed(1)}</td>
                    <td>
                      <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
                        {PRESSURE_LABELS_CN[s.pressure_label]}
                      </span>
                    </td>
                    <td style={{ color: s.liquidity_label === "PASS" ? "#22c55e" : "#ef4444" }}>{KPI_LABELS_CN[s.liquidity_label]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========== Detail Cards ========== */}
      {stages.length > 0 && (
        <div className="stage-details-grid">
          {stages.map((s) => (
            <StageDetailCard key={s.day} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function StageDetailCard({ s }: { s: StageCheckpoint }) {
  return (
    <div className="stage-detail-card">
      <div className="stage-detail-header">
        <span className="stage-detail-day">第 {s.day} 天</span>
        <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
          {PRESSURE_LABELS_CN[s.pressure_label]} ({s.pressure_score.toFixed(0)})
        </span>
      </div>
      <div className="stage-detail-metrics">
        {/* Node recruitment */}
        <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 4, fontSize: 12, color: "#888" }}>节点招募</div>
        <div><span className="sdm-label">初级</span><span className="sdm-value">{fmt(s.junior_cum, 0)} / {fmt(s.junior_target, 0)}</span></div>
        <div><span className="sdm-label">初级完成率</span><span className="sdm-value" style={{ color: completionColor(s.junior_completion) }}>{pct(s.junior_completion)}</span></div>
        <div><span className="sdm-label">高级</span><span className="sdm-value">{fmt(s.senior_cum, 0)} / {fmt(s.senior_target, 0)}</span></div>
        <div><span className="sdm-label">高级完成率</span><span className="sdm-value" style={{ color: completionColor(s.senior_completion) }}>{pct(s.senior_completion)}</span></div>
        <div><span className="sdm-label">增长KPI</span><span className="sdm-value" style={{ color: s.growth_kpi === "PASS" ? "#22c55e" : "#ef4444" }}>{KPI_LABELS_CN[s.growth_kpi]}</span></div>
        <div><span className="sdm-label">日均招募</span><span className="sdm-value">{s.node_growth_velocity.toFixed(1)}/天</span></div>

        {/* Staking */}
        <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 4, marginTop: 4, fontSize: 12, color: "#888" }}>质押业绩</div>
        <div><span className="sdm-label">质押用户</span><span className="sdm-value">{fmt(s.vault_stakers, 0)} / {fmt(s.vault_staker_target, 0)}</span></div>
        <div><span className="sdm-label">用户完成率</span><span className="sdm-value" style={{ color: completionColor(s.vault_staker_completion) }}>{s.vault_open ? pct(s.vault_staker_completion) : "N/A"}</span></div>
        <div><span className="sdm-label">质押金额</span><span className="sdm-value">${fmt(s.vault_total_staked_usdc, 0)} / ${fmt(s.vault_staked_target, 0)}</span></div>
        <div><span className="sdm-label">金额完成率</span><span className="sdm-value" style={{ color: completionColor(s.vault_staked_completion) }}>{s.vault_open ? pct(s.vault_staked_completion) : "N/A"}</span></div>
        <div><span className="sdm-label">储备金</span><span className="sdm-value" style={{ color: "#8b5cf6" }}>${fmt(s.vault_reserve_usdc, 0)}</span></div>
        <div><span className="sdm-label">平台收入</span><span className="sdm-value">${fmt(s.vault_platform_income, 0)}</span></div>

        {/* Cost & pressure */}
        <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid #333", paddingBottom: 4, marginBottom: 4, marginTop: 4, fontSize: 12, color: "#888" }}>成本 & 压力</div>
        <div><span className="sdm-label">价格</span><span className="sdm-value">${fmt(s.price, 4)}</span></div>
        <div><span className="sdm-label">国库</span><span className="sdm-value">${fmt(s.treasury, 0)}</span></div>
        <div><span className="sdm-label">支付率</span><span className="sdm-value" style={{ color: SUST_COLORS[s.sustainability_label] }}>{pct(s.payout_ratio)}</span></div>
        <div><span className="sdm-label">推荐成本</span><span className="sdm-value" style={{ color: "#ec4899" }}>{pct(s.referral_cost_ratio)}</span></div>
        <div><span className="sdm-label">回购MX</span><span className="sdm-value">{fmt(s.total_mx_buyback, 0)}</span></div>
        <div><span className="sdm-label">MX销毁</span><span className="sdm-value">{fmt(s.total_mx_burned, 0)}</span></div>
      </div>
      <div className="stage-detail-rec">{s.recommendation}</div>
    </div>
  )
}
