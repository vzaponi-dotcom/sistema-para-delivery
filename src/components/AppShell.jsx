import { useEffect, useRef, useState } from 'react'
import { DashboardPeriodProvider } from './DashboardPeriodProvider'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import {
  MOBILE_SECTION_IDS,
  getAdjacentMobileSection,
  getSwipeDirection,
  shouldIgnoreNavigationSwipe,
} from '../utils/mobileNavigation.js'

function AppShell({ activeTab, onNavigate, onLogout, logoutDisabled = false, children }) {
  const touchStart = useRef(null)
  const previousTab = useRef(activeTab)
  const [pageDirection, setPageDirection] = useState('none')

  useEffect(() => {
    const previousIndex = MOBILE_SECTION_IDS.indexOf(previousTab.current)
    const activeIndex = MOBILE_SECTION_IDS.indexOf(activeTab)
    const nextDirection = previousTab.current !== activeTab && previousIndex >= 0 && activeIndex >= 0
      ? (activeIndex > previousIndex ? 'forward' : 'backward')
      : 'none'

    setPageDirection(nextDirection)
    previousTab.current = activeTab
  }, [activeTab])

  const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches

  const handleTouchStart = (event) => {
    if (!isMobileViewport() || activeTab === 'new-order' || shouldIgnoreNavigationSwipe(event.target)) {
      touchStart.current = null
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event) => {
    if (!touchStart.current || !isMobileViewport() || activeTab === 'new-order') {
      touchStart.current = null
      return
    }
    const touch = event.changedTouches[0]
    if (!touch) {
      touchStart.current = null
      return
    }

    const direction = getSwipeDirection({
      deltaX: touch.clientX - touchStart.current.x,
      deltaY: touch.clientY - touchStart.current.y,
    })
    touchStart.current = null
    if (!direction) return

    const destination = getAdjacentMobileSection(activeTab, direction)
    if (destination !== activeTab) onNavigate(destination)
  }

  return (
    <DashboardPeriodProvider>
      <div className="app-shell">
        <Sidebar
          activeTab={activeTab}
          onNavigate={onNavigate}
          onLogout={onLogout}
          logoutDisabled={logoutDisabled}
        />
        <main className="app-main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div key={activeTab} className="app-content page-transition" data-direction={pageDirection}>{children}</div>
        </main>
        <MobileNavigation
          activeTab={activeTab}
          onNavigate={onNavigate}
          onLogout={onLogout}
          logoutDisabled={logoutDisabled}
        />
      </div>
    </DashboardPeriodProvider>
  )
}

export default AppShell
