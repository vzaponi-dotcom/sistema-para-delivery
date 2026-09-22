import { useEffect, useRef, useState } from 'react'
import '../../order-cancellation.css'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import AppTopBar from './AppTopBar.jsx'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { getMobilePageDirection } from '../navigation/resolution.js'

function AppShell({ businessId, businessName, navigationBadges = {}, onLogout, logoutDisabled = false, children }) {
  const { activeTab } = useNavigation()
  const previousTab = useRef(activeTab)
  const contentRef = useRef(null)
  const [pageDirection, setPageDirection] = useState('none')

  useEffect(() => {
    setPageDirection(getMobilePageDirection(previousTab.current, activeTab))
    if (previousTab.current !== activeTab) {
      window?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
      contentRef.current?.focus?.({ preventScroll: true })
    }
    previousTab.current = activeTab
  }, [activeTab])

  return (
    <div className="app-shell">
      <AppTopBar businessId={businessId} businessName={businessName} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      <Sidebar badges={navigationBadges} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      <main className="app-main">
        <div ref={contentRef} key={activeTab} className="app-content page-transition" data-direction={pageDirection} tabIndex={-1}>
          {children}
        </div>
      </main>
      <MobileNavigation badges={navigationBadges} onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  )
}

export default AppShell
