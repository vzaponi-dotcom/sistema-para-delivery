import Sidebar from './Sidebar'

function AppShell({ activeTab, onNavigate, children }) {
  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onNavigate={onNavigate} />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
