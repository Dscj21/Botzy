/// <reference types="vite/client" />

interface Window {
  api: {
    getAccounts: () => Promise<any[]>
    addAccount: (account: any) => Promise<any>
    updateAccount: (account: any) => Promise<any>
    deleteAccount: (id: number) => Promise<any>
    openSession: (accountId: string, url: string) => Promise<void>

    showSession: (accountId: string) => Promise<void>
    hideAllSessions: () => Promise<void>
    closeSession: (accountId: string) => Promise<void>
    getProfiles: () => Promise<any[]>
    addProfile: (profile: any) => Promise<any>
    updateProfile: (profile: any) => Promise<any>
    deleteProfile: (id: number) => Promise<any>
    getSetting: (key: string) => Promise<string | null>
    updateSetting: (key: string, value: string) => Promise<any>
    fetchNewProxy: () => Promise<string>
    checkProxy: (proxyString: string) => Promise<{ success: boolean; message: string }>

    getOrders: (accountId?: number) => Promise<any[]>
    saveOrders: (orders: any[]) => Promise<{ success: boolean }>
    exportOrders: (accountId?: number) => Promise<{ success: boolean; filePath?: string }>
    startAutomation: (accountId: number, url: string) => Promise<void>
  }
  electron: any
}
