import React from "react"
import type { ModelParams } from "../config/types"
import type { DailyRow } from "../engine/simulate"

interface Props {
  rows: DailyRow[]
  config: ModelParams
}

function usd(n: number, dec = 2): string {
  return "$" + n.toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function pct(n: number, dec = 2): string {
  return (n * 100).toFixed(dec) + "%"
}
function num(n: number, dec = 0): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

type Level = "safe" | "warn" | "danger"

function levelColor(level: Level): string {
  if (level === "safe") return "var(--success)"
  if (level === "warn") return "var(--warning)"
  return "var(--danger)"
}
function levelBg(level: Level): string {
  if (level === "safe") return "rgba(34,197,94,0.1)"
  if (level === "warn") return "rgba(245,158,11,0.1)"
  return "rgba(239,68,68,0.1)"
}
function levelLabel(level: Level): string {
  if (level === "safe") return "健康"
  if (level === "warn") return "需关注"
  return "高风险"
}

const Badge: React.FC<{ level: Level }> = ({ level }) => (
  <span style={{
    padding: "3px 12px", borderRadius: 14, fontSize: "0.82rem", fontWeight: 700,
    color: levelColor(level), background: levelBg(level),
    border: `1px solid ${levelColor(level)}`,
  }}>{levelLabel(level)}</span>
)

export const ReportTab: React.FC<Props> = ({ rows, config }) => {
  if (rows.length === 0) {
    return <div className="overview-empty">请先运行模拟，再查看报告。</div>
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const totalDays = last.day
  const totalMonths = Math.ceil(totalDays / 30)

  const priceStart = config.price_token
  const priceEnd = last.price_end
  const priceChange = priceStart > 0 ? priceEnd / priceStart - 1 : 0

  const minTreasury = Math.min(...rows.map(r => r.treasury_end))
  const maxTreasury = Math.max(...rows.map(r => r.treasury_end))
  const totalPayouts = rows.reduce((s, r) => s + r.node_payout_usdc_capped, 0)
  const totalMxEmitted = last.total_mx_emitted
  const totalMxDeferred = last.total_mx_deferred
  const totalMxSold = last.total_mx_sold
  const totalMxBurned = last.total_mx_burned
  const totalMxBuyback = last.total_mx_buyback
  const totalMxRedemptions = last.total_mx_redemptions
  const totalInflow = rows.reduce((s, r) => s + r.treasury_inflow, 0)
  const totalOutflow = rows.reduce((s, r) => s + r.treasury_outflow, 0)
  const maxSoldOverLp = Math.max(...rows.map(r => r.sold_over_lp))
  const avgDailyPayout = totalPayouts / totalDays
  const totalReferral = last.total_referral_payout

  // Treasury net = inflow - outflow
  const treasuryNetFlow = totalInflow - totalOutflow

  // Redemption ratio (how much of released MX is redeemed by treasury vs sold to LP)
  const totalReleasedMx = rows.reduce((s, r) => s + r.released_mx_today, 0)
  const actualRedemptionRatio = totalReleasedMx > 0 ? totalMxRedemptions / totalReleasedMx : 0
  const actualSoldRatio = totalReleasedMx > 0 ? totalMxSold / totalReleasedMx : 0

  // Payout to principal ratio (sustainability)
  const totalPrincipal = rows.reduce((s, r) => s + r.junior_new * config.junior_invest_usdc + r.senior_new * config.senior_invest_usdc, 0)
  const payoutToPrincipal = totalPrincipal > 0 ? totalPayouts / totalPrincipal : 0

  // Peak price & max drawdown
  let peakPrice = priceStart
  let maxDrawdown = 0
  for (const r of rows) {
    if (r.price_end > peakPrice) peakPrice = r.price_end
    const dd = peakPrice > 0 ? (peakPrice - r.price_end) / peakPrice : 0
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  // Has treasury redemption? (核心机制，不再受 treasury_defense_enabled 门控)
  const hasRedemption = config.treasury_redemption_ratio > 0
  // Has buyback?
  const hasBuyback = config.treasury_defense_enabled && config.treasury_buyback_ratio > 0
  // Has MX burn gate?
  const hasBurnGate = config.mx_burn_per_withdraw_ratio > 0

  // Risk levels
  const priceRisk: Level = priceChange > -0.1 ? "safe" : priceChange > -0.5 ? "warn" : "danger"
  const treasuryRisk: Level = last.treasury_end > config.treasury_start_usdc * 0.5 ? "safe"
    : last.treasury_end > 0 ? "warn" : "danger"
  // Sustainability: payout / principal ratio
  const sustainRisk: Level = payoutToPrincipal < 0.6 ? "safe" : payoutToPrincipal < 1.0 ? "warn" : "danger"
  // LP residual pressure (only what actually hits LP after redemption)
  const lpPressureRisk: Level = maxSoldOverLp < 0.03 ? "safe" : maxSoldOverLp < 0.10 ? "warn" : "danger"

  // Worst day
  let worstDay = rows[0]
  for (const r of rows) {
    if (r.price_change < worstDay.price_change) worstDay = r
  }

  // Monthly snapshots
  const monthlySnapshots: DailyRow[] = []
  for (let m = 1; m <= totalMonths; m++) {
    const dayIdx = Math.min(m * 30, totalDays) - 1
    if (dayIdx >= 0 && dayIdx < rows.length) monthlySnapshots.push(rows[dayIdx])
  }

  // Styles
  const sectionStyle: React.CSSProperties = { marginBottom: 28 }
  const h3Style: React.CSSProperties = {
    fontSize: "1.1rem", color: "var(--accent)", margin: "0 0 8px 0",
    paddingBottom: 6, borderBottom: "1px solid var(--border)",
  }
  const descStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.88rem", margin: "0 0 16px 0" }
  const cardGrid: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12,
  }
  const infoCard: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 14, boxShadow: "var(--shadow-card)",
  }
  const infoTitle: React.CSSProperties = {
    fontSize: "0.88rem", fontWeight: 700, color: "var(--accent)", marginBottom: 10,
  }
  const miniTd: React.CSSProperties = { padding: "3px 0", border: "none", textAlign: "left" as const, fontSize: "0.82rem" }
  const miniTdLabel: React.CSSProperties = { ...miniTd, color: "var(--text-muted)", width: "55%" }
  const miniTdValue: React.CSSProperties = { ...miniTd, color: "var(--text-primary)", fontWeight: 600, textAlign: "right" as const }

  const resultGrid: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12,
  }
  const resultCard: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 16, boxShadow: "var(--shadow-card)",
  }
  const resultLabel: React.CSSProperties = { fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 6 }
  const resultValue: React.CSSProperties = { fontSize: "1.2rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" as const }
  const resultSub: React.CSSProperties = { fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }

  const flowBoxStyle: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 8, fontSize: "0.85rem",
    textAlign: "center" as const, fontWeight: 600, minWidth: 100,
  }
  const arrowStyle: React.CSSProperties = {
    color: "var(--text-muted)", fontSize: "1.2rem", padding: "0 4px",
    display: "flex", alignItems: "center",
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: 24, paddingBottom: 14, borderBottom: "2px solid var(--border)" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--accent)" }}>
          CoinMax 经济模型模拟报告
        </h2>
        <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          模拟周期：{totalDays} 天（约 {totalMonths} 个月）
          {last.vault_open && <> | 金库已开启</>}
        </p>
      </div>

      {/* Section 1: Parameters */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>一、模型参数概览</h3>
        <p style={descStyle}>本次模拟使用的核心参数设定：</p>
        <div style={cardGrid}>
          <div style={infoCard}>
            <div style={infoTitle}>初级节点 (Junior)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>初始投入</td><td style={miniTdValue}>{usd(config.junior_invest_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>套餐金额</td><td style={miniTdValue}>{usd(config.junior_package_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>日收益率</td><td style={miniTdValue}>{pct(config.junior_daily_rate)}</td></tr>
              <tr><td style={miniTdLabel}>每月新增</td><td style={miniTdValue}>{num(config.junior_monthly_new)} 个</td></tr>
              <tr><td style={miniTdLabel}>节点上限</td><td style={miniTdValue}>{num(config.junior_max_nodes)} 个</td></tr>
            </tbody></table>
          </div>
          <div style={infoCard}>
            <div style={infoTitle}>高级节点 (Senior)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>初始投入</td><td style={miniTdValue}>{usd(config.senior_invest_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>套餐金额</td><td style={miniTdValue}>{usd(config.senior_package_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>日收益率</td><td style={miniTdValue}>{pct(config.senior_daily_rate)}</td></tr>
              <tr><td style={miniTdLabel}>每月新增</td><td style={miniTdValue}>{num(config.senior_monthly_new)} 个</td></tr>
              <tr><td style={miniTdLabel}>节点上限</td><td style={miniTdValue}>{num(config.senior_max_nodes)} 个</td></tr>
            </tbody></table>
          </div>
          <div style={infoCard}>
            <div style={infoTitle}>MX 释放机制</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>线性释放天数</td><td style={miniTdValue}>{config.linear_release_days} 天</td></tr>
              <tr><td style={miniTdLabel}>即时释放比例</td><td style={miniTdValue}>{pct(first.instant_release_ratio)}</td></tr>
              <tr><td style={miniTdLabel}>延迟释放比例</td><td style={miniTdValue}>{pct(first.burn_rate)}</td></tr>
              <tr><td style={miniTdLabel}>提前释放回购比例</td><td style={miniTdValue}>{pct(config.mx_burn_per_withdraw_ratio)}</td></tr>
              <tr><td style={miniTdLabel}>销毁来源</td><td style={miniTdValue}>{config.mx_burn_from === "user" ? "用户" : "国库"}</td></tr>
            </tbody></table>
          </div>
          <div style={infoCard}>
            <div style={infoTitle}>国库与防御</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>初始国库</td><td style={miniTdValue}>{usd(config.treasury_start_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>国库防御</td><td style={miniTdValue}>{config.treasury_defense_enabled ? "已启用" : "未启用"}</td></tr>
              {hasRedemption && <tr><td style={miniTdLabel}>金库兑付比例（核心）</td><td style={miniTdValue}>{pct(config.treasury_redemption_ratio)}</td></tr>}
              {hasBuyback && <tr><td style={miniTdLabel}>回购比例</td><td style={miniTdValue}>{pct(config.treasury_buyback_ratio)}</td></tr>}
              <tr><td style={miniTdLabel}>外部月收入</td><td style={miniTdValue}>{usd(config.external_profit_monthly)}</td></tr>
            </tbody></table>
          </div>
        </div>
      </section>

      {/* Section 2: MX Flow Diagram */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>二、MX 代币流转机制</h3>
        <p style={descStyle}>
          每日利息以MX代币形式释放，经过以下环节后决定最终流向：
        </p>

        {/* Flow diagram */}
        <div style={{
          ...infoCard, padding: 20,
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{ ...flowBoxStyle, background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
            里程碑派息<br/><span style={{ fontSize: "0.75rem", fontWeight: 400 }}>USDC → MX</span>
          </div>
          <div style={arrowStyle}>→</div>
          <div style={{ ...flowBoxStyle, background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
            释放分配<br/>
            <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
              即时 {pct(first.instant_release_ratio)} + 线性 {pct(first.burn_rate)}
            </span>
          </div>
          <div style={arrowStyle}>→</div>
          {hasBurnGate && (<>
            <div style={{ ...flowBoxStyle, background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>
              提前释放→LP回购<br/>
              <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
                {pct(config.mx_burn_per_withdraw_ratio)} USDC→LP池→MX销毁
              </span>
            </div>
            <div style={arrowStyle}>→</div>
          </>)}
          {hasRedemption && (<>
            <div style={{ ...flowBoxStyle, background: "rgba(34,197,94,0.12)", color: "var(--success)" }}>
              金库兑付<br/>
              <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
                {pct(config.treasury_redemption_ratio)} 直接兑付
              </span>
            </div>
            <div style={arrowStyle}>→</div>
          </>)}
          <div style={{ ...flowBoxStyle, background: "rgba(99,102,241,0.08)", color: "var(--text-secondary)" }}>
            剩余进入市场<br/>
            <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>
              × {pct(config.sell_pressure_ratio)} 卖压比
            </span>
          </div>
          <div style={arrowStyle}>→</div>
          <div style={{ ...flowBoxStyle, background: "rgba(139,139,255,0.1)", color: "var(--text-primary)" }}>
            LP 池交易
          </div>
          {hasBuyback && (<>
            <div style={arrowStyle}>←</div>
            <div style={{ ...flowBoxStyle, background: "rgba(34,197,94,0.12)", color: "var(--success)" }}>
              国库回购<br/>
              <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>支撑价格</span>
            </div>
          </>)}
        </div>

        {/* Key explanation */}
        <div style={{ ...infoCard, marginTop: 12, padding: "14px 18px", lineHeight: 1.8, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong style={{ color: "var(--text-primary)" }}>提前释放回购</strong>：
            用户缩短线性释放时间时，利润自动通过LP池进行CPMM回购（USDC进池、MX出池销毁），
            此操作<strong>支撑MX价格</strong>。回购比例为 <strong>{pct(config.mx_burn_per_withdraw_ratio)}</strong>。
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            <strong style={{ color: "var(--text-primary)" }}>金库兑付</strong>：
            {hasRedemption
              ? `当前设定 ${pct(config.treasury_redemption_ratio)} 的释放MX由金库直接兑付（不走LP池，不影响价格），有效减少市场卖压。`
              : "当前未启用金库兑付。所有释放MX经卖压比例后进入LP池交易。"
            }
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--text-primary)" }}>实际卖入LP的MX</strong>：
            发行 {num(totalMxEmitted, 2)} →
            金库兑付 {num(totalMxRedemptions, 2)}（{pct(actualRedemptionRatio)}） →
            实际卖出 {num(totalMxSold, 2)}（{pct(actualSoldRatio)}）
            {hasBuyback && <> → 国库回购 {num(totalMxBuyback, 2)}</>}
          </p>
        </div>
      </section>

      {/* Section 3: Core Results */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>三、核心模拟结果</h3>
        <p style={descStyle}>经过 {totalDays} 天模拟运行的关键数据：</p>
        <div style={resultGrid}>
          <div style={{ ...resultCard, borderColor: "var(--accent)", background: "rgba(99,102,241,0.06)" }}>
            <div style={resultLabel}>MX 代币价格</div>
            <div style={resultValue}>{usd(priceStart, 4)} → {usd(priceEnd, 6)}</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: 4,
              color: priceChange >= 0 ? "var(--success)" : "var(--danger)" }}>
              {priceChange >= 0 ? "+" : ""}{pct(priceChange, 4)}
            </div>
          </div>
          <div style={resultCard}>
            <div style={resultLabel}>国库余额</div>
            <div style={resultValue}>{usd(last.treasury_end)}</div>
            <div style={resultSub}>最低：{usd(minTreasury)} / 最高：{usd(maxTreasury)}</div>
          </div>
          <div style={resultCard}>
            <div style={resultLabel}>累计节点派息</div>
            <div style={resultValue}>{usd(totalPayouts)}</div>
            <div style={resultSub}>日均：{usd(avgDailyPayout)}</div>
          </div>
          <div style={resultCard}>
            <div style={resultLabel}>节点规模</div>
            <div style={resultValue}>{num(last.junior_cum + last.senior_cum)} 个</div>
            <div style={resultSub}>初级 {num(last.junior_cum)} / 高级 {num(last.senior_cum)}</div>
          </div>
          <div style={resultCard}>
            <div style={resultLabel}>MX 代币概况</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.7 }}>
              <div>发行：<strong>{num(totalMxEmitted, 2)}</strong></div>
              <div>金库兑付：<strong style={{ color: "var(--success)" }}>{num(totalMxRedemptions, 2)}</strong></div>
              <div>延迟释放中：<strong>{num(totalMxDeferred, 2)}</strong></div>
              <div>实际卖出：<strong style={{ color: "var(--danger)" }}>{num(totalMxSold, 2)}</strong></div>
              {totalMxBuyback > 0 && <div>国库回购：<strong style={{ color: "var(--success)" }}>{num(totalMxBuyback, 2)}</strong></div>}
              {totalMxBurned > 0 && <div>提前释放回购销毁：<strong style={{ color: "var(--warning)" }}>{num(totalMxBurned, 2)}</strong></div>}
            </div>
          </div>
          <div style={resultCard}>
            <div style={resultLabel}>LP 池最终状态</div>
            <div style={resultValue}>{usd(last.lp_usdc_end)}</div>
            <div style={resultSub}>MX：{num(last.lp_token_end, 2)}</div>
          </div>
          {totalReferral > 0 && (
            <div style={resultCard}>
              <div style={resultLabel}>累计推荐奖金</div>
              <div style={resultValue}>{usd(totalReferral)}</div>
            </div>
          )}
          {last.vault_open && (
            <div style={resultCard}>
              <div style={resultLabel}>金库质押</div>
              <div style={resultValue}>{usd(last.vault_total_staked_usdc)}</div>
              <div style={resultSub}>质押人数：{num(last.vault_stakers)}</div>
            </div>
          )}
        </div>
      </section>

      {/* Section 4: Monthly Trend */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>四、月度趋势一览</h3>
        <p style={descStyle}>每月末关键指标变化：</p>
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>月份</th>
                <th>MX价格</th>
                <th>月变化</th>
                <th>总节点</th>
                <th>国库余额</th>
                <th>金库兑付MX</th>
                <th>实际卖出MX</th>
                {monthlySnapshots.some(r => r.vault_open) && <th>金库质押</th>}
              </tr>
            </thead>
            <tbody>
              {monthlySnapshots.map((r, i) => {
                const prevP = i === 0 ? priceStart : monthlySnapshots[i - 1].price_end
                const mc = prevP > 0 ? r.price_end / prevP - 1 : 0
                return (
                  <tr key={r.day}>
                    <td style={{ textAlign: "left", fontWeight: 600 }}>第 {i + 1} 月</td>
                    <td>{usd(r.price_end, 6)}</td>
                    <td style={{ color: mc >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {mc >= 0 ? "+" : ""}{pct(mc)}
                    </td>
                    <td>{num(r.junior_cum + r.senior_cum)}</td>
                    <td>{usd(r.treasury_end)}</td>
                    <td>{num(r.total_mx_redemptions, 2)}</td>
                    <td>{num(r.total_mx_sold, 2)}</td>
                    {monthlySnapshots.some(x => x.vault_open) && (
                      <td>{r.vault_open ? usd(r.vault_total_staked_usdc) : "—"}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Risk Assessment */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>五、风险评估</h3>
        <p style={descStyle}>根据模拟结果，对系统可持续性进行评估：</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Treasury Health */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>国库兑付能力</span>
              <Badge level={treasuryRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {treasuryRisk === "safe" && `国库余额 ${usd(last.treasury_end)}，保持在起始资金 50% 以上，兑付能力充足。`}
              {treasuryRisk === "warn" && `国库余额 ${usd(last.treasury_end)}，有所下降但仍可兑付，需关注长期流出趋势。`}
              {treasuryRisk === "danger" && `国库已耗尽或接近耗尽，无法继续兑付MX，系统面临停摆风险。`}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              总流入：{usd(totalInflow)} / 总流出：{usd(totalOutflow)} / 净值：
              <span style={{ color: treasuryNetFlow >= 0 ? "var(--success)" : "var(--danger)" }}>
                {treasuryNetFlow >= 0 ? "+" : ""}{usd(treasuryNetFlow)}
              </span>
            </div>
          </div>

          {/* Sustainability */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>派息可持续性</span>
              <Badge level={sustainRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              支付比率 = 累计派息 / 累计本金流入 = <strong>{pct(payoutToPrincipal)}</strong>。
              {sustainRisk === "safe" && " 低于 60%，系统有足够的本金覆盖派息支出。"}
              {sustainRisk === "warn" && " 接近 100%，派息支出与本金流入持平，长期需要外部收入支撑。"}
              {sustainRisk === "danger" && " 超过 100%，派息支出已超出本金流入，系统不可持续。"}
            </div>
          </div>

          {/* Price Stability */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>MX 价格表现</span>
              <Badge level={priceRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              价格变动 <strong>{priceChange >= 0 ? "+" : ""}{pct(priceChange)}</strong>，最大回撤 <strong>{pct(maxDrawdown)}</strong>。
              {hasRedemption
                ? ` 金库兑付了 ${pct(actualRedemptionRatio)} 的MX（不走LP池），提前释放回购通过CPMM支撑价格，实际流入LP池的卖压有限（卖出/LP最高 ${pct(maxSoldOverLp, 4)}）。`
                : ` 释放的MX经卖压比例 ${pct(config.sell_pressure_ratio)} 后进入LP池交易，提前释放回购通过CPMM支撑价格。`
              }
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              最大单日跌幅：第 {worstDay.day} 天 {pct(Math.abs(worstDay.price_change), 4)}
            </div>
          </div>

          {/* LP residual pressure */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>LP池残余卖压</span>
              <Badge level={lpPressureRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {hasRedemption
                ? `金库兑付后，仅剩余 ${pct(actualSoldRatio)} 的MX实际卖入LP池。`
                : "未启用金库兑付，所有释放MX按卖压比例进入LP池。"
              }
              最大卖出/LP比为 <strong>{pct(maxSoldOverLp, 4)}</strong>
              {lpPressureRisk === "safe" && "，LP池足以承受。"}
              {lpPressureRisk === "warn" && "，对价格产生一定冲击。"}
              {lpPressureRisk === "danger" && "，对LP池冲击较大，价格承压明显。"}
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Adjustment Guide */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>六、参数调节指南</h3>
        <p style={descStyle}>以下参数对结果影响最大，可重点关注：</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {[
            {
              title: "金库兑付比例",
              current: hasRedemption ? pct(config.treasury_redemption_ratio) : "未启用",
              desc: "金库兑付是核心兑付机制——释放的MX由金库直接承兑，不进入LP池。提高此比例可大幅减少LP卖压，但会增加国库支出。",
            },
            {
              title: "线性释放天数",
              current: `${config.linear_release_days} 天`,
              desc: `MX利息按 ${config.linear_release_days} 天线性释放。用户如需提前释放，利润自动走LP池CPMM回购MX并销毁。更长的释放天数可平滑释放峰值。`,
            },
            {
              title: "提前释放回购比例",
              current: pct(config.mx_burn_per_withdraw_ratio),
              desc: "用户提前释放时，利润自动通过LP池进行CPMM回购（USDC进池、MX出池销毁）。此操作既减少MX流通量，又直接支撑MX价格。",
            },
            {
              title: "国库回购比例",
              current: hasBuyback ? pct(config.treasury_buyback_ratio) : "未启用",
              desc: "国库使用日流入资金的一定比例在LP池中回购MX，直接支撑价格。回购在触发条件满足时自动加倍。",
            },
            {
              title: "节点增长速度",
              current: `初级 ${num(config.junior_monthly_new)}/月 | 高级 ${num(config.senior_monthly_new)}/月`,
              desc: "节点增速决定国库的本金流入速度。增速过快时未来派息承诺增大，增速过慢则国库流入不足以覆盖兑付。",
            },
            {
              title: "日收益率",
              current: `初级 ${pct(config.junior_daily_rate)} | 高级 ${pct(config.senior_daily_rate)}`,
              desc: "直接决定里程碑派息金额和对应的MX释放量。降低收益率可减少兑付压力，但会降低对节点持有者的吸引力。",
            },
          ].map((item) => (
            <div key={item.title} style={infoCard}>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--accent-hover)", marginBottom: 8 }}>
                当前：{item.current}
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 7: Summary */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>七、总结</h3>
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: 20, fontSize: "0.92rem",
          lineHeight: 1.8, color: "var(--text-secondary)", boxShadow: "var(--shadow-card)",
        }}>
          <p style={{ marginBottom: 12 }}>
            本次模拟在 <strong style={{ color: "var(--text-primary)" }}>{totalDays} 天</strong> 周期内，
            系统共新增 <strong style={{ color: "var(--text-primary)" }}>{num(last.junior_cum + last.senior_cum)}</strong> 个节点，
            累计派发 <strong style={{ color: "var(--text-primary)" }}>{usd(totalPayouts)}</strong> 的收益。
          </p>
          <p style={{ marginBottom: 12 }}>
            共发行 <strong style={{ color: "var(--text-primary)" }}>{num(totalMxEmitted, 2)}</strong> MX，
            其中金库直接兑付 <strong style={{ color: "var(--success)" }}>{num(totalMxRedemptions, 2)}</strong>（{pct(actualRedemptionRatio)}），
            实际卖入LP池 <strong style={{ color: "var(--danger)" }}>{num(totalMxSold, 2)}</strong>（{pct(actualSoldRatio)}）
            {totalMxBurned > 0 && <>，销毁 <strong style={{ color: "var(--warning)" }}>{num(totalMxBurned, 2)}</strong></>}
            {totalMxBuyback > 0 && <>，国库回购 <strong style={{ color: "var(--success)" }}>{num(totalMxBuyback, 2)}</strong></>}。
          </p>
          <p style={{ marginBottom: 12 }}>
            MX价格 {usd(priceStart)} → <strong style={{ color: "var(--text-primary)" }}>{usd(priceEnd, 6)}</strong>
            （{priceChange >= 0 ? "+" : ""}{pct(priceChange)}），
            国库最终 <strong style={{ color: "var(--text-primary)" }}>{usd(last.treasury_end)}</strong>（净{treasuryNetFlow >= 0 ? "流入" : "流出"} {usd(Math.abs(treasuryNetFlow))}）。
          </p>
          {(treasuryRisk === "danger" || sustainRisk === "danger") ? (
            <p style={{
              color: "var(--danger)", background: "rgba(239,68,68,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", margin: 0,
            }}>
              当前参数下国库兑付压力过大或派息不可持续。建议：提高金库兑付比例以减少LP卖压、降低日收益率以减少MX释放量、或增加外部收入来源。
            </p>
          ) : (treasuryRisk === "warn" || sustainRisk === "warn" || priceRisk === "warn") ? (
            <p style={{
              color: "var(--warning)", background: "rgba(245,158,11,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)", margin: 0,
            }}>
              系统整体可运行，但部分指标接近临界值。建议通过小幅调节金库兑付、MX销毁或节点增速来优化表现。
            </p>
          ) : (
            <p style={{
              color: "var(--success)", background: "rgba(34,197,94,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)", margin: 0,
            }}>
              当前参数下系统运行健康，国库兑付能力充足，各项指标在安全范围内。
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
