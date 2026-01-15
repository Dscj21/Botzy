import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Profile {
  id: number
  profile_name: string
  address_json: string
  card_encrypted: string
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Detailed Form State
  const [formData, setFormData] = useState({
    profile_name: '',
    // Address
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    // Card
    cardNumber: '',
    cardExpiry: '', // MM/YY
    cardCvv: '',
    nameOnCard: ''
  })

  // Removed unused state: activeTab, sessions
  const [editingId, setEditingId] = useState<number | null>(null) // Track editing state

  useEffect(() => {
    loadProfiles()
  }, [])

  async function loadProfiles() {
    try {
      const data = await api.getProfiles()
      setProfiles(data)
    } catch (err) {
      console.error('Failed to load profiles', err)
    }
  }

  function handleEdit(profile: Profile) {
    setEditingId(profile.id)

    // Parse Address
    let addr: any = {}
    try { addr = JSON.parse(profile.address_json) } catch (e) { }

    // Parse Card
    // If it's a masked string, we can't parse it. Ideally, we just leave fields blank
    // and let the placeholder indicate data exists.
    let card: any = {}
    if (profile.card_encrypted && profile.card_encrypted !== '********') {
      try { card = JSON.parse(profile.card_encrypted) } catch (e) { }
    }

    setFormData({
      profile_name: profile.profile_name,
      fullName: addr.fullName || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zipCode || '',
      phone: addr.phone || '',
      cardNumber: card.number || '',
      cardExpiry: card.expiry || '',
      cardCvv: card.cvv || '',
      nameOnCard: card.name || ''
    })
    setIsModalOpen(true)
  }

  function openNewProfileModal() {
    setEditingId(null)
    setFormData({
      profile_name: '',
      fullName: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: '',
      nameOnCard: ''
    })
    setIsModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const addressData = {
      fullName: formData.fullName,
      addressLine1: formData.addressLine1,
      addressLine2: formData.addressLine2,
      landmark: formData.landmark,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      phone: formData.phone
    }

    const cardData = {
      number: formData.cardNumber,
      expiry: formData.cardExpiry,
      cvv: formData.cardCvv,
      name: formData.nameOnCard
    }

    try {
      if (editingId) {
        await api.updateProfile?.({
          id: editingId,
          profile_name: formData.profile_name,
          address_json: JSON.stringify(addressData),
          card_encrypted: JSON.stringify(cardData)
        })
      } else {
        await api.addProfile({
          profile_name: formData.profile_name,
          address_json: JSON.stringify(addressData),
          card_encrypted: JSON.stringify(cardData)
        })
      }
      setIsModalOpen(false)
      loadProfiles()
    } catch (err) {
      console.error('Failed to save profile', err)
    }
  }

  async function handleDelete(id: number) {
    if (confirm('Delete this profile?')) {
      await api.deleteProfile(id)
      loadProfiles()
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Checkout Profiles</h2>
        <button
          onClick={openNewProfileModal}
          className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          + Add Profile
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((prof) => (
          <div
            key={prof.id}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg relative group"
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEdit(prof)}
                className="text-gray-400 hover:text-blue-400 font-bold"
                title="Edit"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(prof.id)}
                className="text-gray-400 hover:text-red-400"
                title="Delete"
              >
                🗑️
              </button>
            </div>

            <h3 className="text-xl font-bold mb-2 text-green-400">{prof.profile_name}</h3>

            <div className="text-sm text-gray-400 space-y-1 mb-4">
              {/* Parse JSON safely for display */}
              {(() => {
                try {
                  const addr = JSON.parse(prof.address_json)
                  return (
                    <>
                      <p className="font-semibold text-white">{addr.fullName}</p>
                      <p>{addr.addressLine1}</p>
                      <p>
                        {addr.city}, {addr.state} {addr.zip}
                      </p>
                    </>
                  )
                } catch {
                  return <p>Invalid Address Data</p>
                }
              })()}
            </div>

            <div className="border-t border-gray-700 pt-3">
              {(() => {
                if (prof.card_encrypted === '********') {
                  return (
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">CARD</span>
                      <span>•••• •••• •••• ••••</span>
                    </div>
                  )
                }
                try {
                  const card = JSON.parse(prof.card_encrypted)
                  return (
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">CARD</span>
                      <span>•••• {card.number.slice(-4)}</span>
                    </div>
                  )
                } catch {
                  return null
                }
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl relative my-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-6">{editingId ? 'Edit Profile' : 'Create Checkout Profile'}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Profile Name (e.g. &quot;Home&quot;, &quot;Office&quot;)
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2"
                  value={formData.profile_name}
                  onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h4 className="text-green-400 font-bold mb-2 border-b border-gray-700 pb-1">
                    Shipping Address
                  </h4>
                </div>
                <div>
                  <label className="block text-sm text-gray-400">Full Name</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400">Phone</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400">
                    Address Line 1 (Flat/House No/Building)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400">
                    Address Line 2 (Area/Sector/Village)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400">Landmark</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400">City</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400">State</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400">Zip Code</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-700/50">
                <h3 className="text-lg font-bold text-green-500">Payment Method</h3>
                <div className="text-xs text-gray-400 -mt-2">
                  Leave blank to keep existing card details.
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Card Number</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded p-2 text-white focus:border-green-500/50 outline-none transition-all"
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                    placeholder={editingId ? "Saved (Leave blank to keep)" : "Enter Card Number"}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded p-2 text-white focus:border-green-500/50 outline-none transition-all"
                    value={formData.cardExpiry}
                    onChange={(e) => setFormData({ ...formData, cardExpiry: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400">CVV</label>
                  <input
                    type="text"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                    value={formData.cardCvv}
                    onChange={(e) => setFormData({ ...formData, cardCvv: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-bold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
