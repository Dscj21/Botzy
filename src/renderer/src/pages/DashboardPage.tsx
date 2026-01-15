import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Bar } from 'react-chartjs-2' // Wait, I need Chart.js registration here too if I use Bar? 
// No, usually registered globally or I should import types. 
// Actually, I'll just keep it simple. Dashboard usually has a chart.

// Re-register ChartJS components for Dashboard explicitly to avoid issues
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export function DashboardPage() {
  const [stats, setStats] = useState({ totalOrders: 0, pending: 0, spend: 0 })
  const [quickBuyUrl, setQuickBuyUrl] = useState('')
  const [quickBuyAccount, setQuickBuyAccount] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const accs = await api.getAccounts()
    setAccounts(accs)
    if (accs.length > 0) setQuickBuyAccount(accs[0].id.toString())

    // Mock Stats or fetch from DB
    const orders = await (window as any).electron.ipcRenderer.invoke('db:get-orders')
    setStats({
      totalOrders: orders.length,
      pending: orders.filter((o: any) => o.status === 'Ordered').length,
      spend: orders.reduce((acc: number, o: any) => acc + (parseFloat(o.price?.replace(/[^\d.]/g, '') || '0')), 0)
    })
  }

  const handleQuickBuy = async () => {
    if (!quickBuyUrl) return alert('Enter URL')
    // Open session background
    await api.openSession(quickBuyAccount, quickBuyUrl, true)
    // Run automation
    await (window as any).electron.ipcRenderer.invoke('automation:add-to-cart', { id: quickBuyAccount, url: quickBuyUrl })
    alert('Quick Buy Started in Background!')
  }

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Daily Spend (₹)',
        data: [1200, 1900, 300, 500, 200, 3000, 4500],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      },
    ],
  }

  return (
    <div className="p-8 text-gray-100 h-full overflow-y-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            Welcome back, Owner
          </h1>
          <p className="text-gray-400 mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#1e293b] px-4 py-2 rounded-lg border border-gray-700 text-sm">
            <span className="text-gray-400">System Status:</span> <span className="text-green-400 font-bold">● Operations Normal</span>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Orders" value={stats.totalOrders} icon="📦" color="bg-blue-500" />
        <StatCard title="Pending Delivery" value={stats.pending} icon="🚚" color="bg-orange-500" />
        <StatCard title="Total Spend" value={`₹${stats.spend.toLocaleString()}`} icon="💰" color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CHART */}
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-gray-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold mb-4 text-gray-300">Weekly Performance</h3>
          <Bar options={{ responsive: true }} data={chartData} />
        </div>

        {/* QUICK ACTIONS */}
        <div className="bg-[#1e293b] rounded-xl border border-gray-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold mb-4 text-gray-300">⚡ Quick Buy</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Account</label>
              <select
                className="w-full bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                value={quickBuyAccount}
                onChange={e => setQuickBuyAccount(e.target.value)}
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.label} ({a.platform})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Product URL</label>
              <input
                className="w-full bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                placeholder="https://..."
                value={quickBuyUrl}
                onChange={e => setQuickBuyUrl(e.target.value)}
              />
            </div>
            <button
              onClick={handleQuickBuy}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition-all"
            >
              Launch Automation 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-lg flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg ${color} bg-opacity-20 flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      <div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}
