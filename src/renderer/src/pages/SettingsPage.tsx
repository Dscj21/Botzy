import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Moon, Sun, MapPin, CheckSquare, Square, Play, RefreshCw, Loader2, Save, Download, Upload, Database } from 'lucide-react'

interface SettingsProps {
    theme: 'dark' | 'light';
    setTheme: (t: 'dark' | 'light') => void;
}

interface Account {
    id: number;
    platform: string;
    username: string;
    label?: string;
}

export function SettingsPage({ theme, setTheme }: SettingsProps) {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    // Target Address State
    const [targetAddress, setTargetAddress] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        mobile: '',
        gst: ''
    })
    const [appendCode, setAppendCode] = useState(false)

    // Execution State
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncStatuses, setSyncStatuses] = useState<Record<number, 'pending' | 'syncing' | 'success' | 'failed'>>({})
    const [logs, setLogs] = useState<string[]>([])

    // Load saved address
    useEffect(() => {
        const saved = localStorage.getItem('bulk_target_address')
        if (saved) {
            try {
                setTargetAddress(JSON.parse(saved))
            } catch (e) { }
        }
    }, [])

    // Autosave (keep this for convenience)
    useEffect(() => {
        localStorage.setItem('bulk_target_address', JSON.stringify(targetAddress))
    }, [targetAddress])

    const manualSaveAddress = () => {
        localStorage.setItem('bulk_target_address', JSON.stringify(targetAddress))
        alert('Address Saved Successfully!')
    }

    const loadAccounts = async () => {
        try {
            console.log("SettingsPage: calling api.getAccounts()")
            const accs = await api.getAccounts()
            console.log("SettingsPage: got accounts", accs)
            setAccounts(accs)
        } catch (e) {
            console.error("Failed to load accounts", e)
        }
    }

    useEffect(() => {
        loadAccounts()
    }, [])

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === accounts.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(accounts.map(a => a.id)))
    }

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

    const handleSync = async () => {
        if (selectedIds.size === 0) return
        setIsSyncing(true)
        setLogs([])
        addLog(`Starting sync for ${selectedIds.size} accounts...`)

        const ipc = (window as any).electron.ipcRenderer
        const ids = Array.from(selectedIds)

        for (const id of ids) {
            setSyncStatuses(prev => ({ ...prev, [id]: 'syncing' }))
            const account = accounts.find(a => a.id === id)
            if (!account) continue

            addLog(`Syncing Address for ${account.username}...`)

            try {
                // 1. Create/Restore Session
                await ipc.invoke('session:create', account.id.toString(), 'https://www.flipkart.com/account/login?ret=/account/addresses', undefined, true)

                // 2. Wait for Load (Give it time to auto-login if saved)
                addLog(`Waiting for session load (${account.username})...`)
                await new Promise(r => setTimeout(r, 8000))

                // 3. Prepare Payload
                let finalName = targetAddress.name
                if (appendCode) {
                    if (account.username.includes('@')) {
                        const prefix = account.username.split('@')[0].slice(0, 6);
                        finalName = `${targetAddress.name} ${prefix}`;
                    } else {
                        finalName = `${targetAddress.name} ${Math.floor(Math.random() * 9000 + 1000)}`;
                    }
                }

                const payload = {
                    type: 'profile-update',
                    ...targetAddress,
                    name: finalName
                }

                // 4. Run Automation
                ipc.send('automation:run-target', account.id.toString(), 'update-profile-auto', payload)

                // 5. Wait for execution
                addLog(`Automation running for ${account.username}. Waiting 45s...`)
                await new Promise(r => setTimeout(r, 45000))

                // 6. Close Session
                await ipc.invoke('session:close', account.id.toString())

                setSyncStatuses(prev => ({ ...prev, [id]: 'success' }))
                addLog(`Success: ${account.username}`)

            } catch (e: any) {
                console.error(e)
                setSyncStatuses(prev => ({ ...prev, [id]: 'failed' }))
                addLog(`Failed: ${account.username} - ${e.message}`)
            }
        }

        setIsSyncing(false)
        addLog('Bulk Sync Completed.')
    }

    // Styles based on Theme
    const isLight = theme === 'light'
    const pageBg = isLight ? 'bg-slate-50 text-slate-800' : 'text-white'
    const cardClass = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-black/40 border border-white/10'
    const inputClass = isLight
        ? 'w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-400'
        : 'w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-green-500 outline-none transition-colors'


    // Header Icon
    const iconContainerClass = isLight ? 'bg-white border border-slate-200 shadow-sm text-green-600' : 'bg-green-500/10 text-green-500'

    const primaryBtnClass = isLight
        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md shadow-green-200'
        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'

    return (
        <div className={`p-8 h-full overflow-y-auto ${pageBg}`}>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${iconContainerClass}`}>
                        <MapPin className="w-8 h-8" />
                    </div>
                    Bulk Address Manager
                    <span className="ml-4 text-xs font-mono text-red-500 bg-red-100 px-2 py-1 rounded">
                        Debug: {accounts.length} accs
                    </span>
                </h1>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${cardClass}`}>
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-orange-500" />}
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-sm font-medium hover:underline">
                        Switch Theme
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT: Configuration */}
                <div className="lg:col-span-4 space-y-6">
                    <div className={`p-6 rounded-xl ${cardClass}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className={`text-lg font-semibold ${isLight ? 'text-green-700' : 'text-green-400'}`}>Target Address Details</h2>
                            <button
                                onClick={manualSaveAddress}
                                className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition-colors ${isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <Save className="w-3 h-3" /> Save
                            </button>
                        </div>
                        <div className="space-y-4">
                            <input
                                placeholder="Full Name"
                                className={inputClass}
                                value={targetAddress.name}
                                onChange={e => setTargetAddress({ ...targetAddress, name: e.target.value })}
                            />
                            <input
                                placeholder="Mobile Number"
                                className={inputClass}
                                value={targetAddress.mobile}
                                onChange={e => setTargetAddress({ ...targetAddress, mobile: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    placeholder="Pincode"
                                    className={inputClass}
                                    value={targetAddress.pincode}
                                    onChange={e => setTargetAddress({ ...targetAddress, pincode: e.target.value })}
                                />
                                <input
                                    placeholder="City"
                                    className={inputClass}
                                    value={targetAddress.city}
                                    onChange={e => setTargetAddress({ ...targetAddress, city: e.target.value })}
                                />
                            </div>
                            <input
                                placeholder="State"
                                className={inputClass}
                                value={targetAddress.state}
                                onChange={e => setTargetAddress({ ...targetAddress, state: e.target.value })}
                            />
                            <textarea
                                placeholder="Address (House No, Building, Street)"
                                className={`${inputClass} h-24 resize-none`}
                                value={targetAddress.address}
                                onChange={e => setTargetAddress({ ...targetAddress, address: e.target.value })}
                            />
                            <input
                                placeholder="GST Number (Optional)"
                                className={inputClass}
                                value={targetAddress.gst}
                                onChange={e => setTargetAddress({ ...targetAddress, gst: e.target.value })}
                            />
                            <label className={`flex items-center gap-2 cursor-pointer select-none text-sm ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                                <input
                                    type="checkbox"
                                    checked={appendCode}
                                    onChange={e => setAppendCode(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-500 text-green-600 focus:ring-green-500"
                                />
                                <span>Append Random Code to Name</span>
                            </label>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className={`p-6 rounded-xl ${cardClass}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className={`text-lg font-semibold flex items-center gap-2 ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                                <Database className="w-4 h-4" /> Data Management
                            </h2>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    addLog('Starting Backup...')
                                    try {
                                        const res = await (window as any).electron.ipcRenderer.invoke('db:export-all')
                                        if (res.success) addLog(`Backup Saved: ${res.path}`)
                                        else addLog('Backup Cancelled or Failed')
                                    } catch (e: any) { addLog('Backup Error: ' + e.message) }
                                }}
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${isLight ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
                            >
                                <Download className="w-4 h-4" /> Backup
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('Restoring data will merge/overwrite current data. Continue?')) return
                                    addLog('Starting Restore...')
                                    try {
                                        const res = await (window as any).electron.ipcRenderer.invoke('db:import-all')
                                        if (res.success) {
                                            addLog('Restore Success! Refreshing...')
                                            setTimeout(() => window.location.reload(), 1500)
                                        }
                                        else addLog('Restore Cancelled or Failed: ' + (res.error || ''))
                                    } catch (e: any) { addLog('Restore Error: ' + e.message) }
                                }}
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${isLight ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'}`}
                            >
                                <Upload className="w-4 h-4" /> Restore
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className={`p-6 rounded-xl border border-red-500/30 ${isLight ? 'bg-red-50/50' : 'bg-red-900/10'}`}>
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-red-500 mb-4">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Danger Zone
                        </h2>
                        <button
                            onClick={async () => {
                                const confirmText = prompt("Type 'DELETE' to confirm wiping all data (Accounts, Profiles, Orders). This cannot be undone.", "")
                                if (confirmText === 'DELETE') {
                                    addLog('Initiating Factory Reset...')
                                    try {
                                        const res = await (window as any).electron.ipcRenderer.invoke('db:factory-reset')
                                        if (res.success) {
                                            alert('Reset Complete. The application will now reload.')
                                            window.location.reload()
                                        } else {
                                            alert('Reset Failed: ' + res.error)
                                        }
                                    } catch (e: any) {
                                        addLog('Reset Error: ' + e.message)
                                    }
                                }
                            }}
                            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors bg-red-500 hover:bg-red-600 text-white"
                        >
                            <span className="font-mono">[!]</span> Factory Reset Application
                        </button>
                    </div>

                    {/* LOGS */}
                    <div className={`p-4 rounded-xl ${cardClass} h-64 overflow-y-auto font-mono text-xs`}>
                        <div className="text-zinc-500 mb-2 font-bold uppercase tracking-wider">Activity Log</div>
                        {logs.length === 0 && <div className="text-zinc-500 italic">Logs will appear here...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={`mb-1 border-b pb-1 ${isLight ? 'text-slate-600 border-slate-100' : 'text-zinc-300 border-white/5'}`}>{log}</div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Account Selection */}
                <div className="lg:col-span-8 space-y-6">
                    <div className={`p-6 rounded-xl ${cardClass} min-h-[600px] flex flex-col`}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <CheckSquare className={`w-5 h-5 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
                                Select Accounts to Sync
                                <span className="text-sm font-normal text-zinc-500 ml-2">({selectedIds.size} selected)</span>
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={loadAccounts}
                                    className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-white'}`}
                                    title="Refresh List"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSync}
                                    disabled={isSyncing || selectedIds.size === 0}
                                    className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isSyncing || selectedIds.size === 0
                                        ? 'bg-zinc-500 cursor-not-allowed opacity-50 text-white'
                                        : primaryBtnClass
                                        }`}
                                >
                                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    {isSyncing ? 'Syncing...' : 'Sync Address to Selected'}
                                </button>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className={`grid grid-cols-12 gap-4 p-3 rounded-t-lg border-b text-xs font-bold uppercase tracking-wider ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-black/40 border-white/10 text-zinc-400'}`}>
                            <div className="col-span-1 flex items-center justify-center">
                                <button onClick={toggleSelectAll}>
                                    {selectedIds.size === accounts.length && accounts.length > 0 ? (
                                        <CheckSquare className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Square className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            <div className="col-span-2">Platform</div>
                            <div className="col-span-6">Account</div>
                            <div className="col-span-3 text-right">Status</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex-1 overflow-y-auto">
                            {accounts.length === 0 ? (
                                <div className="text-center py-20 text-zinc-500">
                                    No accounts found in database. Go to Dashboard to add accounts.
                                </div>
                            ) : (
                                accounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        onClick={() => toggleSelect(acc.id)}
                                        className={`grid grid-cols-12 gap-4 p-3 border-b items-center cursor-pointer transition-colors ${isLight
                                            ? `border-slate-100 hover:bg-slate-50 ${selectedIds.has(acc.id) ? 'bg-blue-50/50' : ''}`
                                            : `border-white/5 hover:bg-white/5 ${selectedIds.has(acc.id) ? 'bg-white/[0.02]' : ''}`
                                            }`}
                                    >
                                        <div className="col-span-1 flex items-center justify-center">
                                            {selectedIds.has(acc.id) ? (
                                                <CheckSquare className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Square className={`w-4 h-4 ${isLight ? 'text-slate-300' : 'text-zinc-600'}`} />
                                            )}
                                        </div>
                                        <div className={`col-span-2 text-xs uppercase font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                                            {acc.platform || 'General'}
                                        </div>
                                        <div className="col-span-6 font-medium text-sm">
                                            {acc.username}
                                            {acc.label && <span className="ml-2 text-xs text-zinc-500">({acc.label})</span>}
                                        </div>
                                        <div className="col-span-3 text-right">
                                            {syncStatuses[acc.id] ? (
                                                <span className={`text-xs px-2 py-1 rounded-full ${syncStatuses[acc.id] === 'success' ? 'bg-green-500/20 text-green-500' :
                                                    syncStatuses[acc.id] === 'failed' ? 'bg-red-500/20 text-red-500' :
                                                        'bg-blue-500/20 text-blue-500'
                                                    }`}>
                                                    {syncStatuses[acc.id]}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-500">Ready</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
