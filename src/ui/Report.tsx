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
  const totalMxSold = last.total_mx_sold
  const totalMxBurned = last.total_mx_burned
  const totalMxBuyback = last.total_mx_buyback
  const totalMxRedemptions = last.total_mx_redemptions
  const totalInflow = rows.reduce((s, r) => s + r.treasury_inflow, 0)
  const totalOutflow = rows.reduce((s, r) => s + r.treasury_outflow, 0)
  const maxSoldOverLp = Math.max(...rows.map(r => r.sold_over_lp))
  const avgDailyPayout = totalPayouts / totalDays
  const totalReferral = last.total_referral_payout

  // Peak price & max drawdown
  let peakPrice = priceStart
  let maxDrawdown = 0
  for (const r of rows) {
    if (r.price_end > peakPrice) peakPrice = r.price_end
    const dd = peakPrice > 0 ? (peakPrice - r.price_end) / peakPrice : 0
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  // Risk levels
  const priceRisk: Level = priceChange > -0.1 ? "safe" : priceChange > -0.5 ? "warn" : "danger"
  const treasuryRisk: Level = last.treasury_end > config.treasury_start_usdc * 0.5 ? "safe"
    : last.treasury_end > 0 ? "warn" : "danger"
  const pressureRisk: Level = maxSoldOverLp < 0.05 ? "safe" : maxSoldOverLp < 0.15 ? "warn" : "danger"
  const drawdownRisk: Level = maxDrawdown < 0.15 ? "safe" : maxDrawdown < 0.4 ? "warn" : "danger"

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
            <div style={infoTitle}>市场与流动性池</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>初始MX价格</td><td style={miniTdValue}>{usd(config.price_token)}</td></tr>
              <tr><td style={miniTdLabel}>LP 池 USDC</td><td style={miniTdValue}>{usd(config.lp_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>LP 池 MX</td><td style={miniTdValue}>{num(config.lp_token)}</td></tr>
              <tr><td style={miniTdLabel}>交易手续费</td><td style={miniTdValue}>{pct(config.amm_fee_rate)}</td></tr>
              <tr><td style={miniTdLabel}>卖出压力比</td><td style={miniTdValue}>{pct(config.sell_pressure_ratio)}</td></tr>
            </tbody></table>
          </div>
          <div style={infoCard}>
            <div style={infoTitle}>国库与增长</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
              <tr><td style={miniTdLabel}>初始国库</td><td style={miniTdValue}>{usd(config.treasury_start_usdc)}</td></tr>
              <tr><td style={miniTdLabel}>增长模式</td><td style={miniTdValue}>{config.growth_mode === 1 ? "线性" : "指数"}</td></tr>
              <tr><td style={miniTdLabel}>外部月收入</td><td style={miniTdValue}>{usd(config.external_profit_monthly)}</td></tr>
              <tr><td style={miniTdLabel}>最大倍数</td><td style={miniTdValue}>{config.max_out_multiple}x</td></tr>
              <tr><td style={miniTdLabel}>销毁率</td><td style={miniTdValue}>{pct(first.burn_rate)}</td></tr>
            </tbody></table>
          </div>
        </div>
      </section>

      {/* Section 2: Core Results */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>二、核心模拟结果</h3>
        <p style={descStyle}>经过 {totalDays} 天模拟运行的关键数据：</p>
        <div style={resultGrid}>
          <div style={{ ...resultCard, borderColor: "var(--accent)", background: "rgba(99,102,241,0.06)" }}>
            <div style={resultLabel}>MX 代币价格走势</div>
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
            <div style={resultLabel}>MX 代币流向</div>
            <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
              <div>发行：<strong>{num(totalMxEmitted, 2)}</strong></div>
              <div>卖出：<strong>{num(totalMxSold, 2)}</strong></div>
              <div>回购：<strong style={{ color: "var(--success)" }}>{num(totalMxBuyback, 2)}</strong></div>
              <div>销毁：<strong style={{ color: "var(--warning)" }}>{num(totalMxBurned, 2)}</strong></div>
              <div>兑付：<strong>{num(totalMxRedemptions, 2)}</strong></div>
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

      {/* Section 3: Monthly Trend */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>三、月度趋势一览</h3>
        <p style={descStyle}>每月末关键指标变化：</p>
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>月份</th>
                <th>MX价格</th>
                <th>月变化</th>
                <th>总节点</th>
                <th>当日派息</th>
                <th>国库余额</th>
                <th>卖出/LP比</th>
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
                    <td>{usd(r.node_payout_usdc_capped)}</td>
                    <td>{usd(r.treasury_end)}</td>
                    <td>{pct(r.sold_over_lp, 4)}</td>
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

      {/* Section 4: Risk Assessment */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>四、风险评估</h3>
        <p style={descStyle}>根据模拟结果，对系统可持续性进行评估：</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Price Risk */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>MX 价格稳定性</span>
              <Badge level={priceRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {priceRisk === "safe" && `价格变动 ${pct(priceChange)}，市场卖压可控。`}
              {priceRisk === "warn" && `价格下跌 ${pct(Math.abs(priceChange))}，存在贬值压力。`}
              {priceRisk === "danger" && `价格大幅下跌 ${pct(Math.abs(priceChange))}，卖压过大需调整参数。`}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              最大回撤：{pct(maxDrawdown, 4)} | 最大单日跌幅：第 {worstDay.day} 天 {pct(Math.abs(worstDay.price_change), 4)}
            </div>
          </div>

          {/* Drawdown Risk */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>最大回撤 (Drawdown)</span>
              <Badge level={drawdownRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {drawdownRisk === "safe" && `最大回撤 ${pct(maxDrawdown, 4)}，价格波动在安全范围。`}
              {drawdownRisk === "warn" && `最大回撤 ${pct(maxDrawdown, 4)}，投资者体验承压，建议优化LP或降低卖压。`}
              {drawdownRisk === "danger" && `最大回撤 ${pct(maxDrawdown, 4)}，严重影响投资者信心，急需调整。`}
            </div>
          </div>

          {/* Treasury Risk */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>国库健康度</span>
              <Badge level={treasuryRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {treasuryRisk === "safe" && `国库余额保持在起始资金 50% 以上，资金储备充足。`}
              {treasuryRisk === "warn" && `国库余额下降但为正值（${usd(last.treasury_end)}），需关注长期流出。`}
              {treasuryRisk === "danger" && `国库已耗尽或为负，系统不可持续，需立即调整。`}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              总流入：{usd(totalInflow)} / 总流出：{usd(totalOutflow)}
            </div>
          </div>

          {/* Sell Pressure Risk */}
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>市场卖压</span>
              <Badge level={pressureRisk} />
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {pressureRisk === "safe" && `最大卖出/LP比 ${pct(maxSoldOverLp, 4)}，流动性池足以承受。`}
              {pressureRisk === "warn" && `最大卖出/LP比 ${pct(maxSoldOverLp, 4)}，对价格冲击较大，建议增加LP。`}
              {pressureRisk === "danger" && `卖出/LP比过高（${pct(maxSoldOverLp, 4)}），严重拖累价格。`}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Adjustment Guide */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>五、参数调节指南</h3>
        <p style={descStyle}>以下参数对结果影响最大，可重点关注：</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {[
            {
              title: "卖出压力比 (Sell Pressure)",
              current: pct(config.sell_pressure_ratio),
              desc: "控制释放MX中被卖出的比例。降低此值（如50%→30%）可显著减缓价格下行，但持有者变现减少。",
            },
            {
              title: "LP 流动性池规模",
              current: `${usd(config.lp_usdc)} / ${num(config.lp_token)} MX`,
              desc: "更大的LP池能更好吸收卖压、减少价格波动。增加LP是稳定价格最直接的方式。",
            },
            {
              title: "节点增长速度",
              current: `初级 ${num(config.junior_monthly_new)}/月 | 高级 ${num(config.senior_monthly_new)}/月`,
              desc: "增速影响国库流入和派息支出。过快增加释放压力，过慢则国库流入不足。",
            },
            {
              title: "日收益率",
              current: `初级 ${pct(config.junior_daily_rate)} | 高级 ${pct(config.senior_daily_rate)}`,
              desc: "直接决定每日MX释放量。降低收益率可大幅减少卖压，但降低节点吸引力。",
            },
            {
              title: "销毁与线性释放",
              current: `销毁率 ${pct(first.burn_rate)} | 线性释放 ${config.linear_release_days} 天`,
              desc: "更高销毁率减少流通，有利于价格。更长线性释放天数可平滑卖压峰值。",
            },
            {
              title: "国库防御机制",
              current: config.treasury_defense_enabled ? `回购 ${pct(config.treasury_buyback_ratio)} | 兑付 ${pct(config.treasury_redemption_ratio)}` : "未启用",
              desc: "回购使用国库资金买入MX支撑价格；兑付直接减少MX流通量。两者均可有效缓解卖压。",
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

      {/* Section 6: Summary */}
      <section style={sectionStyle}>
        <h3 style={h3Style}>六、总结</h3>
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
            MX价格从 {usd(priceStart)} {priceChange >= 0 ? "上涨" : "下跌"}至{" "}
            <strong style={{ color: "var(--text-primary)" }}>{usd(priceEnd, 6)}</strong>
            （{priceChange >= 0 ? "+" : ""}{pct(priceChange)}），
            最大回撤 <strong style={{ color: "var(--text-primary)" }}>{pct(maxDrawdown)}</strong>，
            国库最终余额 <strong style={{ color: "var(--text-primary)" }}>{usd(last.treasury_end)}</strong>。
          </p>
          {(priceRisk === "danger" || treasuryRisk === "danger") ? (
            <p style={{
              color: "var(--danger)", background: "rgba(239,68,68,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", margin: 0,
            }}>
              当前参数下系统存在较大风险，建议优先调整卖出压力比、增加LP流动性或降低日收益率，以提升长期可持续性。
            </p>
          ) : (priceRisk === "warn" || treasuryRisk === "warn") ? (
            <p style={{
              color: "var(--warning)", background: "rgba(245,158,11,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)", margin: 0,
            }}>
              系统整体可运行，但部分指标需关注。建议通过小幅调节参数优化表现。
            </p>
          ) : (
            <p style={{
              color: "var(--success)", background: "rgba(34,197,94,0.08)",
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)", margin: 0,
            }}>
              当前参数下系统运行健康，各项指标在安全范围内。
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
