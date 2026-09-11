import { useEffect, useRef, useState } from 'react'
import '../order-cancellation.css'
import { DashboardPeriodProvider } from './DashboardPeriodProvider'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import { MOBILE_SECTION_IDS } from '../utils/mobileNavigation.js'

function AppShell({ activeTab, activeMobileEntry, granted, implemented, moreOpen, onOpenMore, onCloseMore, onNavigate, onLogout, logoutDisabled = false, dashboardPeriod, onDashboardPeriodChange, children }) {
  const previousTab = useRef(activeTab)
  const contentRef = useRef(null)
  const [pageDirection, setPageDirection] = useState('none')

  useEffect(() => {
    const previousIndex = MOBILE_SECTION_IDS.indexOf(previousTab.current)
    const activeIndex = MOBILE_SECTION_IDS.indexOf(activeTab)
    const nextDirection = previousTab.current !== activeTab && previousIndex >= 0 && activeIndex >= 0
      ? (activeIndex > previousIndex ? 'forward' : 'backward')
      : 'none'
    setPageDirection(nextDirection)
    if (previousTab.current !== activeTab) contentRef.current?.focus?.()
    previousTab.current = activeTab
  }, [activeTab])

  useEffect(() => {
    const handleNavigate = (event) => {
      if (typeof event?.detail === 'string') onNavigate(event.detail)
    }
    window.addEventListener('app:navigate', handleNavigate)
    return () => window.removeEventListener('app:navigate', handleNavigate)
  }, [onNavigate])

  return (
    <DashboardPeriodProvider period={dashboardPeriod} onPeriodChange={onDashboardPeriodChange}>
      <div className="app-shell">
        <Sidebar activeTab={activeTab} activeNavigationEntry={activeMobileEntry} granted={granted} implemented={implemented} onNavigate={onNavigate} onLogout={onLogout} logoutDisabled={logoutDisabled} />
        <main className="app-main">
          <div ref={contentRef} key={activeTab} className="app-content page-transition" data-direction={pageDirection} tabIndex={-1}>
            {children}
          </div>
        </main>
        <MobileNavigation activeTab={activeTab} activeMobileEntry={activeMobileEntry} granted={granted} implemented={implemented} moreOpen={moreOpen} onOpenMore={onOpenMore} onCloseMore={onCloseMore} onNavigate={onNavigate} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      </div>
    </DashboardPeriodProvider>
  )
}

export default AppShell
