import React, { useState, useCallback } from "react"
import type { ModelParams } from "./config/types"
import { defaultConfig } from "./config/defaultConfig"
import { simulate, type DailyRow } from "./engine/simulate"
import { ParamPanel } from "./ui/ParamPanel"
import { OverviewTab } from "./ui/OverviewTab"
import { ChartsTab } from "./ui/ChartsTab"
import { TableTab } from "./ui/TableTab"
import { StressTestTab } from "./ui/StressTestTab"
import { useIsMobile } from "./hooks/use-mobile"

type TabKey = "overview" | "charts" | "table" | "stress"

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "概览" },
  { key: "charts", label: "图表" },
  { key: "table", label: "数据表" },
  { key: "stress", label: "压力测试" },
]

export default function App() {
  const isMobile = useIsMobile()
  const [config, setConfig] = useState<ModelParams>({ ...defaultConfig })
  const [rows, setRows] = useState<DailyRow[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
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

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab rows={rows} />
      case "charts":
        return <ChartsTab rows={rows} />
      case "table":
        return <TableTab rows={rows} />
      case "stress":
        return <StressTestTab config={config} isMobile={isMobile} />
    }
  }

  return (
    <div className={`app-root ${isMobile ? "mobile" : "desktop"}`}>
      <header className="app-header">
        <div className="header-left">
          {isMobile && (
            <button className="btn-icon" onClick={() => setPanelOpen((p) => !p)}>
              {panelOpen ? "✕" : "☰"}
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
