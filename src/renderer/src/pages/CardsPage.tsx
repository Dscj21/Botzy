import { useState, useEffect } from 'react'
import {
  Play,
  CreditCard,
  Trash2,
  Save,
  List,
  FileSpreadsheet,
  RefreshCcw,
  Copy,
  Loader2,
  Moon,
  Sun,
  Zap,
  Calendar,
  Search,
  Eye,
  X
} from 'lucide-react'

interface SavedAccount {
  bank: string
  username: string
  password: string
  cardholderName?: string
}

interface VCC {
  number: string
  cvv: string
  expiry: string
  amount: string
  status: string
  created_at?: string
  generated_at?: string
  used_at?: string
  snapshot?: string
}

export function CardsPage() {
  // State
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [bank, setBank] = useState('hdfc')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [cardPassword, setCardPassword] = useState('')
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [confirmMobile, setConfirmMobile] = useState('')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState('100')
  const [count, setCount] = useState('1')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ generated: 0, total: 0, status: 'Idle' })
  const [logs, setLogs] = useState<string[]>([])
  const [history, setHistory] = useState<VCC[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [accounts, setAccounts] = useState<SavedAccount[]>([])

  // New State for Management
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null)

  // Effects
  useEffect(() => {
    const removeLog = (window as any).electron.ipcRenderer.on(
      'automation:log',
      (_e: any, msg: string) => {
        setLogs((prev) => [...prev.slice(-19), msg])
      }
    )
    const removeProgress = (window as any).electron.ipcRenderer.on(
      'automation:progress',
      (_e: any, data: any) => {
        setProgress(data)
        if (activeTab === 'history') fetchHistory()
      }
    )
    return () => {
      removeLog()
      removeProgress()
    }
  }, [activeTab])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('netsafe_accounts_list')
      if (saved) {
        setAccounts(JSON.parse(saved))
      } else {
        const old = localStorage.getItem('netsafe_creds')
        if (old) {
          const p = JSON.parse(old)
          if (p.username)
            setAccounts([{ bank: 'hdfc', username: p.username, password: p.password }])
        }
      }

      const last = localStorage.getItem('netsafe_last_config')
      if (last) {
        const p = JSON.parse(last)
        if (p.amount) setAmount(p.amount)
        if (p.cardholderName) setCardholderName(p.cardholderName)
        if (p.beneficiaryName) setBeneficiaryName(p.beneficiaryName)
        if (p.cardPassword) setCardPassword(p.cardPassword)
        if (p.email) setEmail(p.email)
        if (p.confirmEmail) setConfirmEmail(p.confirmEmail)
        if (p.mobile) setMobile(p.mobile)
        if (p.confirmMobile) setConfirmMobile(p.confirmMobile)
        if (p.message) setMessage(p.message)
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      // Use get-all-vccs to read from the Excel file where cards are saved
      const data = await (window as any).electron.ipcRenderer.invoke('automation:get-all-vccs')
      setHistory(data || [])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleExport = async () => {
    const res = await (window as any).electron.ipcRenderer.invoke('automation:export-vccs')
    if (res.success) {
      alert('Export Successful to ' + res.path)
    } else if (res.error) {
      alert('Export Failed: ' + res.error)
    }
  }

  const handleSaveAccount = () => {
    if (!username || !password) return
    const newAcc = { bank, username, password, cardholderName }
    const exists = accounts.find((a) => a.username === username && a.bank === bank)
    if (exists) {
      const updated = accounts.map((a) => (a.username === username && a.bank === bank ? newAcc : a))
      setAccounts(updated)
      localStorage.setItem('netsafe_accounts_list', JSON.stringify(updated))
    } else {
      const updated = [...accounts, newAcc]
      setAccounts(updated)
      localStorage.setItem('netsafe_accounts_list', JSON.stringify(updated))
    }
  }

  const handleDeleteAccount = (idx: number) => {
    const updated = accounts.filter((_, i) => i !== idx)
    setAccounts(updated)
    localStorage.setItem('netsafe_accounts_list', JSON.stringify(updated))
  }

  const loadAccount = (acc: SavedAccount) => {
    setBank(acc.bank)
    setUsername(acc.username)
    setPassword(acc.password)
    if (acc.cardholderName) setCardholderName(acc.cardholderName)
  }

  const handleDelete = async (ids: string[]) => {
    if (
      !confirm(
        `Are you sure you want to delete ${ids.length} card(s)? This action cannot be undone.`
      )
    )
      return

    try {
      const res = await (window as any).electron.ipcRenderer.invoke('automation:delete-vccs', ids)
      if (res.success) {
        setHistory((prev) => prev.filter((p) => !ids.includes(p.number)))
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
      } else {
        alert('Failed to delete: ' + (res.error?.message || res.error))
      }
    } catch (e) {
      alert('Error deleting cards')
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAllSelection = () => {
    if (selectedIds.length === history.length) setSelectedIds([])
    else setSelectedIds(history.map((h) => h.number))
  }

  const filteredHistory = history.filter((h) => {
    const matchesSearch =
      (h.number || '').includes(searchTerm) || (h.amount || '').includes(searchTerm)
    const matchesDate = !dateFilter || (h.created_at || h.generated_at || '').startsWith(dateFilter)
    return matchesSearch && matchesDate
  })

  const handleStart = () => {
    localStorage.setItem(
      'netsafe_last_config',
      JSON.stringify({
        amount,
        count,
        cardholderName,
        beneficiaryName,
        cardPassword,
        email,
        confirmEmail,
        mobile,
        confirmMobile,
        message
      })
    )

    setIsRunning(true)
    setLogs(['Starting Netsafe Automation...'])
    setProgress({ generated: 0, total: parseInt(count) || 1, status: 'Initializing...' })

    const ipc = (window as any).electron.ipcRenderer
    ipc.send('automation:run', 'create-netsafe', {
      amount,
      count,
      bank,
      username,
      password,
      cardholderName,
      beneficiaryName,
      cardPassword,
      email,
      confirmEmail,
      mobile,
      confirmMobile,
      message
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Styles based on Theme
  const isLight = theme === 'light'
  const pageBg = isLight ? 'bg-slate-50 text-slate-800' : 'text-white'
  const cardClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-black/40 border border-white/10'
  const inputClass = isLight
    ? 'w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-400'
    : 'w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-green-500 outline-none transition-colors'
  const labelClass = isLight
    ? 'block text-xs font-medium text-slate-600 mb-1'
    : 'block text-xs font-medium text-zinc-400 mb-1'

  // Header Icon
  const iconContainerClass = isLight
    ? 'bg-white border border-slate-200 shadow-sm text-orange-600'
    : 'bg-green-500/10 text-green-500'

  // Buttons
  const primaryBtnClass = isLight
    ? 'bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white shadow-md shadow-orange-200'
    : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white'

  const tabActive = isLight
    ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
    : 'bg-green-600 text-white'
  const tabInactive = isLight
    ? 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
    : 'text-zinc-400 hover:text-white'

  return (
    <div className={`p-6 h-full overflow-y-auto ${pageBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${iconContainerClass}`}>
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Virtual Cards</h1>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              Generate and manage HDFC Netsafe cards
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-1 p-1 rounded-lg ${isLight ? 'bg-slate-200/50' : 'bg-white/5'}`}
        >
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'generate' ? tabActive : tabInactive}`}
          >
            Generate VCC
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? tabActive : tabInactive}`}
          >
            History & Export
          </button>
          <div
            className={`ml-2 pl-2 border-l ${isLight ? 'border-slate-300' : 'border-white/10'} flex items-center gap-2`}
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-blue-400" />
            ) : (
              <Sun className="w-4 h-4 text-orange-500" />
            )}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-xs font-medium hover:underline"
            >
              Theme
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: FORM */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Account Selection */}
            <div className={`p-6 rounded-xl ${cardClass}`}>
              <div className="flex items-center justify-between mb-4">
                <h2
                  className={`text-lg font-semibold ${isLight ? 'text-blue-700' : 'text-green-400'}`}
                >
                  Run Automation
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Bank / Provider</label>
                  <select
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    className={inputClass}
                  >
                    <option value="hdfc">HDFC Netsafe</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Username</label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputClass}
                      placeholder="HDFC User ID"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      placeholder="Password"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAccount}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLight ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}
                  >
                    <Save className="w-3 h-3" /> Save Credentials to List
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Generation Config */}
            <div className={`p-6 rounded-xl ${cardClass}`}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Cardholder Name</label>
                  <input
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className={inputClass}
                    placeholder="Your Name on Account"
                  />
                </div>
                <div>
                  <label className={labelClass}>Beneficiary Name</label>
                  <input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className={inputClass}
                    placeholder="Any Name (e.g. john)"
                  />
                </div>

                <div>
                  <label className={labelClass}>Card Password (VCC)</label>
                  <input
                    value={cardPassword}
                    onChange={(e) => setCardPassword(e.target.value)}
                    className={inputClass}
                    placeholder="VCC Login Password"
                  />
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="Email for OTP"
                  />
                </div>
                <div>
                  <label className={labelClass}>Confirm Email</label>
                  <input
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    className={inputClass}
                    placeholder="Confirm Email"
                  />
                </div>

                <div>
                  <label className={labelClass}>Mobile</label>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className={inputClass}
                    placeholder="Mobile for OTP"
                  />
                </div>
                <div>
                  <label className={labelClass}>Confirm Mobile</label>
                  <input
                    value={confirmMobile}
                    onChange={(e) => setConfirmMobile(e.target.value)}
                    className={inputClass}
                    placeholder="Confirm Mobile"
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Customer Message</label>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={inputClass}
                    placeholder="Message"
                  />
                </div>

                <div>
                  <label className={labelClass}>Amount (INR)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={handleStart}
                  disabled={isRunning}
                  className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${isRunning ? 'bg-zinc-600 cursor-not-allowed opacity-50' : primaryBtnClass}`}
                >
                  {isRunning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  {isRunning
                    ? `Running... (${progress.generated}/${progress.total})`
                    : 'Start VCC Generation'}
                </button>

                {isRunning && (
                  <button
                    onClick={() => {
                      setIsRunning(false)
                      setProgress((p) => ({ ...p, status: 'Stopped by User' }))
                      const ipc = (window as any).electron.ipcRenderer
                      ipc.send('automation:stop', 'netsafe')
                    }}
                    className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg transition-colors"
                  >
                    STOP
                  </button>
                )}
                {isRunning && (
                  <div className="text-center text-xs text-zinc-500 mt-2 animate-pulse">
                    {progress.status}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Terminal */}
            {isRunning && (
              <div className="bg-black rounded-xl p-4 font-mono text-xs h-48 overflow-y-auto border border-white/10 shadow-inner">
                <div className="text-green-500 mb-2 font-bold uppercase flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Live Execution Logs
                </div>
                <div className="space-y-1">
                  {logs.map((L, i) => (
                    <div key={i} className="text-zinc-300 border-l-2 border-zinc-800 pl-2">
                      {L}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: SAVED ACCOUNTS */}
          <div className="lg:col-span-4">
            <div className={`p-6 rounded-xl ${cardClass} h-full`}>
              <div className="flex items-center gap-2 mb-6">
                <Users className={`w-5 h-5 ${isLight ? 'text-blue-500' : 'text-green-400'}`} />
                <h2 className="font-semibold">Saved Accounts</h2>
              </div>

              <div className="space-y-3">
                {accounts.length === 0 && (
                  <div className="text-sm text-zinc-500 italic">No saved accounts yet.</div>
                )}
                {accounts.map((acc, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border flex items-center justify-between group transition-all ${isLight ? 'bg-slate-50 border-slate-200 hover:border-orange-300' : 'bg-white/5 border-white/5 hover:border-green-500/30'}`}
                  >
                    <div className="cursor-pointer flex-1" onClick={() => loadAccount(acc)}>
                      <div className="font-medium text-sm">{acc.username}</div>
                      <div className="text-xs text-zinc-500 capitalize">{acc.bank}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(i)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-500 rounded text-zinc-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-6 rounded-xl ${cardClass} flex flex-col h-full`}>
          {/* Management Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="flex items-center gap-2">
              <h2
                className={`text-xl font-semibold flex items-center gap-2 ${isLight ? 'text-blue-700' : ''}`}
              >
                <List className="w-5 h-5" />
                Use History
              </h2>
              <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-500 font-mono">
                {history.length} Cards
              </span>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Filters */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/20 border-white/10'}`}
              >
                <Search className="w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-sm outline-none w-24 md:w-32 placeholder-zinc-400"
                />
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/20 border-white/10'}`}
              >
                <Calendar className="w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={`bg-transparent text-sm outline-none w-32 md:w-auto placeholder-zinc-400 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}
                />
              </div>

              {selectedIds.length > 0 && (
                <button
                  onClick={() => handleDelete(selectedIds)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-xs font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete ({selectedIds.length})
                </button>
              )}

              <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-2"></div>

              <button
                onClick={fetchHistory}
                className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-zinc-400'}`}
                title="Refresh"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleExport}
                className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-green-600' : 'hover:bg-white/10 text-green-400'}`}
                title="Export"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div
              className={`p-4 rounded-xl border ${isLight ? 'bg-blue-50 border-blue-100' : 'bg-black/40 border-white/5'}`}
            >
              <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                Total Cards Generated
              </div>
              <div className={`text-2xl font-bold ${isLight ? 'text-blue-700' : 'text-white'}`}>
                {history.length}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl border ${isLight ? 'bg-green-50 border-green-100' : 'bg-black/40 border-white/5'}`}
            >
              <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total Value</div>
              <div className="text-2xl font-bold text-green-500">
                ₹
                {history
                  .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
                  .toLocaleString()}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl border ${isLight ? 'bg-orange-50 border-orange-100' : 'bg-black/40 border-white/5'}`}
            >
              <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                Selected Value
              </div>
              <div className="text-2xl font-bold text-orange-500">
                ₹
                {history
                  .filter((h) => selectedIds.includes(h.number))
                  .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading History...
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-white/5">
              <table className="w-full text-left text-sm relative">
                <thead
                  className={`sticky top-0 z-10 ${isLight ? 'bg-slate-50 text-slate-500 border-b border-slate-200' : 'bg-black/90 text-zinc-400 border-b border-white/10'}`}
                >
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={history.length > 0 && selectedIds.length === history.length}
                        onChange={toggleAllSelection}
                      />
                    </th>
                    <th className="p-4">Card Number</th>
                    <th className="p-4">CVV</th>
                    <th className="p-4">Expiry</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Snapshot</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-white/5'}`}>
                  {filteredHistory.map((item, i) => (
                    <tr
                      key={i}
                      className={`transition-colors ${selectedIds.includes(item.number) ? (isLight ? 'bg-blue-50' : 'bg-blue-900/10') : ''} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.includes(item.number)}
                          onChange={() => toggleSelection(item.number)}
                        />
                      </td>
                      <td className="p-4 font-mono font-medium">
                        <span className="select-all">{item.number}</span>
                      </td>
                      <td className="p-4 font-mono">{item.cvv}</td>
                      <td className="p-4 font-mono">{item.expiry}</td>
                      <td className="p-4 text-green-500 font-bold">₹{item.amount}</td>
                      <td className="p-4">
                        {item.snapshot ? (
                          <div className="relative group w-12 hover:w-12">
                            <img
                              src={`file://${item.snapshot}`}
                              className="h-8 w-12 object-cover rounded border border-zinc-500 cursor-pointer hover:border-blue-500 transition-colors"
                              onClick={() => setViewSnapshot(item.snapshot!)}
                              alt="VCC"
                            />
                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 pointer-events-none">
                              <Eye className="w-2 h-2" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${item.status === 'Unused' ? (isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400') : isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400'}`}
                        >
                          {item.status || 'Unused'}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2 justify-end">
                        <button
                          title="Copy"
                          onClick={() =>
                            copyToClipboard(`${item.number}|${item.expiry}|${item.cvv}`)
                          }
                          className={`p-2 rounded hover:text-blue-500 ${isLight ? 'hover:bg-slate-200' : 'hover:bg-white/10'}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete([item.number])}
                          className={`p-2 rounded hover:text-red-500 ${isLight ? 'hover:bg-slate-200' : 'hover:bg-white/10'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-zinc-500">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="w-8 h-8 opacity-20" />
                          No cards found matching your criteria.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {viewSnapshot && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
              onClick={() => setViewSnapshot(null)}
            >
              <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
                <button
                  className="absolute -top-10 right-0 text-white hover:text-zinc-300"
                  onClick={() => setViewSnapshot(null)}
                >
                  <X className="w-8 h-8" />
                </button>
                <img
                  src={`file://${viewSnapshot}`}
                  className="max-w-full max-h-[85vh] rounded shadow-2xl border-4 border-white/10"
                />
                <div className="mt-2 text-center text-white/50 text-xs">Click outside to close</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0-5.356-1.857" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 0 0-3-3.87" />
      <path d="M16 3.13a4 0 1 7.75" />
    </svg>
  )
}
