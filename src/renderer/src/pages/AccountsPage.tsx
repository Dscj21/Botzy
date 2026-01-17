import { useState, useEffect } from 'react'
import { api } from '../services/api'

export function AccountsPage({ platform }: { platform?: string }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)

  // Form State
  const [label, setLabel] = useState('')
  const [targetPlatform, setTargetPlatform] = useState(platform || 'FLP')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [profileId, setProfileId] = useState('')
  const [proxyString, setProxyString] = useState('')

  const fetchAccountsAndProfiles = async () => {
    try {
      const [accs, profs] = await Promise.all([
        api.getAccounts(),
        api.getProfiles()
      ])
      const filtered = platform ? accs.filter(a => a.platform === platform) : accs
      setAccounts(filtered)
      setProfiles(profs)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchAccountsAndProfiles()
    if (platform) setTargetPlatform(platform)
  }, [platform])

  const handleSave = async () => {
    try {
      const payload = {
        label,
        platform: targetPlatform,
        username,
        encrypted_password: password,
        profile_id: profileId ? parseInt(profileId) : null,
        proxy_string: proxyString
      }

      if (editingAccount) {
        await api.updateAccount({ ...payload, id: editingAccount.id })
      } else {
        await api.addAccount(payload)
      }

      closeModal()
      fetchAccountsAndProfiles()
    } catch (e) {
      console.error(e)
      alert('Failed to save')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return
    await api.deleteAccount(id)
    fetchAccountsAndProfiles()
  }

  const openModal = (acc?: any) => {
    if (acc) {
      setEditingAccount(acc)
      setLabel(acc.label)
      setTargetPlatform(acc.platform)
      setUsername(acc.username)
      setPassword(acc.encrypted_password) // Placeholder
      setProfileId(acc.profile_id?.toString() || '')
      setProxyString(acc.proxy_string || '')
    } else {
      setEditingAccount(null)
      setLabel('')
      setTargetPlatform(platform || 'FLP')
      setUsername('')
      setPassword('')
      setProfileId('')
      setProxyString('')
    }
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const handleLaunch = async (acc: any) => {
    // Default URLs
    let url = 'https://www.flipkart.com'
    if (acc.platform === 'AMZ') url = 'https://www.amazon.in'
    // Launch
    await api.openSession(acc.id.toString(), url)
  }

  /* Bulk Selection State */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkProfileId, setBulkProfileId] = useState('')
  const [isRunningBatch, setIsRunningBatch] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number, status: string } | null>(null)

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

  const handleBulkAddressFill = async () => {
    if (!bulkProfileId) return alert('Please select a profile')

    const profile = profiles.find(p => p.id === parseInt(bulkProfileId))
    if (!profile) return

    let addressData: any = {}
    try {
      addressData = JSON.parse(profile.address_json || '{}')
    } catch {
      return alert('Invalid address in selected profile')
    }

    setIsRunningBatch(true)
    const targets = accounts.filter(a => selectedIds.has(a.id))

    for (let i = 0; i < targets.length; i++) {
      if (!isBulkModalOpen) break // Stop if modal closed (cancelled)
      const acc = targets[i]
      setBatchProgress({ current: i + 1, total: targets.length, status: `Processing ${acc.label}...` })

      // 1. Open Session
      try {
        // Force FLP for now as logic is tuned for it
        const url = 'https://www.flipkart.com/account/addresses'
        await api.openSession(acc.id.toString(), url)

        // Wait for load
        await new Promise(r => setTimeout(r, 8000))

        // 2. Send Automation Command
        const payload = {
          ...addressData,
          email: acc.username, // Fallback for login
          password: acc.encrypted_password ? 'DECRYPT_ME_ON_MAIN' : '', // Main process decrypts if needed, or we pass raw if we had it. 
          // Wait, renderer doesn't have raw password usually. 
          // The `automation:run` IPC in main handles this? 
          // Let's check main.ipcHandlers. 
          // Actually main just forwards `data`. 
          // We need to ask Main to inject credentials.
        }

        // We need a way to tell Main: "Use credentials for this session + this extra data"
        // Or better: Main already has `session:open` which decrypts password? 
        // `sessionManager` doesn't hold password. 
        // `ipcHandlers.ts` -> `automation:run` -> `sessionManager.runAutomation`.

        // Hack: Trigger `automation:run` via IPC, but we need the password.
        // Option: Pass `useStoredCredentials: true` and handle in `ipcHandlers`. 

        // Let's modify IPC to support merging stored credentials.
        // For now, I'll rely on the user being logged in OR `browser.ts` handling it if I can pass credentials.
        // But I can't pass credentials from here (Renderer) securely/easily if encrypted.

        // WORKAROUND: Send a custom command that main intercepts to attach credentials.
        await (window as any).electron.ipcRenderer.send('automation:run', {
          sessionId: acc.id.toString(),
          command: 'update-profile-auto',
          data: { ...payload, _attachCredentials: true, name: profile.profile_name }
        })

        // Wait for execution
        await new Promise(r => setTimeout(r, 15000))

        // Close Session
        await api.closeSession(acc.id.toString())

      } catch (e) {
        console.error(e)
      }
    }

    setIsRunningBatch(false)
    setBatchProgress(null)
    setIsBulkModalOpen(false)
    alert('Batch Job Complete')
  }

  /* ... Validations ... */




  return (
    <div className="p-8 text-white h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {platform === 'AMZ' ? 'Amazon Accounts' : platform === 'FLP' ? 'Flipkart Accounts' : 'Accounts Vault'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage your {platform ? platform : ''} bot accounts securely</p>
        </div>

        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 animate-in fade-in zoom-in"
            >
              <span className="bg-white/20 px-2 rounded text-xs">{selectedIds.size}</span>
              Bulk Actions
            </button>
          )}
          <button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            + Add Account
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="w-5 h-5 rounded cursor-pointer accent-blue-500"
            checked={accounts.length > 0 && selectedIds.size === accounts.length}
            onChange={toggleSelectAll}
          />
          <span className="text-gray-400 text-sm">Select All</span>
        </div>
        <div className="text-sm text-gray-500">{accounts.length} Accounts Found</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className={`bg-[#1e293b] p-6 rounded-xl border transition-all group relative overflow-hidden ${selectedIds.has(acc.id) ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 hover:border-blue-500'}`}>
            <div className="absolute top-4 right-4 z-10">
              <input
                type="checkbox"
                className="w-5 h-5 rounded cursor-pointer accent-blue-500"
                checked={selectedIds.has(acc.id)}
                onChange={() => toggleSelect(acc.id)}
              />
            </div>

            <div className="absolute top-0 right-10 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => openModal(acc)} className="text-gray-400 hover:text-white">✏️</button>
              <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-300">🗑️</button>
            </div>

            <div className="flex items-center mb-4 cursor-pointer" onClick={() => toggleSelect(acc.id)}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${acc.platform === 'AMZ' ? 'bg-yellow-600 text-black' : 'bg-blue-600 text-white'}`}>
                {acc.platform?.[0]}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-lg truncate pr-8">{acc.label}</h3>
                <div className="text-xs text-gray-400 font-mono truncate">{acc.username}</div>
              </div>
            </div>

            <div className="space-y-2 mt-4 pointer-events-none">
              <div className="text-xs text-gray-500 flex justify-between">
                <span>Profile:</span>
                <span className="text-gray-300">{profiles.find(p => p.id === acc.profile_id)?.profile_name || 'None'}</span>
              </div>
              <div className="text-xs text-gray-500 flex justify-between">
                <span>Proxy:</span>
                <span className={`truncate max-w-[150px] ${acc.proxy_string ? 'text-green-400' : 'text-gray-600'}`}>
                  {acc.proxy_string ? 'Active' : 'Direct'}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleLaunch(acc)}
              className="w-full mt-6 bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm font-medium transition-colors"
            >
              Launch Session 🚀
            </button>
          </div>
        ))}
      </div>

      {/* Bulk/Batch Progress Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-[#1e293b] p-8 rounded-2xl w-[500px] border border-gray-600 shadow-2xl relative">
            {!isRunningBatch ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Bulk Automation</h2>
                <p className="text-gray-400 mb-6">Selected {selectedIds.size} accounts for processing.</p>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-300 mb-2">Action</label>
                  <select className="w-full bg-black/30 border border-gray-600 rounded p-2 outline-none">
                    <option>Autofill Address from Profile</option>
                  </select>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-300 mb-2">Source Profile</label>
                  <select
                    className="w-full bg-black/30 border border-gray-600 rounded p-2 outline-none text-white"
                    value={bulkProfileId}
                    onChange={e => setBulkProfileId(e.target.value)}
                  >
                    <option value="">Select a Profile...</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">The address details from this profile will be added to all selected accounts.</p>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                  <button
                    onClick={handleBulkAddressFill}
                    className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded font-bold shadow-lg"
                  >
                    Start Automation
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-bold mb-2">Running Batch Job...</h2>
                <div className="text-3xl font-mono font-bold text-indigo-400 mb-2">{batchProgress?.current} / {batchProgress?.total}</div>
                <p className="text-gray-400 animate-pulse">{batchProgress?.status}</p>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="mt-8 text-red-400 hover:text-red-300 text-sm underline"
                >
                  Stop & Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#1e293b] p-8 rounded-2xl w-[500px] border border-gray-600 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">{editingAccount ? 'Edit Account' : 'New Account'}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Label (Internal Name)</label>
                <input className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Main Account" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Platform</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                    value={targetPlatform}
                    onChange={e => setTargetPlatform(e.target.value)}
                    disabled={!!platform} // Disable if filtering is active
                  >
                    <option value="FLP">Flipkart</option>
                    <option value="AMZ">Amazon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Profile (Auto-Fill)</label>
                  <select className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" value={profileId} onChange={e => setProfileId(e.target.value)}>
                    <option value="">No Profile</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Username / Email / Mobile</label>
                <input className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" value={username} onChange={e => setUsername(e.target.value)} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Password</label>
                <input type="password" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} placeholder={editingAccount ? 'Leave blank to keep unchanged' : ''} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Proxy (Optional)</label>
                <input className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" value={proxyString} onChange={e => setProxyString(e.target.value)} placeholder="http://user:pass@host:port" />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold shadow-lg transition-transform active:scale-95">Save Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
