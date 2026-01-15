import { useState } from 'react'
import { AccountsPage } from './AccountsPage'
import { ProfilesPage } from './ProfilesPage'

const TABS = [
    { id: 'FLP', label: 'Flipkart', icon: '🛒' },
    { id: 'AMZ', label: 'Amazon', icon: '📦' },
    { id: 'SHP', label: 'Shopsy', icon: '🛍️' },
    { id: 'PROFILES', label: 'Cards & Profiles', icon: '💳' }
]

export function UnifiedAccountsPage() {
    const [subTab, setSubTab] = useState('FLP')

    return (
        <div className="flex flex-col h-full bg-[#0f172a]">
            {/* Header Tabs */}
            <div className="flex items-center px-6 pt-6 border-b border-[#334155] bg-[#1e293b]">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition-all text-sm ${subTab === tab.id
                                ? 'border-purple-500 text-purple-400 bg-[#0f172a] rounded-t-lg'
                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#334155]/50'
                            }`}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {subTab === 'FLP' && <AccountsPage platform="FLP" />}
                {subTab === 'AMZ' && <AccountsPage platform="AMZ" />}
                {subTab === 'SHP' && <AccountsPage platform="SHP" />}
                {subTab === 'PROFILES' && <ProfilesPage />}
            </div>
        </div>
    )
}
