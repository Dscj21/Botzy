import { useState, useEffect } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { UnifiedAccountsPage } from './pages/UnifiedAccountsPage'
import { CartPage } from './pages/CartPage'
import { OrdersPage } from './pages/OrdersPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsModal } from './components/SettingsModal'
import { GlobalSearch } from './components/GlobalSearch'
import { api } from './services/api'

// Icons
import {
  LayoutDashboard, Users, ShoppingCart, Package,
  BarChart2, Search, Settings, Globe
} from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('cart')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [showUniversalSearch, setShowUniversalSearch] = useState(false)
  const [updateStatus, setUpdateStatus] = useState({ available: false, downloaded: false, progress: 0 })



  const refreshSessions = async () => {
    try {
      setSessions(await api.getSessions())
    } catch (e) { }
  }

  const refreshAccounts = async () => {
    const accs = await (window as any).electron.ipcRenderer.invoke('db:get-accounts')
    setAccounts(accs)
  }

  const cancelSession = async (id: string) => {
    await api.closeSession(id)
    if (activeTab === id) setActiveTab('cart')
  }

  const handleTabSwitch = async (tab: string) => {
    setShowUniversalSearch(false)
    setIsSettingsOpen(false)

    if (sessions.find(s => s.id === tab)) { await api.showSession(tab) }
    else { await (api as any).hideAllSessions?.() }
    setActiveTab(tab)
  }

  useEffect(() => {
    refreshSessions()
    refreshAccounts()

    // Failsafe Polling: Ensures sidebar is always in sync even if events drop
    const pollTimer = setInterval(refreshSessions, 2000)

    const remove1 = (window as any).electron.ipcRenderer.on('session:update', (_e, s) => setSessions(s))
    const remove2 = (window as any).electron.ipcRenderer.on('update:status', (_e, s) => setUpdateStatus(s))
    const remove3 = (window as any).electron.ipcRenderer.on('automation:log', (_e, msg) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
    })

    return () => {
      clearInterval(pollTimer)
      remove1(); remove2(); remove3()
    }
  }, [])

  return (
    <div className="flex h-screen bg-[#0f172a] text-gray-100 font-sans overflow-hidden">

      {/* SIDEBAR */}
      <div className="w-64 bg-[#1e293b] border-r border-gray-700 flex flex-col flex-shrink-0 z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Globe className="w-5 h-5 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            HyperCart
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <div className="space-y-1">
            <NavButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabSwitch('dashboard')} />
            <NavButton icon={Users} label="Accounts" active={activeTab === 'accounts'} onClick={() => handleTabSwitch('accounts')} />
            <NavButton icon={Package} label="All Orders" active={activeTab === 'orders'} onClick={() => handleTabSwitch('orders')} />
            <div className="pt-4 pb-2">
              <NavButton icon={ShoppingCart} label="Cart Manager" active={activeTab === 'cart'} onClick={() => handleTabSwitch('cart')} special />
            </div>
            <NavButton icon={BarChart2} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleTabSwitch('analytics')} />
            <NavButton icon={Search} label="Global Search" active={activeTab === 'search'} onClick={() => setShowUniversalSearch(true)} />
          </div>

          {/* SESSIONS */}
          <div className="mt-8">
            <h3 className="px-6 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Active Sessions</h3>
            <div className="space-y-1">
              {sessions.map((s) => {
                const account = accounts.find(a => a.id.toString() === s.id)
                const label = account ? (account.label || account.username || account.id).toString() : `Session ${s.id}`
                const displayLabel = label.length > 18 ? label.substring(0, 16) + '...' : label

                return (
                  <button
                    key={s.id}
                    onClick={() => handleTabSwitch(s.id)}
                    className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors relative group ${activeTab === s.id ? 'text-blue-400 bg-blue-500/10 border-r-2 border-blue-500' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${activeTab === s.id ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-green-500'}`} />
                    <span className="truncate" title={label}>{displayLabel}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); cancelSession(s.id) }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1"
                    >
                      ✕
                    </span>
                  </button>
                )
              })}
              {sessions.length === 0 && (
                <div className="px-6 py-2 text-xs text-gray-600 italic">No active sessions</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
            {updateStatus.available && <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1e293b]">

        {/* Session Overlay Controls */}
        {sessions.find(s => s.id === activeTab) && (
          <div className="absolute top-0 left-0 right-0 h-10 bg-[#0f172a] border-b border-gray-700 flex items-center justify-between px-4 z-50">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Live Browser Session • {sessions.find(s => s.id === activeTab)?.id}</span>
            </div>
            <button
              onClick={() => handleTabSwitch('cart')}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
            >
              Close View
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'accounts' && <UnifiedAccountsPage />}
        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'cart' && <CartPage logs={logs} setLogs={setLogs} />}
        {activeTab === 'analytics' && <AnalyticsPage />}

        {showUniversalSearch && <GlobalSearch onClose={() => setShowUniversalSearch(false)} />}
        {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} updateStatus={updateStatus} />}

      </div>
    </div>
  )
}

function NavButton({ icon: Icon, label, active, onClick, special }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-all ${active
        ? 'text-white bg-blue-600 shadow-lg shadow-blue-900/50'
        : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
        } ${special ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg mx-4 rounded-lg w-auto justify-center mb-2' : ''}`}
    >
      <Icon className="w-5 h-5" />
      <span className={special ? 'font-bold' : 'font-medium'}>{label}</span>
    </button>
  )
}
