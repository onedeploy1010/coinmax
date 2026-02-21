import React, { useState } from "react"
import type { ModelParams, GrowthMode } from "../config/types"
import { loadScenarios, saveScenario, deleteScenario } from "../utils/scenario"

interface Props {
  config: ModelParams
  onChange: (c: ModelParams) => void
  onRun: () => void
  isMobile: boolean
}

interface ParamGroup {
  label: string
  fields: FieldDef[]
}

type FieldDef =
  | { key: string; label: string; type: "number"; step?: number }
  | { key: string; label: string; type: "boolean" }
  | { key: string; label: string; type: "select"; options: { value: number; label: string }[] }
  | { key: string; label: string; type: "record" }

const GROUPS: ParamGroup[] = [
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
      {
        key: "growth_mode",
        label: "增长模式",
        type: "select",
        options: [
          { value: 1, label: "线性" },
          { value: 2, label: "指数" },
        ],
      },
      { key: "growth_rate", label: "增长率", type: "number", step: 0.01 },
      { key: "junior_monthly_new", label: "初级月新增", type: "number" },
      { key: "senior_monthly_new", label: "高级月新增", type: "number" },
      { key: "sim_days", label: "模拟天数", type: "number" },
    ],
  },
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
    label: "解锁天数",
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
    label: "最大回本 / 销毁",
    fields: [
      { key: "max_out_multiple", label: "最大回本倍数", type: "number", step: 0.1 },
      { key: "cap_include_static", label: "含静态上限", type: "boolean" },
      { key: "cap_include_dynamic", label: "含动态上限", type: "boolean" },
      { key: "withdraw_delay_days", label: "提现延迟天数", type: "number" },
      { key: "burn_schedule", label: "销毁计划", type: "record" },
      { key: "linear_release_days", label: "线性释放天数", type: "number" },
    ],
  },
  {
    label: "Vault 质押",
    fields: [
      { key: "vault_rates", label: "Vault 费率", type: "record" },
      { key: "platform_fee_ratio", label: "平台费率", type: "number", step: 0.01 },
      { key: "early_unstake_penalty_ratio", label: "提前解押罚金率", type: "number", step: 0.01 },
    ],
  },
  {
    label: "订阅 / 保险",
    fields: [
      { key: "subscription_monthly_fee", label: "月订阅费", type: "number" },
      { key: "subscription_half_year_fee", label: "半年订阅费", type: "number" },
      { key: "insurance_min_usdc", label: "保险最小 USDC", type: "number" },
      { key: "insurance_max_usdc", label: "保险最大 USDC", type: "number" },
      { key: "insurance_payout_low_loss_multiple", label: "低损赔付倍数", type: "number", step: 0.1 },
      { key: "insurance_payout_high_loss_multiple", label: "高损赔付倍数", type: "number", step: 0.1 },
    ],
  },
  {
    label: "国库",
    fields: [
      { key: "treasury_start_usdc", label: "国库初始 USDC", type: "number" },
      { key: "external_profit_monthly", label: "外部月利润", type: "number" },
      { key: "external_profit_growth_rate", label: "外部利润增长率", type: "number", step: 0.01 },
      { key: "usdc_payout_cover_ratio", label: "USDC 支付覆盖率", type: "number", step: 0.01 },
      { key: "lp_owned_by_treasury", label: "LP 归国库所有", type: "boolean" },
      {
        key: "node_payout_mode",
        label: "节点支付模式",
        type: "select",
        options: [
          { value: 1, label: "模式 1" },
          { value: 2, label: "模式 2" },
        ],
      },
    ],
  },
]

export const ParamPanel: React.FC<Props> = ({ config, onChange, onRun, isMobile }) => {
  const [scenarioName, setScenarioName] = useState("")
  const [scenarios, setScenarios] = useState(loadScenarios)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const set = (key: string, val: unknown) => {
    onChange({ ...config, [key]: val } as ModelParams)
  }

  const toggleGroup = (label: string) => {
    setCollapsed((p) => ({ ...p, [label]: !p[label] }))
  }

  const handleSave = () => {
    if (!scenarioName.trim()) return
    saveScenario(scenarioName.trim(), config)
    setScenarios(loadScenarios())
    setScenarioName("")
  }

  const handleLoad = (name: string) => {
    const s = scenarios.find((x) => x.name === name)
    if (s) onChange(s.config)
  }

  const handleDelete = (name: string) => {
    deleteScenario(name)
    setScenarios(loadScenarios())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfgAny = config as any

  const renderField = (f: FieldDef) => {
    if (f.type === "number") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input
            type="number"
            step={f.step ?? 1}
            value={cfgAny[f.key] as number}
            onChange={(e) => set(f.key, parseFloat(e.target.value) || 0)}
          />
        </div>
      )
    }
    if (f.type === "boolean") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input
            type="checkbox"
            checked={cfgAny[f.key] as boolean}
            onChange={(e) => set(f.key, e.target.checked)}
          />
        </div>
      )
    }
    if (f.type === "select") {
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <select
            value={cfgAny[f.key] as number}
            onChange={(e) => set(f.key, parseInt(e.target.value))}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )
    }
    if (f.type === "record") {
      const val = cfgAny[f.key] as Record<number, number>
      const text = JSON.stringify(val)
      return (
        <div className="field-row" key={f.key}>
          <label>{f.label}</label>
          <input
            type="text"
            value={text}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                if (typeof parsed === "object" && parsed !== null) set(f.key, parsed)
              } catch {
                /* ignore invalid json while typing */
              }
            }}
          />
        </div>
      )
    }
    return null
  }

  return (
    <div className={`param-panel ${isMobile ? "param-panel-mobile" : ""}`}>
      <h2>控制面板</h2>

      {/* Scenario manager */}
      <div className="scenario-section">
        <div className="scenario-save">
          <input
            type="text"
            placeholder="方案名称..."
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
          />
          <button onClick={handleSave} className="btn-sm">保存</button>
        </div>
        {scenarios.length > 0 && (
          <div className="scenario-list">
            {scenarios.map((s) => (
              <div key={s.name} className="scenario-item">
                <span className="scenario-name" onClick={() => handleLoad(s.name)}>
                  {s.name}
                </span>
                <button className="btn-xs btn-danger" onClick={() => handleDelete(s.name)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parameter groups */}
      {GROUPS.map((g) => (
        <div className="param-group" key={g.label}>
          <div className="param-group-header" onClick={() => toggleGroup(g.label)}>
            <span>{collapsed[g.label] ? "▸" : "▾"} {g.label}</span>
          </div>
          {!collapsed[g.label] && (
            <div className="param-group-body">{g.fields.map(renderField)}</div>
          )}
        </div>
      ))}

      <button className="btn-run" onClick={onRun}>
        运行模拟
      </button>
    </div>
  )
}
