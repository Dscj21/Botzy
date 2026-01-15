import { X, Search, ShoppingCart, Loader } from 'lucide-react'
import { useState, useEffect } from 'react'


export function GlobalSearch({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)



    const handleSearch = async () => {
        if (!query) { setResults([]); return }
        setLoading(true)
        try {
            // This IPC needs to be handled in main/ipcHandlers or we search locally
            // For now, let's search orders and products
            // Or just trigger the Universal Loop
            // Actually, let's search ORDERS locally in DB
            const res = await (window as any).electron.ipcRenderer.invoke('db:get-orders')
            const filtered = res.filter(o =>
                o.product_name.toLowerCase().includes(query.toLowerCase()) ||
                o.order_id.toLowerCase().includes(query.toLowerCase())
            )
            setResults(filtered)
        } catch (e) { }
        setLoading(false)
    }

    useEffect(() => {
        const timeOutId = setTimeout(() => handleSearch(), 500)
        return () => clearTimeout(timeOutId)
    }, [query])

    const openResult = async (res) => {
        // If it's an order, maybe open the account orders page?
        // For now just alert
        alert(`Order: ${res.order_id} - ${res.status}`)
    }

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20">
            <div className="w-[600px] bg-[#1e293b] rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[600px]">
                <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                    <Search className="text-gray-400 w-5 h-5" />
                    <input
                        autoFocus
                        className="flex-1 bg-transparent text-white outline-none text-lg"
                        placeholder="Search orders, products, accounts (Global)..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading && <div className="p-4 text-center text-gray-500"><Loader className="animate-spin inline mr-2" /> Searching...</div>}

                    {!loading && results.map((r, i) => (
                        <div key={i} onClick={() => openResult(r)} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded cursor-pointer group">
                            <div className="p-2 bg-blue-500/20 rounded text-blue-400"><ShoppingCart className="w-4 h-4" /></div>
                            <div className="flex-1">
                                <div className="font-medium text-gray-200">{r.product_name}</div>
                                <div className="text-xs text-gray-500">{r.order_id} • {r.platform}</div>
                            </div>
                            <div className="text-sm font-bold text-gray-400">{r.price}</div>
                        </div>
                    ))}

                    {!loading && query && results.length === 0 && (
                        <div className="p-8 text-center text-gray-500">No results found</div>
                    )}
                </div>
            </div>
        </div>
    )
}
