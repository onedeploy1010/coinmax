import React, { useState } from "react"
import type { ModelParams } from "../config/types"
import { loadScenarios, saveScenario, deleteScenario } from "../utils/scenario"

interface Props {
  config: ModelParams
  onChange: (c: ModelParams) => void
  onRun: () => void
  isMobile: boolean
}

interface ParamGroup { label: string; fields: FieldDef[] }

type FieldDef =
  | { key: string; label: string; type: "number"; step?: number }
  | { key: string; label: string; type: "boolean" }
  | { key: string; label: string; type: "select"; options: { value: string | number; label: string }[] }
  | { key: string; label: string; type: "record" }

type ParamTab = "basic" | "nodes" | "defense" | "advanced"

const PARAM_TABS: { key: ParamTab; label: string }[] = [
  { key: "basic", label: "基础" },
  { key: "nodes", label: "节点" },
  { key: "defense", label: "防御" },
  { key: "advanced", label: "高级" },
]

const TAB_GROUPS: Record<ParamTab, ParamGroup[]> = {
  basic: [
    {
      label: "AMM / 流动性池",
      fields: [
        { key: "price_token", label: "初始代币价格", type: "number", step: 0.01 },
        { key: "lp_usdc", label: "LP USDC", type: "number" },
        { key: "lp_token", label: "LP Token", type: "number" },
        { key: "amm_fee_rate", label: "AMM 手续费率", type: "number", step: 0.001 },
        { key: "sell_pressure_ratio", label: "卖压比例", type: "number", step: 0.01 },
      ],
    },
    {
      label: "增长模式",
      fields: [
        { key: "growth_mode", label: "增长模式", type: "select", options: [{ value: 1, label: "线性" }, { value: 2, label: "指数" }] },
        { key: "growth_rate", label: "增长率", type: "number", step: 0.01 },
        { key: "junior_monthly_new", label: "初级月新增", type: "number" },
        { key: "senior_monthly_new", label: "高级月新增", type: "number" },
        { key: "junior_max_nodes", label: "初级节点上限", type: "number" },
        { key: "senior_max_nodes", label: "高级节点上限", type: "number" },
        { key: "sim_days", label: "模拟天数", type: "number" },
      ],
    },
  ],
  nodes: [
    {
      label: "节点投资",
      fields: [
        { key: "junior_invest_usdc", label: "初级投入 USDC", type: "number" },
        { key: "senior_invest_usdc", label: "高级投入 USDC", type: "number" },
        { key: "junior_package_usdc", label: "初级包 USDC", type: "number" },
        { key: "senior_package_usdc", label: "高级包 USDC", type: "number" },
        { key: "junior_daily_rate", label: "初级日收益率", type: "number", step: 0.001 },
        { key: "senior_daily_rate", label: "高级日收益率", type: "number", step: 0.001 },
      ],
    },
    {
      label: "V级解锁天数",
      fields: [
        { key: "junior_target_v2_days", label: "初级 V2 天", type: "number" },
        { key: "junior_target_v3_days", label: "初级 V3 天", type: "number" },
        { key: "senior_target_v1_days", label: "高级 V1 天", type: "number" },
        { key: "senior_target_v2_days", label: "高级 V2 天", type: "number" },
        { key: "senior_target_v3_days", label: "高级 V3 天", type: "number" },
        { key: "senior_target_v4_days", label: "高级 V4 天", type: "number" },
        { key: "senior_target_v6_days", label: "高级 V6 天", type: "number" },
      ],
    },
    {
      label: "3x 上限 / 销毁释放",
      fields: [
        { key: "max_out_multiple", label: "最大回本倍数", type: "number", step: 0.1 },
        { key: "cap_include_static", label: "含静态上限", type: "boolean" },
        { key: "cap_include_dynamic", label: "含动态上限", type: "boolean" },
        { key: "withdraw_delay_days", label: "提现延迟天数", type: "number" },
        { key: "burn_schedule", label: "销毁计划", type: "record" },
        { key: "linear_release_days", label: "线性释放天数", type: "number" },
      ],
    },
  ],
  defense: [
    {
      label: "MX 销毁闸门",
      fields: [
        { key: "mx_price_usdc", label: "MX 价格 (USDC)", type: "number", step: 0.01 },
        { key: "mx_burn_per_withdraw_ratio", label: "提现销毁比例", type: "number", step: 0.01 },
        { key: "mx_burn_mode", label: "计算模式", type: "select", options: [{ value: "usdc_value", label: "USDC 价值" }, { value: "ar_amount", label: "MX 数量" }] },
        { key: "mx_amm_enabled", label: "MX AMM (预留)", type: "boolean" },
        { key: "mx_burn_from", label: "销毁来源", type: "select", options: [{ value: "user", label: "用户承担" }, { value: "treasury", label: "国库承担" }] },
      ],
    },
    {
      label: "国库防御工具",
      fields: [
        { key: "treasury_defense_enabled", label: "启用防御", type: "boolean" },
        { key: "treasury_buyback_ratio", label: "回购比例(日流入)", type: "number", step: 0.01 },
        { key: "treasury_redemption_ratio", label: "兑付比例", type: "number", step: 0.01 },
        { key: "treasury_buyback_trigger.drawdown_threshold", label: "回撤触发阈值", type: "number", step: 0.01 },
        { key: "treasury_buyback_trigger.sold_over_lp_threshold", label: "卖压/LP触发", type: "number", step: 0.01 },
        { key: "treasury_buyback_trigger.lp_usdc_min_threshold", label: "LP最低触发", type: "number" },
        { key: "treasury_buyback_trigger.treasury_min_buffer", label: "国库最低缓冲", type: "number" },
      ],
    },
  ],
  advanced: [
    {
      label: "Vault 质押",
      fields: [
        { key: "vault_rates", label: "Vault 费率", type: "record" },
        { key: "blend_mode", label: "混合模式", type: "select", options: [
          { value: "aggressive", label: "激进市场" },
          { value: "longterm", label: "长线市场" },
          { value: "weighted", label: "权重指数" },
          { value: "average", label: "平均值" },
        ] },
        { key: "platform_fee_ratio", label: "平台费率", type: "number", step: 0.01 },
        { key: "early_unstake_penalty_ratio", label: "提前解押罚金率", type: "number", step: 0.01 },
        { key: "vault_open_day", label: "金库开启日", type: "number" },
        { key: "vault_open_on_node_full", label: "节点招满开启", type: "boolean" },
        { key: "vault_convert_ratio", label: "节点转化率", type: "number", step: 0.01 },
        { key: "vault_monthly_new", label: "月新增质押用户", type: "number" },
        { key: "vault_user_growth_rate", label: "质押用户增长率", type: "number", step: 0.01 },
        { key: "vault_avg_stake_usdc", label: "人均质押 USDC", type: "number" },
      ],
    },
    {
      label: "订阅 / 保险",
      fields: [
        { key: "subscription_monthly_fee", label: "月订阅费", type: "number" },
        { key: "subscription_half_year_fee", label: "半年订阅费", type: "number" },
        { key: "insurance_enabled", label: "启用保险模块", type: "boolean" },
        { key: "insurance_min_usdc", label: "保险最小 USDC", type: "number" },
        { key: "insurance_max_usdc", label: "保险最大 USDC", type: "number" },
        { key: "insurance_payout_low_loss_multiple", label: "低损赔付倍数", type: "number", step: 0.1 },
        { key: "insurance_payout_high_loss_multiple", label: "高损赔付倍数", type: "number", step: 0.1 },
      ],
    },
    {
      label: "国库基础",
      fields: [
        { key: "treasury_start_usdc", label: "国库初始 USDC", type: "number" },
        { key: "external_profit_monthly", label: "外部月利润", type: "number" },
        { key: "external_profit_growth_rate", label: "外部利润增长率", type: "number", step: 0.01 },
        { key: "usdc_payout_cover_ratio", label: "USDC 支付覆盖率", type: "number", step: 0.01 },
        { key: "lp_owned_by_treasury", label: "LP 归国库所有", type: "boolean" },
        { key: "node_payout_mode", label: "节点支付模式", type: "select", options: [{ value: 1, label: "模式 1" }, { value: 2, label: "模式 2" }] },
      ],
    },
  ],
}

