import Sidebar from './Sidebar'

function AppShell({ activeTab, onNavigate, onLogout, logoutDisabled = false, children }) {
  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onNavigate={onNavigate}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
