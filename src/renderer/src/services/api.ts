const ipcRenderer = (window as any).electron.ipcRenderer

export const api = {
  getAccounts: () => ipcRenderer.invoke('db:get-accounts'),
  addAccount: (account: any) => ipcRenderer.invoke('db:add-account', account),
  updateAccount: (account: any) => ipcRenderer.invoke('db:update-account', account),
  deleteAccount: (id: number) => ipcRenderer.invoke('db:delete-account', id),

  getProfiles: () => ipcRenderer.invoke('db:get-profiles'),
  addProfile: (profile: any) => ipcRenderer.invoke('db:add-profile', profile),
  updateProfile: (profile: any) => ipcRenderer.invoke('db:update-profile', profile),
  deleteProfile: (id: number) => ipcRenderer.invoke('db:delete-profile', id),

  // Session
  openSession: (accountId: string, url: string, background: boolean = false) => 
      ipcRenderer.invoke('session:open', { accountId, url, background }),
  
  showSession: (accountId: string) => ipcRenderer.invoke('session:show', accountId),
  hideAllSessions: () => ipcRenderer.invoke('session:hide-all'),
  closeSession: (accountId: string) => ipcRenderer.invoke('session:close', accountId),
  getSessions: () => ipcRenderer.invoke('session:get-all'),

  // Orders
  getOrders: (accountId?: number) => ipcRenderer.invoke('db:get-orders', accountId),
  saveOrders: (orders: any[]) => ipcRenderer.invoke('db:save-orders', orders),
  exportOrders: () => ipcRenderer.invoke('db:export-csv'),
}