// Deep get/set for nested keys like "treasury_buyback_trigger.drawdown_threshold"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepSet(obj: any, path: string, val: any): any {
  const clone = JSON.parse(JSON.stringify(obj))
  const keys = path.split(".")
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]]
  cur[keys[keys.length - 1]] = val
  return clone
}

export const ParamPanel: React.FC<Props> = ({ config, onChange, onRun, isMobile }) => {
  const [scenarioName, setScenarioName] = useState("")
  const [scenarios, setScenarios] = useState(loadScenarios)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<ParamTab>("basic")

  const set = (key: string, val: unknown) => {
    if (key.includes(".")) {
      onChange(deepSet(config, key, val) as ModelParams)
    } else {
      onChange({ ...config, [key]: val } as ModelParams)
    }
  }

  const toggleGroup = (label: string) => setCollapsed((p) => ({ ...p, [label]: !p[label] }))

  const handleSave = () => {
    if (!scenarioName.trim()) return
    saveScenario(scenarioName.trim(), config)
    setScenarios(loadScenarios())
    setScenarioName("")
  }
  const handleLoad = (name: string) => { const s = scenarios.find((x) => x.name === name); if (s) onChange(s.config) }
  const handleDelete = (name: string) => { deleteScenario(name); setScenarios(loadScenarios()) }

  const renderField = (f: FieldDef) => {
    const val = deepGet(config, f.key)
    if (f.type === "number") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input type="number" step={f.step ?? 1} value={val as number}
            onChange={(e) => set(f.key, parseFloat(e.target.value) || 0)} />
        </div>
      )
    }
    if (f.type === "boolean") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input type="checkbox" checked={val as boolean} onChange={(e) => set(f.key, e.target.checked)} />
        </div>
      )
    }
    if (f.type === "select") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <select value={String(val)} onChange={(e) => {
            const v = e.target.value
            const numVal = Number(v)
            set(f.key, isNaN(numVal) ? v : numVal)
          }}>
            {f.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    if (f.type === "record") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input type="text" value={JSON.stringify(val)} onChange={(e) => {
            try { const p = JSON.parse(e.target.value); if (typeof p === "object" && p !== null) set(f.key, p) } catch { /* */ }
          }} />
        </div>
      )
    }
    return null
  }

  const currentGroups = TAB_GROUPS[activeTab]

  return (
    <div className={`param-panel ${isMobile ? "param-panel-mobile" : ""}`}>
      <h2>控制面板</h2>

      {/* Scenario management */}
      <div className="scenario-section">
        <div className="scenario-save">
          <input type="text" placeholder="方案名称..." value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
          <button onClick={handleSave} className="btn-sm">保存</button>
        </div>
        {scenarios.length > 0 && (
          <div className="scenario-list">
            {scenarios.map((s) => (
              <div key={s.name} className="scenario-item">
                <span className="scenario-name" onClick={() => handleLoad(s.name)}>{s.name}</span>
                <button className="btn-xs btn-danger" onClick={() => handleDelete(s.name)}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="param-tabs">
        {PARAM_TABS.map((t) => (
          <button
            key={t.key}
            className={`param-tab-btn ${activeTab === t.key ? "param-tab-active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Groups for active tab */}
      <div className="param-tab-content">
        {currentGroups.map((g) => (
          <div className="param-group" key={g.label}>
            <div className="param-group-header" onClick={() => toggleGroup(g.label)}>
              <span>{collapsed[g.label] ? "▸" : "▾"} {g.label}</span>
            </div>
            {!collapsed[g.label] && <div className="param-group-body">{g.fields.map(renderField)}</div>}
          </div>
        ))}
      </div>

      <button className="btn-run" onClick={onRun}>运行模拟</button>
    </div>
  )
}
