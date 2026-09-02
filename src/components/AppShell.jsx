import { useRef } from 'react'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import {
  getAdjacentMobileSection,
  getSwipeDirection,
  shouldIgnoreNavigationSwipe,
} from '../utils/mobileNavigation.js'

function AppShell({ activeTab, onNavigate, onLogout, logoutDisabled = false, children }) {
  const touchStart = useRef(null)

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
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onNavigate={onNavigate}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
      <main className="app-main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="app-content">{children}</div>
      </main>
      <MobileNavigation
        activeTab={activeTab}
        onNavigate={onNavigate}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  )
}

export default AppShell
