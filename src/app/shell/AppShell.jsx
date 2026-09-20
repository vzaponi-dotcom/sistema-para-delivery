import { useEffect, useRef, useState } from 'react'
import '../../order-cancellation.css'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { getMobilePageDirection } from '../navigation/resolution.js'

function AppShell({ onLogout, logoutDisabled = false, children }) {
  const { activeTab } = useNavigation()
  const previousTab = useRef(activeTab)
  const contentRef = useRef(null)
  const [pageDirection, setPageDirection] = useState('none')

  useEffect(() => {
    setPageDirection(getMobilePageDirection(previousTab.current, activeTab))
    if (previousTab.current !== activeTab) contentRef.current?.focus?.()
    previousTab.current = activeTab
  }, [activeTab])

  return (
    <div className="app-shell">
        <Sidebar onLogout={onLogout} logoutDisabled={logoutDisabled} />
        <main className="app-main">
          <div ref={contentRef} key={activeTab} className="app-content page-transition" data-direction={pageDirection} tabIndex={-1}>
            {children}
          </div>
        </main>
        <MobileNavigation onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  )
}

export default AppShell
