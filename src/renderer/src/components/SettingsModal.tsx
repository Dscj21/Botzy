import { X, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import Versions from './Versions'

export function SettingsModal({ isOpen, onClose, updateStatus }: any) {

    const [address, setAddress] = useState('')
    const [gst, setGst] = useState('')

    // Load saved defaults (mock)
    useEffect(() => {
        // In real app, load from ipcRenderer.invoke('db:get-settings')
    }, [])

    const saveDefaults = () => {
        // ipcRenderer.invoke('db:save-settings', { defaultAddress: address, defaultGst: gst })
        alert('Settings Saved (Mock)')
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <div className="w-[500px] bg-[#1e293b] rounded-xl border border-gray-700 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Application Settings</h2>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
                </div>

                <div className="space-y-6">
                    {/* AUTOFILL DEFAULTS */}
                    <div className="p-4 bg-[#0f172a] rounded-lg border border-gray-700 space-y-3">
                        <h3 className="text-sm font-bold text-blue-400 uppercase">Default Checkout Data</h3>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Default Address (Full Text)</label>
                            <textarea
                                className="w-full bg-[#1e293b] border border-gray-600 rounded p-2 text-sm text-white"
                                rows={3}
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="Full address to autofill if missing..."
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Default GSTIN</label>
                            <input
                                className="w-full bg-[#1e293b] border border-gray-600 rounded p-2 text-sm text-white"
                                value={gst}
                                onChange={e => setGst(e.target.value)}
                                placeholder="GST Number"
                            />
                        </div>
                    </div>

                    {/* UPDATE STATUS */}
                    <div className="p-4 bg-[#0f172a] rounded-lg border border-gray-700 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-300">Software Update</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {updateStatus.available ? 'Update Available' : 'Up to date'}
                            </p>
                        </div>
                        {updateStatus.available && (
                            <button className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold animate-pulse">
                                {updateStatus.downloaded ? 'Restart to Update' : `Downloading ${Math.floor(updateStatus.progress)}%`}
                            </button>
                        )}
                        {!updateStatus.available && <CheckCircle className="text-green-500 w-5 h-5" />}
                    </div>

                    <Versions />

                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={onClose} className="px-4 py-2 hover:bg-gray-700 rounded text-gray-300 font-medium">Cancel</button>
                        <button onClick={saveDefaults} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
