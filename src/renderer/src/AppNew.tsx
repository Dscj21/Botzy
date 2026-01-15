import { useState, useEffect } from 'react'
import {
    LayoutDashboard, Users, ShoppingCart, Package,
    BarChart2, Settings, Globe, X, Zap, CreditCard, CloudLightning
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
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
]

export default function AppNew() {
    const [activeTab, setActiveTab] = useState('cart')
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')
    const [logs, setLogs] = useState<string[]>([])
    const [sessions, setSessions] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [updateStatus, setUpdateStatus] = useState<'none' | 'available' | 'downloading' | 'ready'>('none')
    const [updateProgress, setUpdateProgress] = useState(0)


    useEffect(() => {
        refreshSessions()
        loadAccounts()

        const onSessionUpdate = (_e: any, list: any[]) => setSessions(list)
        const onLog = (_e: any, msg: string) => addLog(msg)

        const timer = setInterval(() => {
            refreshSessions()
        }, 2000)

        const ipc = (window as any).electron.ipcRenderer
        ipc.on('session:update', onSessionUpdate)
        ipc.on('automation:log', onLog)

        // Update Listeners
        ipc.on('update-available', () => {
            setUpdateStatus('available')
            addLog('Update available! Downloading...')
        })
        ipc.on('update-download-progress', (_e: any, progressObj: any) => {
            setUpdateStatus('downloading')
            setUpdateProgress(progressObj.percent)
        })
        ipc.on('update-downloaded', () => {
            setUpdateStatus('ready')
            addLog('Update downloaded. Ready to install.')
        })

        return () => {
            clearInterval(timer)
            ipc.removeListener('session:update', onSessionUpdate)
            ipc.removeListener('automation:log', onLog)
            ipc.removeAllListeners('update-available')
            ipc.removeAllListeners('update-download-progress')
            ipc.removeAllListeners('update-downloaded')
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
        } catch (e) { }
    }

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 200))
    }

    const switchTab = (id: string) => {
        setActiveTab(id)
        const ipc = (window as any).electron.ipcRenderer
        if (sessions.find(s => s.id === id)) {
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
        const acc = accounts.find(a => a.id.toString() === sessionId)
        if (acc) {
            return acc.label || acc.username || `Account ${acc.id}`
        }
        return `Session ${sessionId}`
    }

    // Theme Helpers
    const isLight = theme === 'light'

    // Sidebar Styles
    const sidebarBg = isLight ? 'bg-white border-slate-200' : 'bg-[#121217]/50 backdrop-blur-xl border-white/5'
    const logoBg = isLight ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-orange-200' : 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]'
    const activeTabClass = isLight
        ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm'
        : 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white border border-transparent'
    const inactiveTabClass = isLight
        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        : 'text-zinc-400 hover:text-white hover:bg-white/5'

    return (
        <div className={`flex h-screen font-sans overflow-hidden selection:bg-orange-500/30 ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#09090b] text-white'}`}>

            {/* SIDEBAR */}
            <aside className={`w-72 border-r flex flex-col z-50 transition-colors duration-300 ${sidebarBg}`}>
                <div className={`p-6 border-b flex items-center gap-3 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                    <div className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center ${logoBg}`}>
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Botzy <span className={isLight ? 'text-orange-500' : 'text-blue-500'}>Pro</span></h1>
                        <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Automation Suite</div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Main Menu</div>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => switchTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group border border-transparent ${activeTab === tab.id
                                ? activeTabClass
                                : inactiveTabClass
                                }`}
                        >
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'animate-pulse' : isLight ? 'text-slate-400 group-hover:text-orange-500' : 'text-zinc-500 group-hover:text-blue-400'}`} />
                            {tab.label}
                        </button>
                    ))}

                    {/* ACTIVE SESSIONS */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Sessions</div>
                            <div className={`text-[10px] font-mono px-2 rounded-full ${isLight ? 'bg-orange-100 text-orange-600' : 'text-gray-600 bg-white/5'}`}>{sessions.length}</div>
                        </div>

                        <div className="space-y-1">
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => switchTab(s.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm cursor-pointer transition-all border border-transparent ${activeTab === s.id
                                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-500'
                                        : isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/5 text-zinc-400'
                                        }`}
                                >
                                    <Globe className="w-4 h-4 text-green-500" />
                                    <div className="flex-1 truncate text-xs">{getSessionLabel(s.id)}</div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); closeSession(s.id) }}
                                        className="p-1 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <div className={`px-4 py-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/5 text-zinc-600'}`}>
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
                        className={`w-full flex items-center gap-2 justify-center py-2 text-xs font-bold transition-colors ${activeTab === 'settings' ? 'text-orange-600' : isLight ? 'text-slate-500 hover:text-orange-600' : 'text-zinc-500 hover:text-white'}`}
                    >
                        <Settings className="w-4 h-4" /> System Settings
                    </button>
                </div>
            </aside>

            {/* MAIN AREA */}
            <main className={`flex-1 flex flex-col relative transition-colors duration-300 ${isLight ? 'bg-slate-50' : 'bg-[#09090b]'}`}>
                <div className="flex-1 overflow-hidden relative">
                    {/* Render Pages conditionally/absolutely for persistence */}
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><DashboardPage /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'accounts' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><UnifiedAccountsPage /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'orders' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><OrdersPage /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'cart' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><CartPage logs={logs} setLogs={setLogs} /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'cards' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><CardsPage /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'analytics' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><AnalyticsPage /></div>
                    <div className={`absolute inset-0 overflow-y-auto transition-opacity duration-300 ${activeTab === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><SettingsPage theme={theme} setTheme={setTheme} /></div>

                    {/* SESSION CONTROLS - BROWSER VIEW HEADER */}
                    {sessions.find(s => s.id === activeTab) && (
                        <div className={`absolute top-0 left-0 right-0 h-12 border-b flex items-center px-4 gap-4 z-50 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#18181b] border-white/10'}`}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => (window as any).electron.ipcRenderer.invoke('session:go-back', activeTab)} className={`p-2 rounded transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-orange-600' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`} title="Back">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <button onClick={() => (window as any).electron.ipcRenderer.invoke('session:reload', activeTab)} className={`p-2 rounded transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-orange-600' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`} title="Reload">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                                </button>
                            </div>

                            <div className={`flex-1 rounded h-8 flex items-center px-3 text-xs font-mono truncate border select-all ${isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-black/50 text-zinc-400 border-white/5'}`}>
                                {(sessions.find(s => s.id === activeTab) as any)?.url || 'Loading...'}
                            </div>
                        </div>
                    )}

                    {/* UPDATE NOTIFICATION BANNER */}
                    {updateStatus !== 'none' && (
                        <div className={`absolute bottom-6 right-6 p-4 rounded-xl shadow-2xl border flex items-center gap-4 z-50 animate-bounce-in ${isLight ? 'bg-white border-blue-200 shadow-blue-900/10' : 'bg-slate-800 border-slate-700 shadow-black/50'}`}>
                            <div className={`p-3 rounded-full ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                                <CloudLightning className="w-6 h-6" />
                            </div>
                            <div className="min-w-[200px]">
                                <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {updateStatus === 'available' && 'Update Available'}
                                    {updateStatus === 'downloading' && 'Downloading Update...'}
                                    {updateStatus === 'ready' && 'Update Ready!'}
                                </h3>

                                {updateStatus === 'downloading' && (
                                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${updateProgress}%` }} />
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
                                        <button
                                            onClick={() => setUpdateStatus('none')}
                                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-bold rounded transition-colors"
                                        >
                                            Later
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
