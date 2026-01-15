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

  useEffect(() => {
    loadData()
    if (platform) setTargetPlatform(platform)
  }, [platform])

  async function loadData() {
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
      loadData()
    } catch (e) {
      console.error(e)
      alert('Failed to save')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account?')) return
    await api.deleteAccount(id)
    loadData()
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

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {platform === 'AMZ' ? 'Amazon Accounts' : platform === 'FLP' ? 'Flipkart Accounts' : 'Accounts Vault'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage your {platform ? platform : ''} bot accounts securely</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        >
          + Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => openModal(acc)} className="text-gray-400 hover:text-white">✏️</button>
              <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-300">🗑️</button>
            </div>

            <div className="flex items-center mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${acc.platform === 'AMZ' ? 'bg-yellow-600 text-black' : 'bg-blue-600 text-white'}`}>
                {acc.platform?.[0]}
              </div>
              <div>
                <h3 className="font-bold text-lg">{acc.label}</h3>
                <div className="text-xs text-gray-400 font-mono">{acc.username}</div>
              </div>
            </div>

            <div className="space-y-2 mt-4">
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
