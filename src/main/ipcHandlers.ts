import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { dbManager } from './database'
import { sessionManager } from './sessionManager'
import { decrypt, encrypt } from './crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

export const setupIpcHandlers = (mainWindow: BrowserWindow) => {
  sessionManager.setWindow(mainWindow)

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('db:get-accounts', () => {
    console.log('[IPC] db:get-accounts called')
    const stmt = dbManager.getDb().prepare('SELECT * FROM accounts')
    const accounts = stmt.all()
    console.log(`[IPC] db:get-accounts found ${accounts.length} accounts`)
    // Mask passwords
    return accounts.map((acc: any) => ({
      ...acc,
      encrypted_password: acc.encrypted_password ? '********' : ''
    }))
  })

  ipcMain.handle('db:add-account', (_, account) => {
    // Check if duplicate label?
    if (account.password) {
      account.encrypted_password = encrypt(account.password)
      delete account.password
    }
    const stmt = dbManager.getDb().prepare(`
      INSERT INTO accounts (label, platform, username, encrypted_password, profile_id, proxy_string, is_gst)
      VALUES (@label, @platform, @username, @encrypted_password, @profile_id, @proxy_string, @is_gst)
    `)
    return stmt.run(account)
  })

  ipcMain.handle('db:update-account', (_, account) => {
    if (account.password) {
      account.encrypted_password = encrypt(account.password)
    }
    // Dynamic update set
    const keys = Object.keys(account).filter((k) => k !== 'id' && k !== 'password')
    const setClause = keys.map((k) => `${k} = @${k}`).join(', ')
    const stmt = dbManager.getDb().prepare(`UPDATE accounts SET ${setClause} WHERE id = @id`)
    return stmt.run(account)
  })

  ipcMain.handle('db:get-profiles', () => {
    return dbManager.getDb().prepare('SELECT * FROM profiles').all()
  })

  ipcMain.handle('db:add-profile', (_, profile) => {
    // profile has address_json, card details...
    let encCard = ''
    if (profile.cardNumber) {
      const cardData = JSON.stringify({
        number: profile.cardNumber,
        expiry: profile.cardExpiry,
        cvv: profile.cardCvv
      })
      encCard = encrypt(cardData)
    }
    const stmt = dbManager.getDb().prepare(`
          INSERT INTO profiles (profile_name, address_json, card_encrypted)
          VALUES (@profile_name, @address_json, @card_encrypted)
      `)
    return stmt.run({
      profile_name: profile.profileName,
      address_json: JSON.stringify(profile.address),
      card_encrypted: encCard
    })
  })

  ipcMain.handle('db:update-profile', (_, profile) => {
    const shouldUpdateCard = !!profile.cardNumber
    let newEncryptedCard: string | undefined = undefined
    if (shouldUpdateCard) {
      newEncryptedCard = encrypt(
        JSON.stringify({
          number: profile.cardNumber,
          expiry: profile.cardExpiry,
          cvv: profile.cardCvv
        })
      )
    }

    // If not updating card, keep old one.
    let stmt
    if (shouldUpdateCard) {
      stmt = dbManager
        .getDb()
        .prepare(
          `UPDATE profiles SET profile_name = @profile_name, address_json = @address_json, card_encrypted = @card_encrypted WHERE id = @id`
        )
      return stmt.run({ ...profile, card_encrypted: newEncryptedCard })
    } else {
      stmt = dbManager
        .getDb()
        .prepare(
          `UPDATE profiles SET profile_name = @profile_name, address_json = @address_json WHERE id = @id`
        )
      return stmt.run({ ...profile, card_encrypted: undefined })
    }
  })

  ipcMain.handle('db:delete-account', (_, id) =>
    dbManager.getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id)
  )
  ipcMain.handle('db:delete-profile', (_, id) =>
    dbManager.getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id)
  )

  // --- CRYPTO ---
  ipcMain.handle('get-session-credentials', async (event) => {
    return sessionManager.getCredentialsForWebContents(event.sender.id)
  })

  // --- ORDERS ---
  ipcMain.handle('db:save-orders', (event, orders) => {
    const accountId = sessionManager.getAccountIdByWebContentsId(event.sender.id)

    if (!accountId) {
      return { success: false }
    }

    const stmt = dbManager.getDb().prepare(`
          INSERT INTO orders (account_id, order_id, platform, product_name, quantity, price, status, order_date, delivered_date, image_url, tracking_id, delivery_otp)
          VALUES (@account_id, @order_id, @platform, @product_name, @quantity, @price, @status, @order_date, @delivered_date, @image_url, @tracking_id, @delivery_otp)
          ON CONFLICT(order_id) DO UPDATE SET
            status = excluded.status,
            account_id = excluded.account_id, 
            price = excluded.price,
            delivered_date = excluded.delivered_date,
            tracking_id = CASE WHEN excluded.tracking_id IS NOT NULL AND excluded.tracking_id != '' THEN excluded.tracking_id ELSE orders.tracking_id END,
            delivery_otp = CASE WHEN excluded.delivery_otp IS NOT NULL AND excluded.delivery_otp != '' THEN excluded.delivery_otp ELSE orders.delivery_otp END,
            image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE orders.image_url END
      `)

    const transaction = dbManager.getDb().transaction((items) => {
      for (const item of items) {
        stmt.run({ ...item, account_id: accountId })
      }
    })
    transaction(orders)
    return { success: true }
  })

  ipcMain.handle('db:clear-orders', () => {
    dbManager.getDb().prepare('DELETE FROM orders').run()
    mainWindow.webContents.send('orders:updated')
  })

  ipcMain.handle('db:get-orders', () => {
    return dbManager.getDb().prepare('SELECT * FROM orders ORDER BY order_date DESC').all()
  })

  ipcMain.handle('db:export-csv', async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Orders CSV',
      defaultPath: 'orders.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })

    if (filePath) {
      const orders = dbManager.getDb().prepare('SELECT * FROM orders').all()
      const worksheet = XLSX.utils.json_to_sheet(orders)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders')
      XLSX.writeFile(workbook, filePath)
      return { success: true, filePath }
    }
    return { success: false }
  })

  // Listen for scraped orders from browser preload
  ipcMain.on('orders:scraped', (event, orders) => {
    const accountId = sessionManager.getAccountIdByWebContentsId(event.sender.id)

    if (!accountId || !orders || orders.length === 0) {
      console.log('[Orders] No account ID or empty orders')
      return
    }

    console.log(`[Orders] Received ${orders.length} scraped orders for account ${accountId}`)

    const stmt = dbManager.getDb().prepare(`
          INSERT INTO orders (account_id, order_id, platform, product_name, price, status, order_date, delivered_date, image_url, tracking_id)
          VALUES (@account_id, @order_id, @platform, @product_name, @price, @status, @order_date, @delivered_date, @image_url, @tracking_id)
          ON CONFLICT(order_id) DO UPDATE SET
            status = excluded.status,
            price = excluded.price,
            order_date = excluded.order_date,
            delivered_date = excluded.delivered_date,
            product_name = excluded.product_name,
            image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE orders.image_url END,
            tracking_id = CASE WHEN excluded.tracking_id != '' THEN excluded.tracking_id ELSE orders.tracking_id END
      `)

    const transaction = dbManager.getDb().transaction((items) => {
      for (const item of items) {
        stmt.run({
          ...item,
          account_id: accountId,
          delivered_date: item.delivered_date || '',
          image_url: item.image_url || '',
          tracking_id: item.tracking_id || ''
        })
      }
    })

    try {
      transaction(orders)
      console.log(`[Orders] Saved ${orders.length} orders to database`)
      mainWindow.webContents.send('orders:updated')
    } catch (e) {
      console.error('[Orders] Error saving:', e)
    }
  })

  // NEW: Forward sync complete signal
  ipcMain.on('orders:sync-complete', () => {
    console.log('[IPC] Sync Complete Signal Received from Scraper')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('orders:sync-complete')
    }
  })

  // --- SESSION MANAGEMENT ---
  ipcMain.handle('session:open', async (_, { accountId, url, background }) => {
    const account = dbManager
      .getDb()
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any
    if (!account) return

    if (account.encrypted_password) {
      account.password = decrypt(account.encrypted_password)
    }
    if (account.profile_id) {
      const profile = dbManager
        .getDb()
        .prepare('SELECT * FROM profiles WHERE id = ?')
        .get(account.profile_id) as any
      if (profile) account.profile = profile
    }

    await sessionManager.createSession(account.id.toString(), url, account.proxy_string, background)
    return { id: account.id.toString(), label: account.label }
  })

  ipcMain.handle('session:show', (_, id) => sessionManager.showSession(id.toString()))
  ipcMain.handle('session:hide-all', () => sessionManager.hideAllSessions())
  ipcMain.handle('session:search-all', (_, query) => sessionManager.searchInAllSessions(query))

  ipcMain.handle('session:close', (_, id) => sessionManager.closeSession(id.toString()))
  ipcMain.handle('session:get-all', () => sessionManager.getSessionsList())

  ipcMain.handle('session:go-back', (_, id) => sessionManager.goBack(id))
  ipcMain.handle('session:reload', (_, id) => sessionManager.reload(id))

  // --- SETTINGS ---
  ipcMain.handle('settings:get', (_, _key) => null)
  ipcMain.handle('settings:save', (_, { key: _key, value: _value }) => {})

  // --- UPDATER ---
  const { autoUpdater } = require('electron-updater')

  ipcMain.handle('updater:check', () => {
    autoUpdater.checkForUpdatesAndNotify()
  })
  ipcMain.handle('updater:download', () => {
    autoUpdater.downloadUpdate()
  })
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('checking-for-update', () => mainWindow.webContents.send('checking-for-update'))
  autoUpdater.on('update-available', (info) =>
    mainWindow.webContents.send('update-available', info)
  )
  autoUpdater.on('update-not-available', () => mainWindow.webContents.send('update-not-available'))
  autoUpdater.on('download-progress', (progress) =>
    mainWindow.webContents.send('update-download-progress', progress)
  )
  autoUpdater.on('update-download-progress', (progress) =>
    mainWindow.webContents.send('update-download-progress', progress)
  )
  autoUpdater.on('update-downloaded', () => mainWindow.webContents.send('update-downloaded'))

  // --- AUTOMATION ---

  ipcMain.on('automation:run', (_event, arg1: any, arg2: any) => {
    let sessionId: string, command: string, data: any

    if (typeof arg1 === 'string') {
      // Loose mode: (command, data)
      sessionId = 'netsafe'
      command = arg1
      data = arg2
    } else {
      // Object mode: ({ sessionId, command, data })
      sessionId = arg1.sessionId
      command = arg1.command
      data = arg1.data
    }

    console.log(`[IPC Handlers] Processing '${command}' for Session ${sessionId}`)

    const view = sessionManager.getView(sessionId)
    if (!view) {
      // Create session if missing (e.g. for Netsafe)
      // Use the actual URL to ensure Preload runs and we are ready
      const HDFC_URL = 'https://netsafe.hdfc.bank.in/ACSWeb/enrolljsp/HDFCValidate.jsp'
      sessionManager.createSession(sessionId.toString(), HDFC_URL).then(async () => {
        // Wait a bit for page to be fully interactive
        await new Promise((r) => setTimeout(r, 2000))
        sessionManager.runAutomation(sessionId.toString(), command, data || {})
      })
    } else {
      sessionManager.runAutomation(sessionId.toString(), command, data || {})
    }
  })

  ipcMain.on('automation:stop', (_event, sessionId) => {
    console.log(`[IPC] Stopping Automation for ${sessionId}`)
    sessionManager.closeSession(sessionId) // This kills the view and script
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation:log', '🛑 Process Stopped by User')
    }
  })

  ipcMain.on('automation:log', (_event, _message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
    }
  })

  ipcMain.on('automation:progress', (_event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation:progress', data)
    }
  })

  ipcMain.handle('automation:empty-cart', (_, id) =>
    sessionManager.runAutomation(id.toString(), 'empty-cart')
  )
  ipcMain.handle('automation:add-to-cart', (_, { id, url }) =>
    sessionManager.runAutomation(id.toString(), 'add-to-cart', { url })
  )
  ipcMain.handle('automation:camp-checkout', (_, id) =>
    sessionManager.runAutomation(id.toString(), 'camp-checkout')
  )

  ipcMain.on('live-checkout-update', (event, data) => {
    const id = sessionManager.getAccountIdByWebContentsId(event.sender.id)
    if (id) {
      mainWindow.webContents.send('live-checkout-update', { id: id.toString(), ...data })
    }
  })

  ipcMain.handle('automation:click-at', async (event, { id, x, y }) => {
    let view = id ? sessionManager.getView(id.toString()) : null
    if (!view) {
      const accId = sessionManager.getAccountIdByWebContentsId(event.sender.id)
      if (accId) view = sessionManager.getView(accId.toString())
    }

    if (view) {
      console.log(`[Automation] Raw Click at ${x}, ${y}`)
      if (x >= 0 && y >= 0) {
        const opts = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 } as any
        view.webContents.sendInputEvent({ type: 'mouseDown', ...opts })
        await new Promise((r) => setTimeout(r, 50))
        view.webContents.sendInputEvent({ type: 'mouseUp', ...opts })
      }
    }
  })

  ipcMain.handle('automation:keypress', async (event, { id, key }) => {
    let view = id ? sessionManager.getView(id.toString()) : null
    if (!view) {
      const accId = sessionManager.getAccountIdByWebContentsId(event.sender.id)
      if (accId) view = sessionManager.getView(accId.toString())
    }

    if (view) {
      console.log(`[Automation] KeyPress: ${key}`)
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key })
      if (key.length === 1) view.webContents.sendInputEvent({ type: 'char', keyCode: key })
      await new Promise((r) => setTimeout(r, 50))
      view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key })
    }
  })

  // --- BACKUP / RESTORE ---
  ipcMain.handle('db:export-all', async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Data Backup (v2.0)',
      defaultPath: `HyperCart_Backup_v2.0_${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    })
    if (!filePath) return { success: false }

    try {
      const accounts = dbManager.getDb().prepare('SELECT * FROM accounts').all()
      const profiles = dbManager.getDb().prepare('SELECT * FROM profiles').all()
      const orders = dbManager.getDb().prepare('SELECT * FROM orders').all()

      // VCCs from Excel
      let vccs: any[] = []
      const docPath = app.getPath('documents')
      const vccPath = path.join(docPath, 'HyperCart_VCC.xlsx')
      if (fs.existsSync(vccPath)) {
        const wb = XLSX.readFile(vccPath)
        const ws = wb.Sheets[wb.SheetNames[0]]
        vccs = XLSX.utils.sheet_to_json(ws)
      }

      const backup = {
        version: '2.0',
        date: new Date().toISOString(),
        accounts,
        profiles,
        orders,
        vccs
      }

      fs.writeFileSync(filePath, JSON.stringify(backup, null, 2))
      return { success: true, path: filePath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('db:import-all', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Backup (v2.0)',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!filePaths || filePaths.length === 0) return { success: false }

    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8')
      const data = JSON.parse(raw)

      if (!data.accounts || !data.profiles)
        throw new Error('Invalid backup format: Missing accounts or profiles')

      const db = dbManager.getDb()
      const insertAccount = db.prepare(
        `INSERT OR REPLACE INTO accounts (id, label, platform, username, encrypted_password, profile_id, proxy_string, is_gst) VALUES (@id, @label, @platform, @username, @encrypted_password, @profile_id, @proxy_string, @is_gst)`
      )
      const insertProfile = db.prepare(
        `INSERT OR REPLACE INTO profiles (id, profile_name, address_json, card_encrypted) VALUES (@id, @profile_name, @address_json, @card_encrypted)`
      )
      const insertOrder = db.prepare(
        `INSERT OR REPLACE INTO orders (order_id, account_id, platform, product_name, quantity, price, status, order_date, image_url, tracking_id, delivery_otp) VALUES (@order_id, @account_id, @platform, @product_name, @quantity, @price, @status, @order_date, @image_url, @tracking_id, @delivery_otp)`
      )

      const transaction = db.transaction(() => {
        for (const acc of data.accounts) insertAccount.run({ ...acc, is_gst: acc.is_gst || 0 })
        for (const prof of data.profiles) insertProfile.run(prof)
        if (data.orders) {
          for (const ord of data.orders) insertOrder.run(ord)
        }
      })

      transaction()

      // Restore VCCs
      if (data.vccs && Array.isArray(data.vccs)) {
        const docPath = app.getPath('documents')
        const vccPath = path.join(docPath, 'HyperCart_VCC.xlsx')

        // Merge Logic: Read existing, append new unique ones
        let existingVccs: any[] = []
        if (fs.existsSync(vccPath)) {
          const wb = XLSX.readFile(vccPath)
          const ws = wb.Sheets[wb.SheetNames[0]]
          existingVccs = XLSX.utils.sheet_to_json(ws)
        }

        const existingNumbers = new Set(existingVccs.map((v: any) => v.number))
        const newVccs = data.vccs.filter((v: any) => !existingNumbers.has(v.number))
        const combined = [...existingVccs, ...newVccs]

        const newWs = XLSX.utils.json_to_sheet(combined)
        const newWb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(newWb, newWs, 'VCCs')
        XLSX.writeFile(newWb, vccPath)
      }

      return { success: true }
    } catch (e: any) {
      console.error('Import failed', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('automation:save-vcc', async (event, data) => {
    const docPath = app.getPath('documents')
    const filePath = path.join(docPath, 'HyperCart_VCC.xlsx')

    // Capture Snapshot
    let snapshotPath = ''
    try {
      // Flatten rect if present
      const rect = data.rect
        ? {
            x: Math.round(data.rect.x),
            y: Math.round(data.rect.y),
            width: Math.round(data.rect.width),
            height: Math.round(data.rect.height)
          }
        : undefined
      const image = await event.sender.capturePage(rect)
      if (!image.isEmpty()) {
        const buffer = image.toPNG()

        const snapshotsDir = path.join(docPath, 'HyperCart_Snapshots')
        if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir)

        const filename = `VCC_${(data.number || '0000').slice(-4)}_${Date.now()}.png`
        snapshotPath = path.join(snapshotsDir, filename)
        fs.writeFileSync(snapshotPath, buffer)
      }
    } catch (e) {
      console.error('[IPC] Snapshot failed', e)
    }

    let wb
    let ws

    try {
      // Remove rect from saved data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { rect, ...cleanData } = data

      // Add Status & Timestamp & Snapshot
      const entry = {
        ...cleanData,
        status: 'Unused',
        created_at: new Date().toISOString(),
        snapshot: snapshotPath
      }

      if (fs.existsSync(filePath)) {
        wb = XLSX.readFile(filePath)
        ws = wb.Sheets[wb.SheetNames[0]]
        const existing = XLSX.utils.sheet_to_json(ws)
        existing.push(entry)
        const newWs = XLSX.utils.json_to_sheet(existing)
        wb.Sheets[wb.SheetNames[0]] = newWs
      } else {
        wb = XLSX.utils.book_new()
        const newWs = XLSX.utils.json_to_sheet([entry])
        XLSX.utils.book_append_sheet(wb, newWs, 'VCCs')
      }
      XLSX.writeFile(wb, filePath)
      return { success: true, path: filePath }
    } catch (e: any) {
      console.error(e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('automation:get-vcc', async (_event, amount) => {
    const docPath = app.getPath('documents')
    const filePath = path.join(docPath, 'HyperCart_VCC.xlsx')
    if (!fs.existsSync(filePath)) return null

    try {
      const wb = XLSX.readFile(filePath)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws)

      // Find first unused card. Optionally match amount if provided.
      const idx = rows.findIndex(
        (r: any) =>
          (r.status === 'Unused' || !r.status) && // Default to unused if missing
          (!amount || parseFloat(r.amount) == parseFloat(amount))
      )

      if (idx !== -1) {
        const card = rows[idx]
        // Mark Used
        rows[idx] = { ...card, status: 'Used', used_at: new Date().toISOString() }

        const newWs = XLSX.utils.json_to_sheet(rows)
        wb.Sheets[wb.SheetNames[0]] = newWs
        XLSX.writeFile(wb, filePath)
        return card
      }
      return null
    } catch (e) {
      console.error('[IPC] Get VCC Error', e)
      return null
    }
  })

  ipcMain.handle('automation:get-all-vccs', async () => {
    const docPath = app.getPath('documents')
    const filePath = path.join(docPath, 'HyperCart_VCC.xlsx')
    if (!fs.existsSync(filePath)) return []

    try {
      const wb = XLSX.readFile(filePath)
      const ws = wb.Sheets[wb.SheetNames[0]]
      return XLSX.utils.sheet_to_json(ws)
    } catch (e) {
      console.error('[IPC] Get All VCCs Error', e)
      return []
    }
  })

  ipcMain.handle('automation:delete-vccs', async (_event, numbers: string[]) => {
    const docPath = app.getPath('documents')
    const filePath = path.join(docPath, 'HyperCart_VCC.xlsx')
    if (!fs.existsSync(filePath)) return { success: false }

    try {
      const wb = XLSX.readFile(filePath)
      const ws = wb.Sheets[wb.SheetNames[0]]
      let rows: any[] = XLSX.utils.sheet_to_json(ws)

      const initialLen = rows.length
      rows = rows.filter((r: any) => !numbers.includes(r.number))

      const newWs = XLSX.utils.json_to_sheet(rows)
      wb.Sheets[wb.SheetNames[0]] = newWs
      XLSX.writeFile(wb, filePath)
      return { success: true, count: initialLen - rows.length }
    } catch (e) {
      return { success: false, error: e }
    }
  })

  ipcMain.handle('automation:export-vccs', async () => {
    const docPath = app.getPath('documents')
    const sourcePath = path.join(docPath, 'HyperCart_VCC.xlsx')
    if (!fs.existsSync(sourcePath)) return { success: false, error: 'No data to export' }

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Generated Cards',
      defaultPath: 'Generated_VCCs.xlsx',
      filters: [{ name: 'Excel File', extensions: ['xlsx'] }]
    })

    if (filePath) {
      try {
        fs.copyFileSync(sourcePath, filePath)
        return { success: true, path: filePath }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    return { success: false }
  })
  ipcMain.on('automation:save-card', (_event, cardData) => {
    // Save to vccs.json
    const vccPath = path.join(app.getPath('userData'), 'vccs-db.json')
    let existing: any[] = []
    try {
      if (fs.existsSync(vccPath)) {
        existing = JSON.parse(fs.readFileSync(vccPath, 'utf-8'))
      }
    } catch {}

    existing.push(cardData)
    fs.writeFileSync(vccPath, JSON.stringify(existing, null, 2))
    console.log('[Automation] Saved Card:', cardData.number)
  })

  ipcMain.on('automation:export-vccs', (event) => {
    const vccPath = path.join(app.getPath('userData'), 'vccs-db.json')
    const csvPath = path.join(app.getPath('desktop'), `vccs-export-${Date.now()}.csv`)

    try {
      if (!fs.existsSync(vccPath)) {
        event.sender.send('automation:export-vccs-reply', {
          success: false,
          error: 'No cards found'
        })
        return
      }
      const data = JSON.parse(fs.readFileSync(vccPath, 'utf-8'))
      const header = 'Name,Number,CVV,Expiry,Amount,Date\n'
      const rows = data
        .map((c: any) => `${c.name},${c.number},${c.cvv},${c.expiry},${c.amount},${c.generated_at}`)
        .join('\n')

      fs.writeFileSync(csvPath, header + rows)
      event.sender.send('automation:export-vccs-reply', { success: true, path: csvPath })
    } catch (e: any) {
      event.sender.send('automation:export-vccs-reply', { success: false, error: e.message })
    }
  })

  ipcMain.handle('automation:export-vccs', async () => {
    // Handle via Invoke if preferred
    const vccPath = path.join(app.getPath('userData'), 'vccs-db.json')
    const csvPath = path.join(app.getPath('desktop'), `vccs-export-${Date.now()}.csv`)

    try {
      if (!fs.existsSync(vccPath)) return { success: false, error: 'No cards' }
      const data = JSON.parse(fs.readFileSync(vccPath, 'utf-8'))
      // Simple CSV
      const header = 'Name,Number,CVV,Expiry,Amount,Date\n'
      const rows = data
        .map((c: any) => `${c.name},${c.number},${c.cvv},${c.expiry},${c.amount},${c.generated_at}`)
        .join('\n')
      fs.writeFileSync(csvPath, header + rows)
      return { success: true, path: csvPath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.on('automation:run-target', (_event, sessionId, command, data) => {
    sessionManager.runAutomation(sessionId, command, data)
  })

  // Session Management
  ipcMain.handle('session:create', async (_, id, url, ua, persist) => {
    return await sessionManager.createSession(id, url, ua, persist)
  })
  ipcMain.handle('session:close', async (_, id) => {
    return sessionManager.closeSession(id)
  })
  ipcMain.handle('session:show', async (_, id) => {
    return sessionManager.showSession(id)
  })
  ipcMain.handle('session:hide-all', async () => {
    return sessionManager.hideAllSessions()
  })
  ipcMain.handle('session:get-all', () => {
    return sessionManager.getSessionsList()
  })

  ipcMain.handle('automation:get-cards', () => {
    const vccPath = path.join(app.getPath('userData'), 'vccs-db.json')
    try {
      if (fs.existsSync(vccPath)) {
        return JSON.parse(fs.readFileSync(vccPath, 'utf-8'))
      }
    } catch (e) {
      console.error('Failed to read vccs', e)
    }
    return []
  })

  ipcMain.handle('db:factory-reset', async () => {
    try {
      const db = dbManager.getDb()

      // 1. Wipe DB Tables
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM accounts').run()
        db.prepare('DELETE FROM profiles').run()
        db.prepare('DELETE FROM orders').run()
        db.prepare('DELETE FROM settings').run()
      })
      transaction()

      // 2. Archive VCC File
      const docPath = app.getPath('documents')
      const vccPath = path.join(docPath, 'HyperCart_VCC.xlsx')
      if (fs.existsSync(vccPath)) {
        const archivePath = path.join(docPath, `HyperCart_VCC_Archived_${Date.now()}.xlsx`)
        fs.renameSync(vccPath, archivePath)
      }

      // 3. Clear Local Storage (Frontend triggers this, but we can clear server-side session files if any exist?
      // SessionManager sessions are in memory mainly or ephemeral partition. We can close all.)
      await sessionManager.hideAllSessions()
      // Optionally delete session partition data if stored on disk, but standard sessionManager logic re-creates them.

      return { success: true }
    } catch (e: any) {
      console.error('Factory Reset Failed', e)
      return { success: false, error: e.message }
    }
  })
}
