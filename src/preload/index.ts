import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getAccounts: () => electronAPI.ipcRenderer.invoke('db:get-accounts'),
  addAccount: (account: any) => electronAPI.ipcRenderer.invoke('db:add-account', account),
  updateAccount: (account: any) => electronAPI.ipcRenderer.invoke('db:update-account', account),
  deleteAccount: (id: number) => electronAPI.ipcRenderer.invoke('db:delete-account', id),
  openSession: (accountId: string, url: string) =>
    electronAPI.ipcRenderer.invoke('session:open', { accountId, url }),
  showSession: (accountId: string) => electronAPI.ipcRenderer.invoke('session:show', accountId),
  hideAllSessions: () => electronAPI.ipcRenderer.invoke('session:hide-all'),
  closeSession: (accountId: string) => electronAPI.ipcRenderer.invoke('session:close', accountId),
  // Profiles
  getProfiles: () => electronAPI.ipcRenderer.invoke('db:get-profiles'),
  addProfile: (profile: any) => electronAPI.ipcRenderer.invoke('db:add-profile', profile),
  updateProfile: (profile: any) => electronAPI.ipcRenderer.invoke('db:update-profile', profile),
  deleteProfile: (id: number) => electronAPI.ipcRenderer.invoke('db:delete-profile', id),
  // Orders
  getOrders: (accountId?: number) => electronAPI.ipcRenderer.invoke('db:get-orders', accountId),
  saveOrders: (orders: any[]) => electronAPI.ipcRenderer.invoke('db:save-orders', orders),
  exportOrders: (accountId?: number) =>
    electronAPI.ipcRenderer.invoke('db:export-orders', accountId),
  // Settings & Proxy
  getSetting: (key: string) => electronAPI.ipcRenderer.invoke('settings:get', key),
  updateSetting: (key: string, value: string) =>
    electronAPI.ipcRenderer.invoke('settings:set', { key, value }),
  fetchNewProxy: () => electronAPI.ipcRenderer.invoke('proxy:fetch-new'),
  checkProxy: (proxyString: string) => electronAPI.ipcRenderer.invoke('proxy:check', proxyString),
  startAutomation: (accountId: number, url: string) =>
    electronAPI.ipcRenderer.invoke('automation:start-buy', { accountId, url })
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
