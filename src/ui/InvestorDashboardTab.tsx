import React, { useState, useMemo } from "react"
import type { DailyRow } from "../engine/simulate"
import type { ModelParams } from "../config/types"
import { computeStageReport, STAGE_DAYS } from "../engine/stageReport"

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

const PRESSURE_LABELS_CN: Record<string, string> = {
  SAFE: "安全", WATCH: "关注", RISK: "风险", DANGER: "危险",
}
const SUST_LABELS_CN: Record<string, string> = {
  HEALTHY: "健康", TIGHT: "趋紧", UNSUSTAINABLE: "不可持续",
}
const KPI_LABELS_CN: Record<string, string> = {
  PASS: "达标", FAIL: "未达标", "N/A": "N/A",
}

const TOOLTIPS: Record<string, string> = {
  pressure: "压力指数(0-100)，综合衡量卖压/LP、价格回撤和国库压力，越低越安全。",
  growth: "增长KPI检查节点招募是否达到90天目标的80%线性插值。",
  sustainability: "支付比率 = 总支付 / 总本金流入。低于60%为健康，超过100%不可持续。",
  liquidity: "检查LP USDC余额是否保持在最低阈值（默认20,000）以上。",
  drawdown: "最大峰谷跌幅百分比，数值越低表示价格越稳定。",
  sold_over_lp: "日卖出USDC占LP USDC的最大比例，数值越高表示流动性压力越大。",
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

  const stages = useMemo(
    () => computeStageReport(rows, config),
    [rows, config],
  )

  if (rows.length === 0) return <div className="overview-empty">请先运行模拟</div>

  const last = rows[rows.length - 1]
  const totalNodes = last.junior_cum + last.senior_cum

  // Find the latest stage data for summary
  const latestStage = stages.length > 0 ? stages[stages.length - 1] : null

  // Top summary cards
  const growthStatus = latestStage?.growth_kpi === "PASS" ? "PASS" : "FAIL"
  const stabilityStatus = latestStage ? latestStage.pressure_label : "N/A"
  const cashflowStatus = latestStage ? latestStage.sustainability_label : "N/A"
  const vaultStatus = latestStage ? latestStage.vault_kpi : "N/A"

  const selectedStage = selectedDay ? stages.find((s) => s.day === selectedDay) : null

  return (
    <div className="investor-dashboard">
      {/* Top Summary Cards */}
      <div className="top-cards">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">增长</span>
            <span className="summary-badge" style={{ background: growthStatus === "PASS" ? "#22c55e22" : "#ef444422", color: growthStatus === "PASS" ? "#22c55e" : "#ef4444" }}>
              {KPI_LABELS_CN[growthStatus]}
            </span>
          </div>
          <div className="summary-card-value">{fmt(totalNodes, 0)} 节点</div>
          <div className="summary-card-sub">
            初级 {fmt(last.junior_cum, 0)} / 高级 {fmt(last.senior_cum, 0)}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">稳定性</span>
            <span className="summary-badge" style={{ background: (PRESSURE_COLORS[stabilityStatus] ?? "#666") + "22", color: PRESSURE_COLORS[stabilityStatus] ?? "#666" }}>
              {PRESSURE_LABELS_CN[stabilityStatus] ?? stabilityStatus}
            </span>
          </div>
          <div className="summary-card-value">${fmt(last.price_end, 6)}</div>
          <div className="summary-card-sub">
            回撤 {latestStage ? pct(latestStage.max_drawdown) : "N/A"} | 卖压/LP {latestStage ? pct(latestStage.max_sold_over_lp) : "N/A"}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">现金流</span>
            <span className="summary-badge" style={{ background: (SUST_COLORS[cashflowStatus] ?? "#666") + "22", color: SUST_COLORS[cashflowStatus] ?? "#666" }}>
              {SUST_LABELS_CN[cashflowStatus] ?? cashflowStatus}
            </span>
          </div>
          <div className="summary-card-value">${fmt(last.treasury_end, 0)}</div>
          <div className="summary-card-sub">
            支付率 {latestStage ? pct(latestStage.payout_ratio) : "N/A"} | LP ${fmt(last.lp_usdc_end, 0)}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-title">金库</span>
            <span className="summary-badge" style={{
              background: vaultStatus === "PASS" ? "#22c55e22" : vaultStatus === "FAIL" ? "#ef444422" : "#66666622",
              color: vaultStatus === "PASS" ? "#22c55e" : vaultStatus === "FAIL" ? "#ef4444" : "#666",
            }}>
              {last.vault_open ? KPI_LABELS_CN[vaultStatus] : "未开启"}
            </span>
          </div>
          <div className="summary-card-value">${fmt(last.vault_total_staked_usdc, 0)}</div>
          <div className="summary-card-sub">
            质押用户 {fmt(last.vault_stakers, 0)} | 平台收入 ${latestStage ? fmt(latestStage.vault_platform_income, 0) : "0"}
            {last.vault_open && <> | 可调用储备金 ${fmt(last.vault_reserve_usdc, 0)}</>}
          </div>
        </div>
      </div>

      {/* Stage Day Pills */}
      <div className="stage-pills-section">
        <h3>阶段里程碑</h3>
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
                <span className="stage-pill-day">第 {d} 天</span>
                {stage && (
                  <span className="stage-pill-label" style={{ color }}>
                    {PRESSURE_LABELS_CN[stage.pressure_label]}
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
          <h3>第 {selectedStage.day} 天快照</h3>
          <div className="snapshot-explanation">
            在第 {selectedStage.day} 天：节点 {fmt(selectedStage.junior_cum + selectedStage.senior_cum, 0)}/{fmt(selectedStage.total_node_target, 0)} (完成率 {pct(selectedStage.total_node_completion)})；
            代币价格 ${fmt(selectedStage.price, 6)}；
            国库 ${fmt(selectedStage.treasury, 0)}，支付率 {pct(selectedStage.payout_ratio)}；
            {selectedStage.vault_open
              ? <>质押用户 {fmt(selectedStage.vault_stakers, 0)} (完成率 {pct(selectedStage.vault_staker_completion)})，质押金额 ${fmt(selectedStage.vault_total_staked_usdc, 0)}。</>
              : <>金库尚未开启。</>
            }
          </div>

          {/* ---- 节点招募 KPI ---- */}
          <h4 className="snapshot-section-title">节点招募</h4>
          <div className="snapshot-grid">
            <div className="snapshot-item">
              <div className="snapshot-label">初级节点</div>
              <div className="snapshot-value">{fmt(selectedStage.junior_cum, 0)} / {fmt(selectedStage.junior_target, 0)}</div>
              <div className="snapshot-sub" style={{ color: selectedStage.junior_completion >= 0.8 ? "#22c55e" : "#f59e0b" }}>
                完成率 {pct(selectedStage.junior_completion)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">高级节点</div>
              <div className="snapshot-value">{fmt(selectedStage.senior_cum, 0)} / {fmt(selectedStage.senior_target, 0)}</div>
              <div className="snapshot-sub" style={{ color: selectedStage.senior_completion >= 0.8 ? "#22c55e" : "#f59e0b" }}>
                完成率 {pct(selectedStage.senior_completion)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">总节点完成率 <Tooltip text={TOOLTIPS.growth} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.growth_kpi === "PASS" ? "#22c55e" : "#ef4444" }}>
                {pct(selectedStage.total_node_completion)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">日均新增速度</div>
              <div className="snapshot-value">{fmt(selectedStage.node_growth_velocity, 1)} 人/天</div>
            </div>
          </div>

          {/* ---- 现金流 & 稳定性 ---- */}
          <h4 className="snapshot-section-title">现金流 & 稳定性</h4>
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
              <div className="snapshot-label">压力指数 <Tooltip text={TOOLTIPS.pressure} /></div>
              <div className="snapshot-value" style={{ color: PRESSURE_COLORS[selectedStage.pressure_label] }}>
                {selectedStage.pressure_score.toFixed(1)} ({PRESSURE_LABELS_CN[selectedStage.pressure_label]})
              </div>
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
              <div className="snapshot-label">LP USDC <Tooltip text={TOOLTIPS.liquidity} /></div>
              <div className="snapshot-value" style={{ color: selectedStage.liquidity_label === "PASS" ? "#22c55e" : "#ef4444" }}>
                ${fmt(selectedStage.lp_usdc, 0)}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">支付可持续性 <Tooltip text={TOOLTIPS.sustainability} /></div>
              <div className="snapshot-value" style={{ color: SUST_COLORS[selectedStage.sustainability_label] }}>
                {SUST_LABELS_CN[selectedStage.sustainability_label]} ({pct(selectedStage.payout_ratio)})
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">总本金流入</div>
              <div className="snapshot-value">${fmt(selectedStage.total_principal_inflow, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">总支付</div>
              <div className="snapshot-value">${fmt(selectedStage.total_payout_usdc, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">累计回购 MX</div>
              <div className="snapshot-value" style={{ color: "#06b6d4" }}>{fmt(selectedStage.total_mx_buyback, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">累计 MX 销毁</div>
              <div className="snapshot-value" style={{ color: "#f97316" }}>{fmt(selectedStage.total_mx_burned, 0)}</div>
            </div>
          </div>

          {/* ---- 金库质押 KPI ---- */}
          <h4 className="snapshot-section-title">金库质押</h4>
          <div className="snapshot-grid">
            <div className="snapshot-item">
              <div className="snapshot-label">金库状态</div>
              <div className="snapshot-value" style={{ color: selectedStage.vault_kpi === "PASS" ? "#22c55e" : selectedStage.vault_kpi === "FAIL" ? "#ef4444" : "#666" }}>
                {selectedStage.vault_open ? KPI_LABELS_CN[selectedStage.vault_kpi] : "未开启"}
              </div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">质押用户</div>
              <div className="snapshot-value">{fmt(selectedStage.vault_stakers, 0)} / {fmt(selectedStage.vault_staker_target, 0)}</div>
              {selectedStage.vault_open && (
                <div className="snapshot-sub" style={{ color: selectedStage.vault_staker_completion >= 1 ? "#22c55e" : "#f59e0b" }}>
                  完成率 {pct(selectedStage.vault_staker_completion)}
                </div>
              )}
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">质押金额</div>
              <div className="snapshot-value">${fmt(selectedStage.vault_total_staked_usdc, 0)}</div>
              {selectedStage.vault_open && (
                <div className="snapshot-sub" style={{ color: selectedStage.vault_staked_completion >= 1 ? "#22c55e" : "#f59e0b" }}>
                  目标 ${fmt(selectedStage.vault_staked_target, 0)} (完成率 {pct(selectedStage.vault_staked_completion)})
                </div>
              )}
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">平台收入</div>
              <div className="snapshot-value">${fmt(selectedStage.vault_platform_income, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">储备金</div>
              <div className="snapshot-value" style={{ color: "#8b5cf6" }}>${fmt(selectedStage.vault_reserve_usdc, 0)}</div>
            </div>
          </div>

          {/* ---- 市场成本 ---- */}
          <h4 className="snapshot-section-title">市场成本</h4>
          <div className="snapshot-grid">
            <div className="snapshot-item">
              <div className="snapshot-label">人均投入</div>
              <div className="snapshot-value">${fmt(selectedStage.avg_invest_per_node, 0)}</div>
            </div>
            <div className="snapshot-item">
              <div className="snapshot-label">推荐成本率</div>
              <div className="snapshot-value" style={{ color: selectedStage.referral_cost_ratio > 0.1 ? "#f59e0b" : "#22c55e" }}>
                {pct(selectedStage.referral_cost_ratio)}
              </div>
            </div>
            {selectedStage.total_referral_payout > 0 && (
              <div className="snapshot-item">
                <div className="snapshot-label">累计推荐奖金</div>
                <div className="snapshot-value" style={{ color: "#ec4899" }}>${fmt(selectedStage.total_referral_payout, 0)}</div>
              </div>
            )}
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
                  <th>天数</th>
                  <th>节点</th>
                  <th>节点完成率</th>
                  <th>价格</th>
                  <th>国库</th>
                  <th>支付率</th>
                  <th>压力</th>
                  <th>金库</th>
                  <th>质押完成率</th>
                  <th>质押金额</th>
                  <th>人均投入</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.day} className={selectedDay === s.day ? "row-highlight" : ""} onClick={() => setSelectedDay(s.day)} style={{ cursor: "pointer" }}>
                    <td>{s.day}</td>
                    <td>{s.junior_cum + s.senior_cum}</td>
                    <td style={{ color: s.total_node_completion >= 0.8 ? "#22c55e" : "#f59e0b" }}>{pct(s.total_node_completion)}</td>
                    <td>${fmt(s.price, 4)}</td>
                    <td>${fmt(s.treasury, 0)}</td>
                    <td style={{ color: SUST_COLORS[s.sustainability_label] }}>{pct(s.payout_ratio)}</td>
                    <td>
                      <span className="pressure-badge" style={{ background: PRESSURE_COLORS[s.pressure_label] + "22", color: PRESSURE_COLORS[s.pressure_label] }}>
                        {PRESSURE_LABELS_CN[s.pressure_label]}
                      </span>
                    </td>
                    <td style={{ color: s.vault_kpi === "PASS" ? "#22c55e" : s.vault_kpi === "FAIL" ? "#ef4444" : "#666" }}>{s.vault_open ? KPI_LABELS_CN[s.vault_kpi] : "未开启"}</td>
                    <td style={{ color: s.vault_staker_completion >= 1 ? "#22c55e" : "#f59e0b" }}>{s.vault_open ? pct(s.vault_staker_completion) : "-"}</td>
                    <td>${fmt(s.vault_total_staked_usdc, 0)}</td>
                    <td>${fmt(s.avg_invest_per_node, 0)}</td>
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
