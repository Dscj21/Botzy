import { useState, useEffect } from 'react'
import { Trash2, ShoppingCart, Zap, CreditCard } from 'lucide-react'

export function CartPage({ logs, setLogs }: { logs: string[], setLogs: React.Dispatch<React.SetStateAction<string[]>> }) {
    const [targetUrl, setTargetUrl] = useState(() => localStorage.getItem('targetUrl') || '')
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccounts, setSelectedAccounts] = useState<number[]>([])

    const handleSaveUrl = () => {
        localStorage.setItem('targetUrl', targetUrl)
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] URL Saved!`, ...prev])
    }

    useEffect(() => {
        loadAccounts()
    }, [])

    const loadAccounts = async () => {
        const accs = await (window as any).electron.ipcRenderer.invoke('db:get-accounts')
        setAccounts(accs)
    }

    const toggleAccount = (id: number) => {
        if (selectedAccounts.includes(id)) {
            setSelectedAccounts(prev => prev.filter(x => x !== id))
        } else {
            setSelectedAccounts(prev => [...prev, id])
        }
    }

    const runAutomation = async (action: string) => {
        if (selectedAccounts.length === 0) {
            alert('Select at least one account')
            return
        }

        const ipc = (window as any).electron.ipcRenderer

        for (const accId of selectedAccounts) {
            const acc = accounts.find(a => a.id === accId)
            if (!acc) continue

            const label = acc.label || acc.username || `Account ${acc.id}`
            setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] Initializing...`, ...prev])

            // Determine URL based on action and platform
            let baseUrl = 'https://www.flipkart.com'

            if (action === 'empty-cart') {
                if (acc.platform === 'FLP') baseUrl = 'https://www.flipkart.com/viewcart'
                else if (acc.platform === 'AMZ') baseUrl = 'https://www.amazon.in/gp/cart/view.html'
                else if (acc.platform === 'SHP') baseUrl = 'https://www.shopsy.in/viewcart'
            } else if (action === 'add-to-cart') {
                // Use the product URL directly for add-to-cart!
                baseUrl = targetUrl
            } else if (action === 'verify-address') {
                if (acc.platform === 'FLP' || acc.platform === 'SHP') baseUrl = 'https://www.flipkart.com/account/addresses'
                else if (acc.platform === 'AMZ') baseUrl = 'https://www.amazon.in/a/addresses'
            }

            try {
                setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] Opening session...`, ...prev])

                const result = await ipc.invoke('session:open', {
                    accountId: accId,
                    url: baseUrl,
                    background: true
                })

                if (result) {
                    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] Loading page...`, ...prev])

                    // Reduced wait time from 5s to 3s
                    await new Promise(r => setTimeout(r, 3000))

                    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] Executing ${action}...`, ...prev])

                    ipc.send('automation:run', {
                        sessionId: accId.toString(),
                        command: action,
                        data: { url: targetUrl }
                    })

                    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] ✓ Command sent!`, ...prev])

                } else {
                    setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] ✗ Failed to create session`, ...prev])
                }
            } catch (e) {
                setLogs(prev => [`[${new Date().toLocaleTimeString()}] [${label}] ✗ Error: ${e}`, ...prev])
            }
        }
    }

    const viewSession = async (accId: number) => {
        const acc = accounts.find(a => a.id === accId)
        // Direct to cart for better debugging
        let baseUrl = 'https://www.flipkart.com/viewcart?marketplace=FLIPKART'
        if (acc?.platform === 'AMZ') baseUrl = 'https://www.amazon.in/gp/cart/view.html'
        if (acc?.platform === 'SHP') baseUrl = 'https://www.shopsy.in/viewcart'

        await (window as any).electron.ipcRenderer.invoke('session:open', {
            accountId: accId,
            url: baseUrl,
            background: false
        })
    }

    return (
        <div className="flex h-full p-6 gap-6">
            <div className="w-[400px] flex flex-col gap-6">
                <div className="flex items-center gap-3 mb-2">
                    <ShoppingCart className="w-8 h-8 text-blue-400" />
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Cart & Checkout Manager
                    </h1>
                </div>

                <div className="bg-[#1e293b] rounded-lg p-6 border border-gray-700 shadow-lg">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                        Target Product URL
                    </label>
                    <div className="flex gap-2">
                        <input
                            className="w-full bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-sm text-blue-100 focus:border-blue-500 outline-none"
                            value={targetUrl}
                            onChange={e => setTargetUrl(e.target.value)}
                            placeholder="https://flipkart.com/..."
                        />
                        <button
                            onClick={handleSaveUrl}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded font-bold text-sm transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </div>

                <div className="bg-[#1e293b] rounded-lg p-6 border border-gray-700 shadow-lg">
                    <h3 className="text-sm font-bold text-orange-400 uppercase mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Automation Actions (Headless)
                    </h3>

                    <div className="space-y-3">
                        <button
                            onClick={() => runAutomation('empty-cart')}
                            className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-800/50 py-3 rounded flex items-center justify-center gap-2 transition-all group"
                        >
                            <span className="bg-red-500/20 px-2 py-0.5 rounded text-xs">1.</span>
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Empty Cart
                        </button>

                        <button
                            onClick={() => runAutomation('add-to-cart')}
                            className="w-full bg-blue-900/30 hover:bg-blue-900/50 text-blue-200 border border-blue-800/50 py-3 rounded flex items-center justify-center gap-2 transition-all group"
                        >
                            <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">2.</span>
                            <ShoppingCart className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Add to Cart
                        </button>

                        <button
                            onClick={() => runAutomation('camp-checkout')}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded shadow-lg shadow-orange-900/50 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-1 active:scale-95"
                        >
                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">3.</span>
                            <CreditCard className="w-5 h-5 animate-pulse" />
                            Checkout
                        </button>
                    </div>

                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded text-xs text-blue-200">
                        <div className="font-bold mb-1">💡 Faster automation:</div>
                        <div className="text-blue-300/80">
                            • Reduced wait time to 3 seconds<br />
                            • Watch logs for real-time progress<br />
                            • Click "OPEN" to view session
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-black/50 rounded-lg p-3 overflow-hidden flex flex-col min-h-[200px] border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500">LIVE LOGS</span>
                        <button onClick={() => setLogs([])} className="text-[10px] text-gray-600 hover:text-white">CLEAR</button>
                    </div>
                    <div className="flex-1 overflow-y-auto text-xs font-mono space-y-1 pr-1 custom-scrollbar">
                        {logs.length === 0 && <span className="text-gray-700 italic">No logs yet...</span>}
                        {logs.map((L, i) => (
                            <div key={i} className={`${L.includes('✓') ? 'text-green-400' : L.includes('✗') || L.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                                {L}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-[#1e293b] rounded-lg p-6 border border-gray-700 shadow-lg flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-300">Select Accounts ({selectedAccounts.length})</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedAccounts(accounts.map(a => a.id))}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => setSelectedAccounts([])}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {accounts.map(acc => (
                        <div
                            key={acc.id}
                            onClick={() => toggleAccount(acc.id)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedAccounts.includes(acc.id)
                                ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                : 'bg-gray-800/30 border-gray-700 hover:bg-gray-800'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAccounts.includes(acc.id)
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-500'
                                        }`}>
                                        {selectedAccounts.includes(acc.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{acc.username || `Account ${acc.id}`}</div>
                                        <div className="text-xs text-blue-400 uppercase font-bold">{acc.platform}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        viewSession(acc.id)
                                    }}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded transition-colors"
                                >
                                    OPEN
                                </button>
                            </div>
                        </div>
                    ))}
                    {accounts.length === 0 && (
                        <div className="text-center text-gray-500 py-10">No accounts found. Go to Accounts page.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
