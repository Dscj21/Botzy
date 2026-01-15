import { useState, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
)

export function AnalyticsPage() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalSpend: 0,
        delivered: 0,
        cancelled: 0,
        platformSplit: { FLP: 0, AMZ: 0, SHP: 0 }
    })

    // Aggregated daily data for chart
    const [chartData, setChartData] = useState<{ labels: string[], data: number[] }>({ labels: [], data: [] })

    useEffect(() => {
        (async () => {
            const orders = await (window as any).electron.ipcRenderer.invoke('db:get-orders')

            // 1. Calculate KPI
            let spend = 0
            let del = 0
            let can = 0
            const split = { FLP: 0, AMZ: 0, SHP: 0 }

            // Map for chart aggregation (Date -> Count)
            const dateMap = new Map<string, number>()

            orders.forEach(o => {
                // Spend
                if (o.status !== 'Failed' && o.status !== 'Cancelled') {
                    const priceStr = o.price ? o.price.toString().replace(/[^\d.]/g, '') : '0'
                    const price = parseFloat(priceStr) || 0
                    spend += price
                }

                // Status
                if (o.status === 'Delivered') del++
                if (o.status === 'Cancelled') can++

                // Split
                if (o.platform === 'FLP') split.FLP++
                else if (o.platform === 'AMZ') split.AMZ++
                else if (o.platform === 'SHP') split.SHP++

                // Chart Data (Order Date)
                // Assuming order_date is stored as 'LocaleDateString' or 'YYYY-MM-DD' or similar
                // browser.ts stores it as new Date().toLocaleDateString()
                // Let's normalize to MM/DD
                let d = 'Unknown'
                try {
                    // Try parsing
                    const dateObj = new Date(o.order_date)
                    if (!isNaN(dateObj.getTime())) {
                        d = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`
                    } else {
                        d = o.order_date // Fallback
                    }
                } catch (e) { d = o.order_date }

                dateMap.set(d, (dateMap.get(d) || 0) + 1)
            })

            setStats({
                totalOrders: orders.length,
                totalSpend: spend,
                delivered: del,
                cancelled: can,
                platformSplit: split
            })

            // Prepare Chart Data (Sort by date if possible, but map iteration is insertion order usually.
            // Best to reverse orders array if it comes DESC)

            const labels = Array.from(dateMap.keys()).slice(0, 7).reverse() // Last 7 unique dates
            const data = Array.from(dateMap.values()).slice(0, 7).reverse()

            setChartData({ labels, data })
        })()
    }, [])

    const lineData = {
        labels: chartData.labels.length ? chartData.labels : ['No Data'],
        datasets: [
            {
                label: 'Orders',
                data: chartData.data.length ? chartData.data : [0],
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.5)',
                tension: 0.3
            }
        ],
    }

    const doughnutData = {
        labels: ['Flipkart', 'Amazon', 'Shopsy'],
        datasets: [
            {
                label: '# of Orders',
                data: [stats.platformSplit.FLP, stats.platformSplit.AMZ, stats.platformSplit.SHP],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(16, 185, 129, 1)',
                ],
                borderWidth: 1,
            },
        ],
    }

    return (
        <div className="p-8 text-gray-100 h-full overflow-y-auto">
            <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Analytics Dashboard</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard title="Total Spend" value={`₹${stats.totalSpend.toLocaleString('en-IN')}`} change="Live" color="text-green-400" />
                <KPICard title="Total Orders" value={stats.totalOrders} change="Live" color="text-blue-400" />
                <KPICard title="Delivered" value={stats.delivered} change={stats.totalOrders ? Math.round((stats.delivered / stats.totalOrders) * 100) + '%' : '0%'} color="text-purple-400" />
                <KPICard title="Cancelled" value={stats.cancelled} change={stats.totalOrders ? Math.round((stats.cancelled / stats.totalOrders) * 100) + '%' : '0%'} color="text-red-400" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-xl">
                    <h3 className="text-lg font-bold mb-4 text-gray-300">Order Volume (Recent Activity)</h3>
                    {stats.totalOrders === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-500">No Data Available</div>
                    ) : (
                        <Line options={{ responsive: true, plugins: { legend: { position: 'top' as const } } }} data={lineData} />
                    )}
                </div>
                <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-xl flex flex-col items-center">
                    <h3 className="text-lg font-bold mb-4 text-gray-300">Platform Distribution</h3>
                    <div className="w-64 h-64">
                        {stats.totalOrders === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500">No Data</div>
                        ) : (
                            <Doughnut data={doughnutData} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function KPICard({ title, value, change, color }: any) {
    return (
        <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 shadow-lg hover:shadow-purple-900/20 transition-all cursor-default group">
            <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
            <div className="flex items-end justify-between mt-2">
                <div className="text-3xl font-bold text-white mb-1 group-hover:scale-105 transition-transform origin-left">{value}</div>
                <div className={`text-xs font-bold ${color} bg-opacity-10 bg-gray-600 px-2 py-1 rounded`}>{change}</div>
            </div>
        </div>
    )
}
