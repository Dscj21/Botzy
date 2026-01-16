import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  BarChart2,
  Settings,
  Globe,
  X,
  Zap,
  CreditCard,
  CloudLightning,
  RefreshCw,
  FileText,
  CheckCircle
} from 'lucide-react'

// Import Pages
import { DashboardPage } from './pages/DashboardPage'
import { UnifiedAccountsPage } from './pages/UnifiedAccountsPage'
import { CartPage } from './pages/CartPage'
import { OrdersPage } from './pages/OrdersPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { CardsPage } from './pages/CardsPage'
import { SettingsPage } from './pages/SettingsPage'

// --- CONSTANTS ---
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'cart', label: 'Cart Automation', icon: ShoppingCart },
  { id: 'cards', label: 'Virtual Cards', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 }
]

export default function AppNew() {
  const [activeTab, setActiveTab] = useState('cart')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [logs, setLogs] = useState<string[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  // Updates & Version
  const [appVersion, setAppVersion] = useState('Loading...')
  const [updateStatus, setUpdateStatus] = useState<
    'none' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  >('none')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [showChangelog, setShowChangelog] = useState(false)

  useEffect(() => {
    refreshSessions()
    loadAccounts()

    const ipc = (window as any).electron.ipcRenderer

    // Get Version
    ipc.invoke('app:version').then((v: string) => setAppVersion(v))

    const onSessionUpdate = (_e: any, list: any[]) => setSessions(list)
    const onLog = (_e: any, msg: string) => addLog(msg)

    const timer = setInterval(() => {
      refreshSessions()
    }, 2000)

    ipc.on('session:update', onSessionUpdate)
    ipc.on('automation:log', onLog)

    // Update Listeners
    ipc.on('checking-for-update', () => setUpdateStatus('checking'))

    ipc.on('update-available', (_e: any, info: any) => {
      setUpdateStatus('available')
      setUpdateInfo(info)
      addLog(`Update available: ${info.version}`)
      // Force notification if window is minimized or focused
      new Notification('Update Available', {
        body: `Version ${info.version} is ready to download.`
      })
    })

    ipc.on('update-not-available', () => {
      setUpdateStatus('none')
      addLog('App is up to date.')
    })

    ipc.on('update-download-progress', (_e: any, progressObj: any) => {
      setUpdateStatus('downloading')
      setUpdateProgress(progressObj.percent)
    })

    ipc.on('update-downloaded', (_e: any, info: any) => {
      setUpdateStatus('ready')
      setUpdateInfo(info) // Ensure we have info
      addLog('Update downloaded. Ready to install.')
    })

    ipc.on('update-error', (_e: any, err: any) => {
      setUpdateStatus('error')
      addLog(`Update Error: ${err}`)
    })

    return () => {
      clearInterval(timer)
      ipc.removeListener('session:update', onSessionUpdate)
      ipc.removeListener('automation:log', onLog)
      ipc.removeAllListeners('checking-for-update')
      ipc.removeAllListeners('update-available')
      ipc.removeAllListeners('update-not-available')
      ipc.removeAllListeners('update-download-progress')
      ipc.removeAllListeners('update-downloaded')
      ipc.removeAllListeners('update-error')
    }
  }, [])

  const loadAccounts = async () => {
    const accs = await (window as any).electron.ipcRenderer.invoke('db:get-accounts')
    setAccounts(accs)
  }

  const refreshSessions = async () => {
    try {
      const ipc = (window as any).electron.ipcRenderer
      const s = await ipc.invoke('session:get-all')
      setSessions(s)
    } catch (e) {}
  }

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200))
  }

  const checkForUpdates = () => {
    const ipc = (window as any).electron.ipcRenderer
    setUpdateStatus('checking')
    ipc.invoke('updater:check')
  }

  const switchTab = (id: string) => {
    setActiveTab(id)
    const ipc = (window as any).electron.ipcRenderer
    if (sessions.find((s) => s.id === id)) {
      ipc.invoke('session:show', id)
    } else {
      ipc.invoke('session:hide-all')
    }
  }

  const closeSession = (id: string) => {
    const ipc = (window as any).electron.ipcRenderer
    ipc.invoke('session:close', id)
    if (activeTab === id) setActiveTab('cart')
  }

  const getSessionLabel = (sessionId: string) => {
    const acc = accounts.find((a) => a.id.toString() === sessionId)
    if (acc) {
      return acc.label || acc.username || `Account ${acc.id}`
    }
    return `Session ${sessionId}`
  }

  // Theme Helpers
  const isLight = theme === 'light'

  // Sidebar State
  const [collapsed, setCollapsed] = useState(false)

  // Sidebar Styles
  const sidebarWidth = collapsed ? 'w-20' : 'w-72'
  const sidebarBg = isLight
    ? 'bg-white border-slate-200'
    : 'bg-[#121217]/50 backdrop-blur-xl border-white/5'
  const logoBg = isLight
    ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-orange-200'
    : 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]'
  const activeTabClass = isLight
    ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm'
    : 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white border border-transparent'
  const inactiveTabClass = isLight
    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    : 'text-zinc-400 hover:text-white hover:bg-white/5'

  return (
    <div
      className={`flex h-screen font-sans overflow-hidden selection:bg-orange-500/30 ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#09090b] text-white'}`}
    >
      {/* SIDEBAR */}
      <aside
        className={`${sidebarWidth} border-r flex flex-col z-50 transition-all duration-300 relative ${sidebarBg}`}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`absolute -right-3 top-20 w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer hover:scale-110 transition-all z-50 ${isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-zinc-800 border-white/10 text-zinc-400'}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          className={`p-4 h-20 border-b flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${isLight ? 'border-slate-100' : 'border-white/5'}`}
        >
          <div
            className={`w-10 h-10 min-w-[40px] rounded-xl shadow-lg flex items-center justify-center ${logoBg}`}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="font-bold text-lg tracking-tight">
                Botzy <span className={isLight ? 'text-orange-500' : 'text-blue-500'}>Pro</span>
              </h1>
              <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                Version {appVersion}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <div
            className={`text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-2 whitespace-nowrap overflow-hidden ${collapsed ? 'text-center' : ''}`}
          >
            {collapsed ? 'MENU' : 'Main Menu'}
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              title={collapsed ? tab.label : ''}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-medium transition-all duration-200 group border border-transparent ${
                activeTab === tab.id ? activeTabClass : inactiveTabClass
              }`}
            >
              <tab.icon
                className={`w-5 h-5 min-w-[20px] ${activeTab === tab.id ? 'animate-pulse' : isLight ? 'text-slate-400 group-hover:text-orange-500' : 'text-zinc-500 group-hover:text-blue-400'}`}
              />
              {!collapsed && <span>{tab.label}</span>}
            </button>
          ))}

          {/* ACTIVE SESSIONS */}
          <div className="mt-8">
            <div
              className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 mb-2`}
            >
              {!collapsed && (
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Active Sessions
                </div>
              )}
              <div
                className={`text-[10px] font-mono px-2 rounded-full ${isLight ? 'bg-orange-100 text-orange-600' : 'text-gray-600 bg-white/5'}`}
              >
                {sessions.length}
              </div>
            </div>

            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => switchTab(s.id)}
                  title={getSessionLabel(s.id)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center p-2' : 'gap-3 px-4 py-3'} rounded-xl text-sm cursor-pointer transition-all border border-transparent ${
                    activeTab === s.id
                      ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
                      : isLight
                        ? 'hover:bg-slate-100 text-slate-600'
                        : 'hover:bg-white/5 text-zinc-400'
                  }`}
                >
                  <Globe className="w-4 h-4 min-w-[16px] text-green-500" />
                  {!collapsed && (
                    <>
                      <div className="flex-1 truncate text-xs">{getSessionLabel(s.id)}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeSession(s.id)
                        }}
                        className="p-1 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {sessions.length === 0 && !collapsed && (
                <div
                  className={`px-4 py-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/5 text-zinc-600'}`}
                >
                  <Globe className="w-8 h-8 opacity-20" />
                  <span className="text-xs">No active sessions</span>
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className={`p-4 border-t ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
          <button
            onClick={() => switchTab('settings')}
            title="Settings"
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2 justify-center'} py-2 text-xs font-bold transition-colors ${activeTab === 'settings' ? 'text-orange-600' : isLight ? 'text-slate-500 hover:text-orange-600' : 'text-zinc-500 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" /> {!collapsed && 'System Settings'}
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main
        className={`flex-1 flex flex-col relative transition-colors duration-300 ${isLight ? 'bg-slate-50' : 'bg-[#09090b]'}`}
      >
        {/* TOOLBAR - UPDATES */}
        <div
          className={`h-10 border-b flex items-center justify-between px-4 z-40 ${isLight ? 'bg-white border-slate-200' : 'bg-[#121217] border-white/5'}`}
        >
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-mono opacity-50">REL v{appVersion}</span>
            {updateStatus === 'checking' && (
              <span className="flex items-center gap-1 text-blue-500">
                <RefreshCw className="w-3 h-3 animate-spin" /> Checking updates...
              </span>
            )}
            {updateStatus === 'available' && (
              <span
                className="flex items-center gap-1 text-green-500 cursor-pointer hover:underline"
                onClick={() => setShowChangelog(true)}
              >
                <CloudLightning className="w-3 h-3" /> Update v{updateInfo?.version} Available
              </span>
            )}
            {updateStatus === 'none' && (
              <span className="flex items-center gap-1 opacity-70">
                <CheckCircle className="w-3 h-3" /> Up to date
              </span>
            )}
            {updateStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-500">Update Check Failed</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {updateInfo && (
              <button
                onClick={() => setShowChangelog(true)}
                className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 hover:text-blue-500 transition-colors"
              >
                <FileText className="w-3 h-3" /> Changelog
              </button>
            )}
            <button
              onClick={checkForUpdates}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              className={`flex items-center gap-1 text-[10px] uppercase font-bold transition-colors ${updateStatus === 'checking' ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-500 text-gray-500'}`}
            >
              <RefreshCw
                className={`w-3 h-3 ${updateStatus === 'checking' ? 'animate-spin' : ''}`}
              />
              Check Updates
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {/* Render Pages conditionally/absolutely for persistence */}
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <DashboardPage />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'accounts' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <UnifiedAccountsPage />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'orders' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <OrdersPage />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'cart' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <CartPage logs={logs} setLogs={setLogs} />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'cards' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <CardsPage />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'analytics' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <AnalyticsPage />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <SettingsPage theme={theme} setTheme={setTheme} />
          </div>

          {/* SESSION CONTROLS - BROWSER VIEW HEADER */}
          {sessions.find((s) => s.id === activeTab) && (
            <div
              className={`absolute top-0 left-0 right-0 h-12 border-b flex items-center px-4 gap-4 z-50 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#18181b] border-white/10'}`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    (window as any).electron.ipcRenderer.invoke('session:go-back', activeTab)
                  }
                  className={`p-2 rounded transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-orange-600' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                  title="Back"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    (window as any).electron.ipcRenderer.invoke('session:reload', activeTab)
                  }
                  className={`p-2 rounded transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-orange-600' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                  title="Reload"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                </button>
              </div>

              <div
                className={`flex-1 rounded h-8 flex items-center px-3 text-xs font-mono truncate border select-all ${isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-black/50 text-zinc-400 border-white/5'}`}
              >
                {(sessions.find((s) => s.id === activeTab) as any)?.url || 'Loading...'}
              </div>
            </div>
          )}

          {/* UPDATE NOTIFICATION BANNER */}
          {updateStatus !== 'none' && updateStatus !== 'checking' && updateStatus !== 'error' && (
            <div
              className={`absolute bottom-6 right-6 p-4 rounded-xl shadow-2xl border flex items-center gap-4 z-50 animate-bounce-in ${isLight ? 'bg-white border-blue-200 shadow-blue-900/10' : 'bg-slate-800 border-slate-700 shadow-black/50'}`}
            >
              <div
                className={`p-3 rounded-full ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}
              >
                <CloudLightning className="w-6 h-6" />
              </div>
              <div className="min-w-[200px]">
                <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {updateStatus === 'available' &&
                    `Update v${updateInfo?.version || 'New'} Available`}
                  {updateStatus === 'downloading' && 'Downloading Update...'}
                  {updateStatus === 'ready' && 'Update Ready!'}
                </h3>

                {updateStatus === 'available' && (
                  <button
                    onClick={() => (window as any).electron.ipcRenderer.invoke('updater:download')}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-400 font-bold"
                  >
                    Download Now
                  </button>
                )}

                {updateStatus === 'downloading' && (
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>
                )}

                {updateStatus === 'ready' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => (window as any).electron.ipcRenderer.send('updater:install')}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded shadow-sm transition-colors"
                    >
                      Restart & Install
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setUpdateStatus('none')}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* CHANGELOG MODAL */}
      {showChangelog && updateInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${isLight ? 'bg-white text-slate-800' : 'bg-[#18181b] text-white border border-white/10'}`}
          >
            <div
              className={`p-6 border-b flex justify-between items-center ${isLight ? 'border-slate-100' : 'border-white/5'}`}
            >
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CloudLightning className="w-5 h-5 text-blue-500" />
                  What&apos;s New in v{updateInfo.version}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Released {new Date(updateInfo.releaseDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowChangelog(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 opacity-50" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {/* Render HTML content safely or just text. updateInfo.releaseNotes usually HTML or Markdown */}
              <div
                className="prose prose-sm dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: updateInfo.releaseNotes || 'No release notes provided.'
                }}
              ></div>
            </div>
            <div
              className={`p-4 border-t flex justify-end gap-3 ${isLight ? 'border-slate-100' : 'border-white/5'}`}
            >
              <button
                onClick={() => setShowChangelog(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Close
              </button>
              {updateStatus === 'available' && (
                <button
                  onClick={() => {
                    ;(window as any).electron.ipcRenderer.invoke('updater:download')
                    setShowChangelog(false)
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20"
                >
                  Download Update
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
