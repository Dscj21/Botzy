import { BrowserView, BrowserWindow, session } from 'electron'
import * as path from 'path'

export class SessionManager {
    private sessions: Map<string, { view: BrowserView, url: string, active: boolean }> = new Map()
    private mainWindow: BrowserWindow | null = null

    getMainWindow() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
             const all = BrowserWindow.getAllWindows()
             if (all.length > 0) this.mainWindow = all[0]
        }
        return this.mainWindow
    }

    setWindow(win: BrowserWindow) {
        this.mainWindow = win
        win.on('resize', () => {
            const activeSession = Array.from(this.sessions.values()).find(s => s.active)
            if (activeSession) {
                this.resizeView(activeSession.view)
            }
        })
    }

    getView(id: string) {
        return this.sessions.get(id)?.view
    }

    getSessionsList() {
        return Array.from(this.sessions.entries()).map(([id, s]) => ({
            id,
            url: s.url,
            active: s.active
        }))
    }

    getAccountIdByWebContentsId(id: number) {
        for (const [accId, s] of this.sessions.entries()) {
            if (s.view.webContents.id === id) return parseInt(accId)
        }
        return null
    }

    async createSession(id: string, url: string, proxyString?: string, background: boolean = false) {
        const win = this.getMainWindow()
        if (!win) {
            console.error('[SessionManager] No Main Window found')
            return
        }

        if (this.sessions.has(id)) {
            const s = this.sessions.get(id)!
            if (!background) this.showSession(id)
            else {
                 this.hideAllSessions()
                 s.active = false
                 s.view.setBounds({ x: 0, y: 0, width: 1366, height: 768 })
                 try { win.removeBrowserView(s.view) } catch(e) {}
                 this.broadcastSessions()
            }
            return
        }

        const ses = session.fromPartition(`persist:${id}`)
        if (proxyString) {
             await ses.setProxy({ proxyRules: proxyString })
        }

        const preloadPath = path.join(__dirname, '../preload/browser.js')

        const view = new BrowserView({
            webPreferences: {
                partition: `persist:${id}`,
                preload: preloadPath,
                nodeIntegration: false,
                contextIsolation: true, // Fix Webpack conflicts
                sandbox: false,
                backgroundThrottling: false,
                webSecurity: false 
            }
        })
        
        view.setBackgroundColor('#1e1e1e') // Visual debugging
        
        // Real Chrome 124 UA
        view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.61 Safari/537.36')
        
        view.webContents.on('did-fail-load', (_e, code, desc) => {
             console.error('[BrowserView] Load failed:', code, desc)
        })
        view.setBounds({ x: 0, y: 0, width: 1366, height: 768 })
        
        if (!background) {
            win.addBrowserView(view)
            this.resizeView(view)
            this.sessions.set(id, { view, url, active: true })
        } else {
            this.sessions.set(id, { view, url, active: false })
            // Detached view for headless
        }

        // Detailed Event Logging
        view.webContents.on('did-fail-load', (_e, code, desc, validatedUrl) => {
             console.error(`[BrowserView] Load Failed: ${code} - ${desc} (${validatedUrl})`)
             win.webContents.send('automation:log', `❌ Error loading page: ${desc} (${code})`)
        })

        view.webContents.on('render-process-gone', (_e, details) => {
             console.error(`[BrowserView] Crashed: ${details.reason}`)
             win.webContents.send('automation:log', `❌ CRITICAL: Browser view crashed! (${details.reason})`)
        })

        view.webContents.on('did-finish-load', () => {
             console.log(`[BrowserView] Loaded: ${url}`)
             win.webContents.send('automation:log', `✅ Page loaded successfully`)
        })
        
        // Forward console errors from the page itself (Debug White Screen)
        view.webContents.on('console-message', (_e, level, message, line, sourceId) => {
             if (level >= 2) { // Error or Warning
                 console.log(`[Target Console] ${message} (${sourceId}:${line})`)
                 if (message.includes('Error') || message.includes('Exception')) {
                     win.webContents.send('automation:log', `[Page Error] ${message}`)
                 }
             }
        })

        // BYPASS CSP: The ultimate fix for "White Screen" on secure pages like Cart
        // Case-insensitive header removal is required.
        ses.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
            const newHeaders = { ...details.responseHeaders }
            
            Object.keys(newHeaders).forEach(key => {
                const lower = key.toLowerCase()
                if (['content-security-policy', 'x-frame-options', 'x-content-type-options', 'content-security-policy-report-only'].includes(lower)) {
                    delete newHeaders[key]
                }
            })

            callback({ 
                responseHeaders: newHeaders,
                cancel: false
            })
        })

        // SPOOF HEADERS: Ensure API calls (fetch/xhr) usually Referer/Origin to valid checks
        ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
            const requestHeaders = { ...details.requestHeaders }
            
            // Fool Flipkart into thinking we are a real browser on their site
            requestHeaders['Referer'] = 'https://www.flipkart.com/'
            requestHeaders['Origin'] = 'https://www.flipkart.com'
            // Ensure we look like a navigation or xmlhttprequest
            if (!requestHeaders['User-Agent']) {
                 requestHeaders['User-Agent'] = view.webContents.getUserAgent()
            }

            callback({ requestHeaders })
        })

        try {
            await Promise.race([
                // Sending Referer is crucial for deep links like Cart
                view.webContents.loadURL(url, { httpReferrer: 'https://www.flipkart.com/' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Load Timeout')), 25000))
            ])
        } catch(e: any) {
            console.error('Failed to load URL', e)
            win.webContents.send('automation:log', `❌ Load Timeout/Error: ${e.message}`)
        }

        this.broadcastSessions()
    }

    showSession(id: string) {
        const s = this.sessions.get(id)
        if (!s) return
        
        this.hideAllSessions()
        
        s.active = true
        const win = this.getMainWindow()
        if (win) {
             win.addBrowserView(s.view)
             this.resizeView(s.view)
        }
        this.broadcastSessions()
    }

    hideAllSessions() {
        const win = this.getMainWindow()
        if (!win) return

        for (const s of this.sessions.values()) {
            if (s.active) {
                s.active = false
                try { win.removeBrowserView(s.view) } catch(e) {}
                s.view.setBounds({ x: 0, y: 0, width: 1366, height: 768 })
            }
        }
        this.broadcastSessions()
    }
    
    closeSession(id: string) {
        const s = this.sessions.get(id)
        if (s) {
            const win = this.getMainWindow()
            if (win) {
                 try { win.removeBrowserView(s.view) } catch(e) {}
            }
            // Explicitly destroy webContents to free memory
            try { (s.view.webContents as any).destroy() } catch(e) {}
            
            this.sessions.delete(id)
        }
        this.broadcastSessions()
    }
    
    private broadcastSessions() {
        const win = this.getMainWindow()
        if (!win || win.isDestroyed()) return
        const list = this.getSessionsList()
        win.webContents.send('session:update', list)
    }

    getCredentialsForWebContents(_contentsId: number) {
        return null
    }

    resizeView(view: BrowserView) {
        if (!this.mainWindow) return
        const bounds = this.mainWindow.getBounds()
        const sidebarWidth = 288 
        const titleBarHeight = 48
        
        view.setBounds({
            x: sidebarWidth,
            y: titleBarHeight,
            width: bounds.width - sidebarWidth,
            height: bounds.height - titleBarHeight
        })
    }
    
    reload(id: string) {
        const s = this.sessions.get(id)
        if(s) s.view.webContents.reload()
    }
    
    goBack(id: string) {
        const s = this.sessions.get(id)
        if(s && s.view.webContents.canGoBack()) s.view.webContents.goBack()
    }
    
    runAutomation(id: string, command: string, data?: any) {
        const s = this.sessions.get(id)
        if(s) {
            s.view.webContents.send('automation:run', command, data)
        }
    }
    
    searchInAllSessions(_query: string) {}
}

export const sessionManager = new SessionManager()
