import React, { useState, useCallback } from "react"
import type { ModelParams } from "./config/types"
import { defaultConfig } from "./config/defaultConfig"
import { simulate, type DailyRow } from "./engine/simulate"
import { ParamPanel } from "./ui/ParamPanel"
import { InvestorDashboardTab } from "./ui/InvestorDashboardTab"
import { OverviewTab } from "./ui/OverviewTab"
import { ChartsTab } from "./ui/ChartsTab"
import { TableTab } from "./ui/TableTab"
import { StageReportTab } from "./ui/StageReportTab"
import { OptimizerTab } from "./ui/OptimizerTab"
import { StressTestTab } from "./ui/StressTestTab"
import { ReportTab } from "./ui/Report"
import { useIsMobile } from "./hooks/use-mobile"

type TabKey = "dashboard" | "overview" | "charts" | "table" | "stage" | "optimizer" | "stress" | "report"

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "仪表盘" },
  { key: "stage", label: "阶段报告" },
  { key: "report", label: "总结报告" },
  { key: "overview", label: "概览" },
  { key: "charts", label: "图表" },
  { key: "table", label: "数据表" },
  { key: "optimizer", label: "优化器" },
  { key: "stress", label: "压力测试" },
]

export default function App() {
  const isMobile = useIsMobile()
  const [config, setConfig] = useState<ModelParams>({ ...defaultConfig })
  const [rows, setRows] = useState<DailyRow[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard")
  const [panelOpen, setPanelOpen] = useState(!isMobile)
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const result = simulate(config)
      setRows(result)
      setRunning(false)
      if (isMobile) setPanelOpen(false)
    }, 16)
  }, [config, isMobile])

  const handleApplyOptimizer = useCallback((overrides: Record<string, number>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated: any = { ...config }
    for (const [k, v] of Object.entries(overrides)) updated[k] = v
    const newConfig = updated as ModelParams
    setConfig(newConfig)
    // Auto re-run simulation
    setRunning(true)
    setTimeout(() => {
      const result = simulate(newConfig)
      setRows(result)
      setRunning(false)
      setActiveTab("dashboard")
    }, 16)
  }, [config])

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <InvestorDashboardTab rows={rows} config={config} />
      case "overview":
        return <OverviewTab rows={rows} />
      case "charts":
        return <ChartsTab rows={rows} />
      case "table":
        return <TableTab rows={rows} />
      case "stage":
        return <StageReportTab rows={rows} config={config} />
      case "optimizer":
        return <OptimizerTab config={config} onApply={handleApplyOptimizer} isMobile={isMobile} />
      case "stress":
        return <StressTestTab config={config} isMobile={isMobile} />
      case "report":
        return <ReportTab rows={rows} config={config} />
    }
  }

  return (
    <div className={`app-root ${isMobile ? "mobile" : "desktop"}`}>
      <header className="app-header">
        <div className="header-left">
          {isMobile && (
            <button className="btn-icon" onClick={() => setPanelOpen((p) => !p)}>
              {panelOpen ? "\u2715" : "\u2630"}
            </button>
          )}
          <h1>CoinMax 风控经济模型模拟器</h1>
        </div>
      </header>

      <div className="app-body">
        {(panelOpen || !isMobile) && (
          <>
            {isMobile && <div className="overlay" onClick={() => setPanelOpen(false)} />}
            <aside className={`sidebar ${isMobile ? "sidebar-mobile" : ""}`}>
              <ParamPanel
                config={config}
                onChange={setConfig}
                onRun={handleRun}
                isMobile={isMobile}
              />
            </aside>
          </>
        )}

        <main className="main-content">
          {running && (
            <div className="running-overlay">
              <div className="spinner" />
              <span>正在计算...</span>
            </div>
          )}

          <div className="tab-bar">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab-btn ${activeTab === t.key ? "tab-active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="tab-content">{renderTab()}</div>
        </main>
      </div>
    </div>
  )
}
