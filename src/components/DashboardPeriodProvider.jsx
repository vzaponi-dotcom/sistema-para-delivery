import { DashboardPeriodContext } from './dashboardPeriodContext.js'

export function DashboardPeriodProvider({ period, onPeriodChange, children }) {
  return (
    <DashboardPeriodContext.Provider value={{ period, setPeriod: onPeriodChange }}>
      {children}
    </DashboardPeriodContext.Provider>
  )
}
