import type { ModelParams } from "../config/types"

const STORAGE_KEY = "coinmax_scenarios"

export interface Scenario {
  name: string
  config: ModelParams
  saved_at: number
}

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveScenario(name: string, config: ModelParams): void {
  const list = loadScenarios()
  const idx = list.findIndex((s) => s.name === name)
  const entry: Scenario = { name, config, saved_at: Date.now() }
  if (idx >= 0) list[idx] = entry
  else list.push(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function deleteScenario(name: string): void {
  const list = loadScenarios().filter((s) => s.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
