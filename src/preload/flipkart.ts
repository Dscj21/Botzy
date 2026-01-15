import { ipcRenderer } from 'electron'

// 1. VISIBLE PROOF OF LIFE (Red Bar at Top)
try {
    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:5px;background:red;z-index:2147483647;pointer-events:none;box-shadow:0 0 10px red;'
    bar.id = 'orbital-proof'
    document.documentElement.appendChild(bar)
} catch (e) { console.error(e) }

// 2. REMOTE LOGGING (So we can see it in VSCode terminal)
const log = (msg: string) => {
    console.log(`[FLP] ${msg}`)
    // We assume 'ping' exists as a dummy, but let's try to verify connection
    // ipcRenderer.send('log', msg) // Requires main handler
}

log('Flipkart Script Loaded Successfully')

// 3. UI INJECTION & DATA FETCHING
let userCardName = ''

async function init() {
    try {
        const creds = await ipcRenderer.invoke('get-session-credentials')
        if (creds && creds.card_encrypted) {
            const card = JSON.parse(creds.card_encrypted)
            userCardName = (card.name || '').toUpperCase()
            log(`Loaded Card Profile: ${userCardName}`)
        }
    } catch(e) { log('Failed to load credentials') }

    injectUI()
    
    // Start Loops
    setInterval(runAutomation, 1500) // Action Loop
    setInterval(scanOffers, 3000)    // Offer Scan Loop
}

// Helper for robust clicking
function simulateClick(element: HTMLElement) {
    element.focus()
    
    // Standard Mouse Events
    const mouseEvents = ['mouseover', 'mousedown', 'mouseup', 'click']
    mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        })
        element.dispatchEvent(event)
    })
    
    // Pointer Events (Modern Frameworks often use these)
    const pointerEvents = ['pointerdown', 'pointerup']
    pointerEvents.forEach(eventType => {
         const event = new PointerEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            isPrimary: true,
            buttons: 1
         })
         element.dispatchEvent(event)
    })
}

function injectUI() {
    if (document.getElementById('orbital-status')) return
    
    const box = document.createElement('div')
    box.id = 'orbital-status'
    box.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.9);
        color: #00ff00;
        padding: 8px 12px;
        border: 1px solid #00ff00;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `
    box.innerHTML = '⚡ SYSTEM: <span style="color:white">IDLE</span>'
    document.body.appendChild(box)

    // Manual Trigger
    const btn = document.createElement('button')
    btn.innerText = '⚡ FORCE RUN'
    btn.style.cssText = `
        position: fixed;
        bottom: 50px;
        left: 10px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        z-index: 2147483647;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    `
    btn.onclick = () => {
        log('Manual Trigger Activated')
        runAutomation(true)
    }
    document.body.appendChild(btn)
}

// 4. OFFER DETECTION
function scanOffers() {
    const keywords = userCardName ? userCardName.split(' ').filter(w => w.length > 2) : []
    
    // Simple text scan of likely candidates
    const nodes = document.querySelectorAll('li, div, span')
    const detectedOffers: string[] = []
    let matchFound = false
    
    for (const node of Array.from(nodes)) {
        const text = (node as HTMLElement).innerText?.toUpperCase() || ''
        if (text.length > 150) continue
        
        // Broaden search to ensure we catch everything
        if (text.includes('% OFF') || text.includes('DISCOUNT') || text.includes('CASHBACK') || text.includes('INSTANT DISCOUNT')) {
             if (text.includes('BANK') || text.includes('CARD') || text.includes('CREDIT') || text.includes('DEBIT')) {
                 // Check duplicate
                 if (!detectedOffers.includes(text)) {
                     detectedOffers.push(text)
                     
                     // Check Match
                     if (keywords.some(k => text.includes(k))) {
                         matchFound = true
                         ;(node as HTMLElement).style.borderBottom = '3px solid #00ff00'
                         ;(node as HTMLElement).style.backgroundColor = 'rgba(0, 255, 0, 0.2)'
                     } else {
                         ;(node as HTMLElement).style.borderBottom = '1px dashed orange'
                     }
                 }
             }
        }
    }
    
    // Show Banner if ANY offers found
    if (detectedOffers.length > 0) {
        showBanner(detectedOffers, matchFound)
    }
}

function showBanner(offers: string[], matchFound: boolean) {
    const existing = document.getElementById('orbital-offer')
    if (existing) existing.remove()
    
    const banner = document.createElement('div')
    banner.id = 'orbital-offer'
    banner.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        max-height: 400px;
        overflow-y: auto;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 12px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        z-index: 2147483647;
        font-family: sans-serif;
        border: 2px solid ${matchFound ? '#00ff00' : 'orange'};
    `
    
    let html = `<div style="font-size:12px; font-weight:bold; color:${matchFound ? '#00ff00' : 'orange'}; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:4px;">
        ${matchFound ? '✅ MATCHING OFFER FOUND' : '⚠️ NO CARD MATCH FOUND'}
    </div>`
    
    offers.forEach(offer => {
        // Highlight logic
        const isMatch = userCardName && userCardName.split(' ').filter(w => w.length > 2).some(k => offer.includes(k))
        const color = isMatch ? '#00ff00' : '#aaa'
        html += `<div style="font-size:11px; margin-bottom:6px; color:${color}; line-height:1.3; border-bottom:1px solid #333; padding-bottom:4px;">${offer}</div>`
    })
    
    banner.innerHTML = html
    document.body.appendChild(banner)
}

// 5. CHECKOUT AUTOMATION
function runAutomation(force = false) {
    const url = window.location.href
    if (force) {
        log(`Force Run on: ${url}`)
    }
    
    const statusBox = document.getElementById('orbital-status')
    if (statusBox) statusBox.innerHTML = '⚡ SYSTEM: <span style="color:yellow">SCANNING...</span>'

    // Define candidates (Buttons and clickable elements)
    const elements = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], div[role="button"], span[role="button"]'))
    const candidates = elements.filter(el => (el as HTMLElement).offsetParent !== null) // Visible only

    // Helper to click
    const click = (el: HTMLElement, name: string) => {
        log(`Clicking: ${name}`)
        el.style.border = '4px solid #f0f'
        simulateClick(el)
    }
    
    // 1. "CONTINUE" (Generic)
    const continueBtn = candidates.find(b => {
        const t = (b as HTMLElement).innerText?.toUpperCase() || ''
        return t === 'CONTINUE' || t === 'SAVE AND DELIVER HERE'
    })

    if (continueBtn) {
        click(continueBtn as HTMLElement, 'CONTINUE')
        return
    }
    
    // 2. PAYMENT (Accept & Continue)
    const acceptBtn = candidates.find(b => (b as HTMLElement).innerText?.toUpperCase().includes('ACCEPT & CONTINUE'))
    if (acceptBtn) {
        click(acceptBtn as HTMLElement, 'ACCEPT & CONTINUE')
        return
    }
}

// 6. BOOTSTRAP
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
} else {
    init()
}
