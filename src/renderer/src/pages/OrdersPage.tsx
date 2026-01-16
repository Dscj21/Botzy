import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { RefreshCw, Download, Trash2, Search, CheckSquare, Filter } from 'lucide-react'

export function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [isSyncing, setIsSyncing] = useState(false)
  const [currentSyncAccount, setCurrentSyncAccount] = useState('')

  // Sync Selection
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set())
  const [showSyncModal, setShowSyncModal] = useState(false)

  /* Helper Functions */
  async function loadOrders() {
    const data = await (window as any).electron.ipcRenderer.invoke('db:get-orders')
    setOrders(data)
  }

  async function loadAccounts() {
    const accs = await (window as any).electron.ipcRenderer.invoke('db:get-accounts')
    setAccounts(accs)
    setSelectedAccountIds(new Set(accs.map((a: any) => a.id)))
  }

  const toggleAccount = (id: number) => {
    const newSet = new Set(selectedAccountIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedAccountIds(newSet)
  }

  const toggleAll = () => {
    if (selectedAccountIds.size === accounts.length) setSelectedAccountIds(new Set())
    else setSelectedAccountIds(new Set(accounts.map((a: any) => a.id)))
  }

  const stopSyncRef = useRef(false)

  const handleStartSync = async () => {
    if (selectedAccountIds.size === 0) return alert('Please select at least one account')
    setShowSyncModal(false)
    setIsSyncing(true)
    stopSyncRef.current = false

    const targets = accounts.filter((a) => selectedAccountIds.has(a.id))

    for (const acc of targets) {
      if (stopSyncRef.current) {
        console.log('[Sync] Stopped by user.')
        break
      }

      const name = acc.label || acc.username || `Account ${acc.id}`
      setCurrentSyncAccount(name)

      const url =
        acc.platform === 'AMZ'
          ? 'https://www.amazon.in/gp/css/order-history'
          : 'https://www.flipkart.com/account/orders'

      console.log(`[Sync] Opening session for ${name} at ${url}`)
      // BACKGROUND MODE (Headless) as requested
      await api.openSession(acc.id.toString(), url, true)
      // Initial wait to allow page load
      await new Promise((r) => setTimeout(r, 6000))
    }

    if (stopSyncRef.current) {
      setIsSyncing(false)
      setCurrentSyncAccount('')
      return
    }

    // Fallback timeout
    const timeout = targets.length * 180000
    setTimeout(() => {
      if (isSyncing) {
        setIsSyncing(false)
        setCurrentSyncAccount('')
        loadOrders()
      }
    }, timeout)
  }

  const handleStopSync = () => {
    stopSyncRef.current = true
    setIsSyncing(false)
    setCurrentSyncAccount('')
    // Optionally kill all sessions?
    // (window as any).electron.ipcRenderer.invoke('session:hide-all')
  }

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to delete ALL order history? This cannot be undone.'))
      return
    await (window as any).electron.ipcRenderer.invoke('db:clear-orders')
    setOrders([])
  }

  /* Effects */
  useEffect(() => {
    loadOrders()
    loadAccounts()

    const ipc = (window as any).electron.ipcRenderer
    const onOrdersUpdated = () => {
      console.log('[OrdersPage] Orders updated, reloading...')
      loadOrders()
    }
    const onSyncComplete = () => {
      console.log('[OrdersPage] Sync complete signal received.')
      setIsSyncing(false)
      setCurrentSyncAccount('')
      loadOrders()
    }

    ipc.on('orders:updated', onOrdersUpdated)
    ipc.on('orders:sync-complete', onSyncComplete)

    const interval = setInterval(loadOrders, 10000)
    return () => {
      clearInterval(interval)
      ipc.removeListener('orders:updated', onOrdersUpdated)
      ipc.removeListener('orders:sync-complete', onSyncComplete)
    }
  }, [])

  const formatDateDisplay = (iso: string) => {
    if (!iso) return '-'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return iso
      // Enforce DD/MM/YYYY
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    } catch (e) {
      return iso
    }
  }

  /* Inline Edit Component */
  const InlineEdit = ({
    orderId,
    field,
    value,
    onUpdate
  }: {
    orderId: string
    field: string
    value: string
    onUpdate: () => void
  }) => {
    const [editing, setEditing] = useState(false)
    const [tempValue, setTempValue] = useState(value || '')

    const handleSave = async () => {
      if (tempValue !== value) {
        await (window as any).electron.ipcRenderer.invoke('db:update-order-field', {
          order_id: orderId,
          field,
          value: tempValue
        })
        onUpdate()
      }
      setEditing(false)
    }

    if (editing) {
      return (
        <input
          autoFocus
          className="w-full bg-slate-700 text-white px-2 py-1 rounded outline-none border border-blue-500 text-xs"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      )
    }

    return (
      <div
        onClick={() => setEditing(true)}
        className={`cursor-pointer min-h-[20px] px-2 py-1 rounded hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-600 flex items-center gap-2 ${!value ? 'text-gray-600 italic' : 'text-emerald-400 font-mono'}`}
      >
        {value || 'Add Card'}
      </div>
    )
  }

  const filteredOrders = orders
    .filter((o) => {
      const matchSearch =
        (o.order_id?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (o.product_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (o.account_id?.toString() || '').includes(search.toLowerCase())
      const matchStatus = statusFilter === 'All' || o.status === statusFilter
      return matchSearch && matchStatus
    })
    // Sort Descending by Date (String ISO comparison works for YYYY-MM-DD)
    .sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''))

  return (
    <div className="p-8 text-gray-100 h-full overflow-y-auto relative">
      {isSyncing && (
        <div className="fixed top-4 right-4 z-50 bg-indigo-900/90 border border-indigo-500 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 backdrop-blur-sm animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <div>
            <div className="font-bold text-sm">Syncing Orders...</div>
            <div className="text-xs text-indigo-200">
              Syncing: <span className="text-yellow-300">{currentSyncAccount}</span>
            </div>
          </div>
          <button
            onClick={handleStopSync}
            className="ml-2 bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded"
          >
            STOP
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-600">
            Order History
          </h1>
          <p className="text-gray-400 mt-1">Track and manage all automation orders</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setShowSyncModal(true)}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-lg ${
              isSyncing ? 'bg-gray-600 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Start Sync (New)'}
          </button>

          {isSyncing && (
            <button
              onClick={handleStopSync}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg"
            >
              <Trash2 className="w-4 h-4" /> {/* Reusing trash icon for stop for now, or X */}
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={async () => await (window as any).electron.ipcRenderer.invoke('db:export-csv')}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* SYNC SELECT MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-2xl w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Select Accounts to Sync</h2>
              <button onClick={toggleAll} className="text-sm text-indigo-400 hover:text-indigo-300">
                {selectedAccountIds.size === accounts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 mb-6 border border-gray-700 rounded p-2 bg-[#0f172a]">
              {accounts.length === 0 && (
                <div className="text-gray-500 text-center py-4">No accounts found</div>
              )}
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id)}
                  className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded cursor-pointer border border-transparent hover:border-gray-600 transition-all select-none"
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border ${selectedAccountIds.has(acc.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-500'}`}
                  >
                    {selectedAccountIds.has(acc.id) && (
                      <CheckSquare className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-200">{acc.label || acc.username}</div>
                    <div className="text-xs text-gray-500">
                      {acc.platform} • {acc.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartSync}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-all transform hover:scale-105"
              >
                Start Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH/FILTER (Same) */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-[#1e293b] border border-gray-700 rounded-lg px-4 py-3 flex items-center gap-2 focus-within:border-blue-500 transition-all">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            className="bg-transparent text-white outline-none flex-1 placeholder-gray-500"
            placeholder="Search Order ID, Product Name, or Account ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            className="bg-[#1e293b] border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-blue-500 appearance-none min-w-[150px] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Ordered">Ordered</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Returned">Returned</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#1e293b] rounded-xl border border-gray-700 overflow-hidden shadow-xl">
        <table className="w-full">
          <thead className="bg-[#0f172a] text-gray-400 text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">Date</th>
              <th className="px-6 py-4 text-left">Account</th>
              <th className="px-6 py-4 text-left">Product</th>
              <th className="px-6 py-4 text-left">Order ID</th>
              <th className="px-6 py-4 text-left">Credit Card</th>
              <th className="px-6 py-4 text-left">Tracking ID</th>
              <th className="px-6 py-4 text-left">Price</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Delivered Date</th>
              <th className="px-6 py-4 text-left">Platform</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            )}
            {filteredOrders.map((order, i) => (
              <tr key={i} className="hover:bg-gray-800/50 transition-colors group">
                <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                  {formatDateDisplay(order.order_date)}
                </td>
                <td className="px-6 py-4 text-sm text-white">
                  {(() => {
                    const acc = accounts.find((a: any) => a.id === order.account_id)
                    return acc ? (
                      <div>
                        <div className="font-bold">{acc.label || acc.username}</div>
                        <div className="text-[10px] text-gray-500 font-mono">ID: {acc.id}</div>
                      </div>
                    ) : (
                      <span className="text-gray-600 italic">Unknown ({order.account_id})</span>
                    )
                  })()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {order.image_url ? (
                      <img
                        src={order.image_url}
                        className="w-10 h-10 rounded object-cover border border-gray-600 bg-white"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-xl">
                        📦
                      </div>
                    )}
                    <span
                      className="font-medium text-white line-clamp-2 max-w-[250px] text-sm"
                      title={order.product_name}
                    >
                      {order.product_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-indigo-400 font-mono select-all font-bold">
                  {order.order_id}
                </td>
                <td className="px-6 py-4 text-sm">
                  <InlineEdit
                    orderId={order.order_id}
                    field="credit_card"
                    value={order.credit_card}
                    onUpdate={loadOrders}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono select-all">
                  {order.tracking_id || '-'}
                </td>
                <td className="px-6 py-4 font-bold text-white text-sm">
                  {order.price ? `₹${order.price}` : '-'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold border capitalize ${
                      order.status === 'Delivered'
                        ? 'bg-green-900/50 text-green-400 border-green-800'
                        : order.status === 'Cancelled'
                          ? 'bg-red-900/50 text-red-400 border-red-800'
                          : order.status === 'Returned'
                            ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800'
                            : order.status === 'Failed'
                              ? 'bg-red-900/50 text-red-400 border-red-800'
                              : 'bg-blue-900/50 text-blue-400 border-blue-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                  {formatDateDisplay(order.delivered_date)}
                </td>
                <td className="px-6 py-4 text-xs text-gray-600">{order.platform}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
