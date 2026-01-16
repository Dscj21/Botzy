const { ipcRenderer } = require('electron')

// CRITICAL FIX: Prevent generic white screen on React/Webpack apps (Flipkart)
// by removing Electron symbols that confuse the bundler.
if (window) {
    try {
        delete (window as any).exports
        delete (window as any).module
        delete (window as any).process // CRITICAL: Stop React from assuming NodeEnv and using require()
    } catch(e) {}
}

function dispatchInputEvent(element: any) { // Use any to avoid lint errors if HTMLElement not ready
    if (!element) return
    try {
        const evTypes = ['input', 'change', 'blur']
        evTypes.forEach(evt => {
            const e = new Event(evt, { bubbles: true })
            element.dispatchEvent(e)
        })
    } catch(e) {}
}
// V46 - Click Storm (Aggressive)
// console.log('[Browser Preload] Injected') 

function sendLog(message) {
    try { ipcRenderer.send('automation:log', message) } catch (e) {}
}

const Q_KEY = 'hypercart_crawl_queue'
const DONE_KEY = 'hypercart_done_session' 
const CMD_KEY = 'hypercart_pending_cmd'

function getQueue() { return JSON.parse(sessionStorage.getItem(Q_KEY) || '[]') }
function setQueue(q) { sessionStorage.setItem(Q_KEY, JSON.stringify(q)) }
function getDone() { return JSON.parse(sessionStorage.getItem(DONE_KEY) || '[]') }
function addDone(url) { 
    const d = getDone(); 
    if(!d.includes(url)) { d.push(url); sessionStorage.setItem(DONE_KEY, JSON.stringify(d)); } 
}

function processPendingCommand() {
    const cmd = sessionStorage.getItem(CMD_KEY)
    if (cmd === 'camp-checkout') {
         sessionStorage.removeItem(CMD_KEY) 
         setTimeout(() => {
             sendLog('[Auto] Resuming Checkout (Reloaded)...')
             startCheckoutLoop()
         }, 3000)
    }
    if (cmd === 'create-netsafe-pending') {
        const cfg = JSON.parse(sessionStorage.getItem('netsafe_config') || '{}')
        runNetsafeLoop(cfg)
    }
    if (cmd === 'update-profile-auto-pending') {
        sessionStorage.removeItem(CMD_KEY)
        const data = JSON.parse(sessionStorage.getItem('profile_data') || '{}')
        // We re-emit the event to ourselves to reuse the handler logic
        setTimeout(() => ipcRenderer.emit('automation:run', {}, 'update-profile-auto', data), 1000)
    }
}

// Reuse logic
async function startCheckoutLoop() {
    sendLog('[Auto] Checkout Loop Started')
    for(let i=0; i<30; i++) {
        

        // Payment Page Detection - Continue to allow VCC filling
        if (document.body.innerText.includes('Complete Payment') && !window['payment_filled']) {
             sendLog('[Auto] Payment Page Detected...')
        }

        
        const allBtns = Array.from(document.querySelectorAll('button, span, div'))
        
        // 1. POP-UP: ACCEPT & CONTINUE (Highest Priority)
        const acceptContinue = allBtns.find(b => {
            const t = ((b as HTMLElement).innerText || '').toUpperCase()
            return t.includes('ACCEPT & CONTINUE') && (b as HTMLElement).offsetParent !== null
        })
        if (acceptContinue) {
            sendLog('[Auto] > Accept & Continue')
            await aggressiveClick(acceptContinue as HTMLElement)
            await new Promise(r => setTimeout(r, 4000))
            continue
        }

        // 2. CONTINUE (Summary Page)
        const continueBtn = allBtns.find(b => {
             const t = ((b as HTMLElement).innerText || '').toUpperCase()
             return (t === 'CONTINUE') && (b as HTMLElement).offsetParent !== null && b.tagName === 'BUTTON'
        })
        if (continueBtn) {
            sendLog('[Auto] > Continue')
            await aggressiveClick(continueBtn as HTMLElement)
            await new Promise(r => setTimeout(r, 4000))
            continue
        }
        
        // 3. PLACE ORDER (Cart Page)
        // 3. PLACE ORDER (Cart Page)
        // 3. PLACE ORDER (Cart Page)
        const placeOrderCandidates = allBtns.filter(b => {
             const t = ((b as HTMLElement).innerText || '').toUpperCase()
             return t.includes('PLACE ORDER') && (b as HTMLElement).offsetParent !== null
        })
        
        if (placeOrderCandidates.length > 0) {
            window['placeOrderAttempts'] = (window['placeOrderAttempts'] || 0) + 1
            sendLog(`[Auto] > Place Order (Attempt ${window['placeOrderAttempts']}) - Found ${placeOrderCandidates.length} btns`)
            
            if (window['placeOrderAttempts'] > 5) {
                sendLog('[Auto] Button unresponsive. Forcing Navigation (Enhanced)...')
                const checkoutUrl = 'https://www.flipkart.com/checkout/init?view=FLIPKART&loginFlow=false'
                if (!window.location.href.includes('checkout/init')) window.location.href = checkoutUrl
                await new Promise(r => setTimeout(r, 6000))
                continue
            }

            for (const btn of placeOrderCandidates) {
                // sendLog(`[Auto] Clicking ${btn.tagName}.${btn.className.substring(0, 10)}...`)
                await aggressiveClick(btn as HTMLElement)
                await new Promise(r => setTimeout(r, 200)) // Rapid fire
            }
            
            await new Promise(r => setTimeout(r, 4000))
            continue
        }
        
        // 4. DELIVER HERE (Address Page - Backup)
        const deliverHere = allBtns.find(b => ((b as HTMLElement).innerText || '').toUpperCase().includes('DELIVER HERE') && (b as HTMLElement).offsetParent !== null)
        if (deliverHere) {
            sendLog('[Auto] > Deliver Here')
            await aggressiveClick(deliverHere as HTMLElement)
            await new Promise(r => setTimeout(r, 4000))
            continue
        }

        // 5. PAYMENT PAGE (Credit/Debit Card)
        const paymentHeader = Array.from(document.querySelectorAll('div, span, label')).find(el => ((el as HTMLElement).innerText || '').includes('Credit / Debit / ATM Card'))
        if (paymentHeader && !window['payment_filled']) {
            const radio = paymentHeader.closest('label') || paymentHeader.parentElement
            if (radio) {
                 // Ensure expanded
                 if (!window['payment_expanded']) {
                     radio.click()
                     window['payment_expanded'] = true
                     await new Promise(r => setTimeout(r, 2000))
                 }

                 const cardInput = document.querySelector('input[name="cardNumber"]') as HTMLInputElement
                 if (cardInput && !cardInput.value) {
                     if (!window['card_fetching']) {
                        window['card_fetching'] = true
                        sendLog('[Auto] > Payment Page Detected. Fetching VCC...')
                        
                        try {
                            const vcc = await ipcRenderer.invoke('automation:get-vcc')
                            if (vcc) {
                                sendLog(`[Auto] > Filling Card ${vcc.cardNumber.slice(-4)}`)
                                cardInput.value = vcc.cardNumber
                                dispatchInputEvent(cardInput)
                                await new Promise(r => setTimeout(r, 500))

                                const inputs = Array.from(document.querySelectorAll('input'))
                                const monthInput = inputs.find(i => i.placeholder && i.placeholder.includes('MM'))
                                const yearInput = inputs.find(i => i.placeholder && i.placeholder.includes('YY'))
                                const cvvInput = inputs.find(i => i.placeholder && i.placeholder.includes('CVV'))
                                
                                if (vcc.cardExpiry) {
                                    const [mm, yy] = vcc.cardExpiry.split('/')
                                    if (monthInput) { monthInput.value = mm; dispatchInputEvent(monthInput); }
                                    if (yearInput) { yearInput.value = yy; dispatchInputEvent(yearInput); }
                                }
                                if (cvvInput) { cvvInput.value = vcc.cardCVV; dispatchInputEvent(cvvInput); }
                                
                                sendLog('[Auto] > Card Details Filled.')
                                window['payment_filled'] = true
                                
                                await new Promise(r => setTimeout(r, 1500))
                                const payBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||'').toUpperCase().includes('PAY'))
                                if (payBtn) {
                                    sendLog('[Auto] Clicking Pay...')
                                    aggressiveClick(payBtn)
                                }
                            } else {
                                sendLog('[Auto] > No Unused VCC available!')
                            }
                        } finally {
                            window['card_fetching'] = false
                        }
                     }
                 }
            }
        }
        
        await new Promise(r => setTimeout(r, 1000))
    }
}


function clickSeeAllUpdates() {
    try {
        const candidates = Array.from(document.querySelectorAll('span, a, div, button'))
        const target = candidates.find(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.trim() === 'See All Updates')
        if (target) { (target as HTMLElement).click(); return true }
    } catch(e) {}
    return false
}

function formatDate(raw) {
    if (!raw) return ''
    try {
        let clean = raw.replace(/Delivered|Order Confirmed|on /gi, '').trim()
        clean = clean.replace(/(\d+)(st|nd|rd|th)/gi, '$1')
        clean = clean.replace(/'(\d{2})/, '20$1')
        
        const d = new Date(clean)
        if (isNaN(d.getTime())) return clean
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
    } catch (e) { return raw }
}

function scrapeDetailDOM() {
    const bodyText = document.body.innerText;
    let orderId = ''
    const idMatch = bodyText.match(/(OD\d{10,25})/)
    if (idMatch) orderId = idMatch[1]
    
    let trackingId = ''
    const courierIds = ['FMPP', 'FMPC', 'FMP', 'FPL', 'SRTP', 'EKART', 'DELHIVERY', 'ECOM']
    const strictTrackMatch = bodyText.match(new RegExp(`\\b(?:${courierIds.join('|')})[A-Za-z0-9]{8,}`, 'i'))
    if (strictTrackMatch) trackingId = strictTrackMatch[0]
    else {
         const trackedBy = bodyText.match(/tracked by\s*([A-Za-z0-9]{11,})/i) 
         if (trackedBy) trackingId = trackedBy[1]
    }
    
    const pMatch = bodyText.match(/Total\s*₹([\d,]+)/) || bodyText.match(/₹([\d,]+)/)
    const price = pMatch ? pMatch[1] : '0'
    
    let status = 'Ordered'
    if (bodyText.includes('Not Placed') || bodyText.includes('Payment Failed') || bodyText.includes('Order Not Placed')) status = 'Failed'
    else if (bodyText.includes('Delivered')) status = 'Delivered'
    else if (bodyText.includes('Cancelled')) status = 'Cancelled'
    else if (bodyText.includes('Return')) status = 'Returned'
    else if (bodyText.includes('Shipped')) status = 'Shipped'
    
    let orderDate = ''
    let deliveredDate = ''
    
    const delRegex = /Delivered(?:,| on)\s+(?:[A-Za-z]{3}\s+)?([A-Za-z]{3}\s\d{1,2}(?:,?\s\d{4})?)/i
    const ordRegex = /Order Confirmed(?:,| on)\s+(?:[A-Za-z]{3}\s+)?([A-Za-z]{3}\s\d{1,2}(?:,?\s\d{4})?)/i
    
    const delMatch = bodyText.match(delRegex)
    if (delMatch) deliveredDate = formatDate(delMatch[1])
    
    const ordMatch = bodyText.match(ordRegex)
    if (ordMatch) orderDate = formatDate(ordMatch[1])
    else orderDate = new Date().toISOString().split('T')[0]
    
    let name = ''
    const candidates = Array.from(document.querySelectorAll('a'))
        .filter(a => (a.href.includes('/p/') || a.href.includes('/dl/')) && !a.href.includes('review'))
        .map(a => ({ text: a.innerText.trim(), el: a }))
        .sort((a, b) => b.text.length - a.text.length)
    
    let imageUrl = ''
    if (candidates.length > 0) {
        name = candidates[0].text
        const img = candidates[0].el.querySelector('img') || candidates[0].el.parentElement?.querySelector('img') || candidates[0].el.parentElement?.parentElement?.querySelector('img')
        if (img) imageUrl = (img as HTMLImageElement).src
    }

    if (!imageUrl) {
        const imgs = Array.from(document.querySelectorAll('img'))
        const prodImg = imgs.find(img => img.clientWidth > 50 && img.clientHeight > 50 && img.closest('div') && !img.alt.includes('Flipkart'))
        if (prodImg) imageUrl = prodImg.src
        if (!name && prodImg) name = prodImg.alt
    }
    
    if (!name || name.startsWith('Product OD')) {
         const allDivs = Array.from(document.querySelectorAll('div, span, p'))
         let textNodes = allDivs
            .filter(d => (d as HTMLElement).children.length === 0 && (d as HTMLElement).innerText.length > 15 && (d as HTMLElement).innerText.length < 100)
            .map(d => (d as HTMLElement).innerText.trim())
            .filter(t => 
                !t.includes('Order') && !t.includes('Delivery') && !t.includes('Return') && 
                !t.includes('Request') && !t.includes('Invoice') && !t.includes('Help') &&
                !t.includes('due to') && !t.includes('error') && !t.includes('Road') && !t.includes('Cross') && !t.includes('Apartment') &&
                !t.includes('Payment') && !t.includes('successful') && !t.includes('Please place') && !t.includes('Nagar') && !t.includes('Colony') &&
                !t.includes('/') && !(t.match(/\d+,\s/)) &&
                !t.includes('received') && !t.includes('hub') && !t.includes('item has been') && !t.includes('courier')
            )
            .sort((a,b) => b.length - a.length)
         if (textNodes.length > 0) name = textNodes[0]
    }
    
    if (!name) name = 'Product ' + (orderId || 'Unknown')
    if (!orderId) return null
    
    return {
        order_id: orderId,
        product_name: name,
        price,
        status,
        order_date: orderDate,
        delivered_date: deliveredDate,
        tracking_id: trackingId,
        image_url: imageUrl,
        platform: 'FLP'
    }
}

async function runCrawler() {
    if (document.querySelector('form') && document.body.innerText.includes('Login')) {
         if (!window['hasLoggedLoginWarning']) {
            if(window.location.href.includes('login')) {
                 window['hasLoggedLoginWarning'] = true
                 // sendLog('[Crawler] ⚠ LOGIN PAGE DETECTED') 
                 return
            }
        }
    }

    const url = window.location.href
    
    if (url.includes('account/orders') || url.includes('order-history')) {
        const anchors = Array.from(document.querySelectorAll('a'))
        const validLinks = anchors
            .map(a => a.href)
            .filter(href => href.includes('order_details') || href.includes('orderId='))
            .filter(href => !href.includes('cancellation'))
        
        const uniqueLinks = [...new Set(validLinks)]
        const queue = getQueue()
        const done = getDone()

        let newCount = 0
        for (const link of uniqueLinks) {
            const cleanLink = link.split('?')[0]
            const isDone = done.some(d => d.includes(cleanLink))
            if (!isDone && !queue.includes(link)) {
                queue.push(link)
                newCount++
            }
        }
        setQueue(queue)
        
        if (newCount > 0) sendLog(`[Crawler] Added ${newCount} new orders`)
        
        if (queue.length > 0) {
            setTimeout(() => window.location.href = queue[0], 3000)
        } else {
            sendLog('[Crawler] Queue Empty - Sync Complete')
            ipcRenderer.send('orders:sync-complete')
        }
    } 
    else if (url.includes('order_details') || url.includes('order_id')) {
        await new Promise(r => setTimeout(r, 4000))

        if (clickSeeAllUpdates()) {
             await new Promise(r => setTimeout(r, 2000)) 
        }
        
        let order: any = null
        for (let i = 0; i < 3; i++) {
             order = scrapeDetailDOM()
             const badName = !order || order.product_name.startsWith('Product OD') || order.product_name.includes(',') || order.product_name.includes('Your item') || order.product_name.includes('Payment')
             
             if (order && !badName) break;
             await new Promise(r => setTimeout(r, 1500))
        }

        if (order) {
            sendLog(`[Crawler] Scraped: ${order.order_id}`)
            ipcRenderer.send('orders:scraped', [order])
        }
        const cleanUrl = url.split('?')[0]
        addDone(cleanUrl)
        
        const queue = getQueue()
        const nextQueue = queue.filter(q => q !== url && !url.includes(q))
        setQueue(nextQueue)
        
        if (nextQueue.length > 0) {
            setTimeout(() => window.location.href = nextQueue[0], 2500)
        } else {
            sendLog('[Crawler] Done. Sync Complete')
            window.location.href = 'https://www.flipkart.com/account/orders'
            ipcRenderer.send('orders:sync-complete')
        }
    } else {
        processPendingCommand()
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(processPendingCommand, 1000)
    
    if (!window.location.href.includes('viewcart') && !window.location.href.includes('checkout')) {
         setTimeout(runCrawler, 3000)
    }
})

// Helper: Find inputs across IFRAMES
const getDeepElements = (selector, root = document, depth = 0) => {
    if (depth > 3) return [];
    let elements = Array.from(root.querySelectorAll(selector));
    const frames = Array.from(root.querySelectorAll('iframe, frame'));
    frames.forEach(f => {
        try {
            // @ts-ignore
            const doc = f.contentDocument || (f.contentWindow && f.contentWindow.document);
            if (doc) {
                elements = elements.concat(getDeepElements(selector, doc, depth + 1));
            }
        } catch(e) {}
    });
    return elements;
};


function sendProgress(generated, total, status) {
    try { ipcRenderer.send('automation:progress', { generated, total, status }) } catch (e) {}
}

async function runNetsafeLoop(cfg) {
    // Session state
    let total = parseInt(cfg.count) || 1
    let generated = parseInt(sessionStorage.getItem('netsafe_generated_count') || '0')
    
    if (generated >= total) {
        sendLog(`[Netsafe] Job Complete: ${generated}/${total} cards generated.`)
        sendProgress(generated, total, 'Completed')
        sessionStorage.removeItem(CMD_KEY)
        sessionStorage.removeItem('netsafe_generated_count')
        return
    }

    sendProgress(generated, total, 'Scanning...')


    // VISUAL DEBUGGER REMOVED
    // let debugOverlay = document.getElementById('netsafe-debug-overlay');
    // if (!debugOverlay) { ... }
    
    // Debugging: Check visibility
    // Debugging: Check visibility
    // Removed unused vars
    

    // 1. Check Login
    if (document.querySelector('input[type="password"]')) {
        sendProgress(generated, total, 'Login Detected')
        if (!window['netsafe_log_login']) { window['netsafe_log_login'] = true; sendLog('[Netsafe] Login Page Detected'); }
        
        if (cfg.username && cfg.password) {
             const inputs = Array.from(document.querySelectorAll('input')).filter(el => {
                 const t = (el.type || '').toLowerCase()
                 return ['text','password','number','email','tel'].includes(t) && el.offsetParent !== null
             })
             
             inputs.sort((a,b) => {
                 const ra = a.getBoundingClientRect()
                 const rb = b.getBoundingClientRect()
                 return ra.top - rb.top
             })
             
             if (inputs.length >= 2 && !window['netsafe_filled']) {
                  const userInp = inputs[0] as HTMLInputElement
                  const passInp = inputs[1] as HTMLInputElement
                  
                  // Robust Fill
                  userInp.focus()
                  userInp.value = cfg.username
                  dispatchInputEvent(userInp)
                  userInp.dispatchEvent(new Event('change', { bubbles: true }))
                  userInp.blur()
                  
                  await new Promise(r => setTimeout(r, 200))

                  passInp.focus()
                  passInp.value = cfg.password
                  dispatchInputEvent(passInp)
                  passInp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
                  passInp.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }))
                  passInp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
                  passInp.dispatchEvent(new Event('change', { bubbles: true }))
                  passInp.blur()
                  
                  window['netsafe_filled'] = true
                  sendLog('[Netsafe] Credentials Filled. Please Solve Captcha & Login manually.')
             }
        }
    }
    
    // 2. Main Generation Flow (Radio -> Amount -> Go)
    
    // Step A: Select Radio (if exists and needed)
    const allRadios = getDeepElements('input[type="radio"]') as HTMLInputElement[];
    const cardRadio = allRadios.find(r => r.offsetParent !== null); 
    if (cardRadio && !cardRadio.checked) {
         sendLog('[Netsafe] Selecting Card Account (Radio Button)...');
         aggressiveClick(cardRadio);
         await new Promise(r => setTimeout(r, 1000));
    }

    // Step B: Robust Amount Finding (Proximity to "Go" Button)
    let amountInp: HTMLInputElement | null = null;
    let goBtn: HTMLElement | null = null;

    // Find "Go" Button first
    const allBtns = getDeepElements('button, input[type="button"], input[type="submit"], input[type="image"], a, div[role="button"]');
    goBtn = allBtns.find(b => {
         const t = (b.innerText || b.getAttribute('value') || b.getAttribute('alt') || b.getAttribute('src') || '').trim().toLowerCase();
         return (t === 'go' || t.includes('go.gif') || t.includes('go.jpg') || t === 'submit') && b.offsetParent !== null;
    }) as HTMLElement | null;

    if (goBtn) {
         // Search for inputs IN THE SAME DOCUMENT (Context safe)
         const localInputs = Array.from(goBtn.ownerDocument.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
         const goRect = goBtn.getBoundingClientRect();
         
         const candidates = localInputs.filter(i => {
              const r = i.getBoundingClientRect();
              if (r.width < 10 || r.height < 10) return false; // Must be visible
              
              // Logic: Input is to the Left of Go, and Vertically Aligned
              const isLeft = r.right <= goRect.left + 50; 
              const isCloseX = (goRect.left - r.right) < 300; 
              const isAlignedY = Math.abs(r.top - goRect.top) < 40; 
              
              return isLeft && isCloseX && isAlignedY;
         });

         // Sort by proximity (closest to Go button)
         candidates.sort((a,b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
         
         if (candidates.length > 0) amountInp = candidates[0];
    }
    
    // Fallback: Name based if Proximity fails
    if (!amountInp) {
         const allInputs = getDeepElements('input:not([type="hidden"]):not([disabled])') as HTMLInputElement[];
         amountInp = allInputs.find(i => {
              const n = (i.name || '').toLowerCase();
              const id = (i.id || '').toLowerCase();
              return (
                  (n === 'txttxnamount' || n === 'fldamt' || n === 'amt' || n.includes('amount') || id.includes('amount')) && !n.includes('captcha')
              );
         }) || null;
    }

    // Update Debug Overlay (Removed)
    // if (debugOverlay) { ... }

    // Fill Amount
    if (amountInp && (!amountInp.value || amountInp.value !== cfg.amount)) {
        sendProgress(generated, total, 'Filling Amount...')
        amountInp.focus();
        amountInp.value = cfg.amount;
        
        // Dispatch multiple events to ensure binding
        dispatchInputEvent(amountInp);
        ['keydown', 'keypress', 'keyup', 'input', 'change'].forEach(type => {
            amountInp!.dispatchEvent(new KeyboardEvent(type, { key: '0', code: 'Digit0', bubbles: true }));
        });
        amountInp.blur(); 
        
        sendLog('[Netsafe] Amount Entered via Proximity/ID.');
        await new Promise(r => setTimeout(r, 500));
    }

    // Click Go
    if (goBtn && amountInp && amountInp.value && !window['netsafe_go_clicked']) {
        sendLog('[Netsafe] Clicking "Go"...');
        aggressiveClick(goBtn);
        window['netsafe_go_clicked'] = true; 
        setTimeout(() => { window['netsafe_go_clicked'] = false }, 5000); 
    }
    
    // 3. Check "Agree" Button (Terms & Conditions)
    const agreeBtn = getDeepElements('a, button, input[type="button"], input[type="submit"]').find(b => {
         const t = ((b as HTMLElement).innerText || b.getAttribute('value') || '').toUpperCase();
         return (t === 'AGREE' || t === 'ACCEPT') && (b as HTMLElement).offsetParent !== null;
    }) as HTMLElement;
    
    if (agreeBtn) {
         sendLog('[Netsafe] "Agree" button found. Clicking...');
         aggressiveClick(agreeBtn);
         await new Promise(r => setTimeout(r, 1000));
    }

    // 4. Check Final Form (Beneficiary Details)
    // Deep detect form interactions
    let targetDoc = document as Document;
    let formFound = false;
    
    // Check main doc
    if (document.body.innerText.includes('Beneficiary Name')) formFound = true;
    
    // Check iframes if not found
    if (!formFound) {
        const frames = Array.from(document.querySelectorAll('iframe, frame'));
        for (const f of frames) {
            try {
                // @ts-ignore
                const d = f.contentDocument || f.contentWindow.document;
                if (d && d.body.innerText.includes('Beneficiary Name')) {
                    targetDoc = d;
                    formFound = true;
                    break;
                }
            } catch(e) {}
        }
    }

     if (formFound && !window['netsafe_form_submitted']) {
          sendLog(`[Netsafe] Beneficiary Form Detected. Filling...`);
          sendProgress(generated, total, 'Filling Form...')
          
          const dispatchInputEvent = (el) => {
                if (!el) return;
                el.focus();
                el.setAttribute('value', el.value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            };

          const getLabelledInput = (labelText: string): HTMLInputElement | null => {
              // 1. Try finding by ID from label for attribute
              const labels = Array.from(targetDoc.querySelectorAll('label'));
              const matchingLabel = labels.find(l => (l.innerText || '').toLowerCase().includes(labelText.toLowerCase()));
              if (matchingLabel && matchingLabel.getAttribute('for')) {
                  const el = targetDoc.getElementById(matchingLabel.getAttribute('for')!) as HTMLInputElement;
                  if (el) return el;
              }
              // 2. Try nearby input
              if (matchingLabel) {
                  // Check parent's next sibling or children
                  // This matches HDFC's table structure often
                  let p = matchingLabel.parentElement;
                  while(p) {
                      const inp = p.querySelector('input, textarea') as HTMLInputElement;
                      if (inp) return inp;
                      if (p.nextElementSibling) {
                          const inp2 = p.nextElementSibling.querySelector('input, textarea') as HTMLInputElement;
                          if (inp2) return inp2;
                      }
                      p = p.parentElement;
                      if (p === document.body) break;
                  }
              }
              return null;
          }

          const setVal = (selectors: string[], labelKey: string, val: string, isPassword = false) => {
               if(val === undefined || val === null) return;
               
               let el: HTMLInputElement | null = null;
               
               // Strategy A: Selectors
               for (const s of selectors) {
                   el = targetDoc.querySelector(s) as HTMLInputElement;
                   if (el) break;
               }

               // Strategy B: Label Search
               if (!el && labelKey) {
                   el = getLabelledInput(labelKey);
               }

               if(el) {
                   // Anti-Autofill: If this is NOT a password field, but contains a value with '@' or looks like a password, CLEAR IT.
                   if (!isPassword && !labelKey.includes('Email') && el.value && el.value.length > 5 && /[0-9]/.test(el.value) && /[@#$%]/.test(el.value)) {
                        el.value = '';
                   }
                   
                   // Only set if different to avoid infinite event loops if listener exists
                   if (el.value !== val) {
                       el.value = val;
                       dispatchInputEvent(el);
                   }
               }
          }

          // Interval filling to overwrite autofill
          const intervalId = setInterval(() => {
                if (window['netsafe_form_submitted']) {
                    clearInterval(intervalId);
                    return;
                }

                // 1. Cardholder
                setVal(['input[name="txtCardholderName"]'], 'Cardholder', cfg.cardholderName);

                // 2. Beneficiary Name 
                setVal(['input[name="txtBeneficiaryName"]'], 'Beneficiary Name', cfg.beneficiaryName);
                
                // 3. Email & Confirm
                setVal(['input[name="txtBeneficiaryEmail"]'], 'Beneficiary Email', cfg.email);
                setVal(['input[name="txtReenterEmail"]'], 'Confirm Beneficiary Email', cfg.confirmEmail || cfg.email);

                // 4. Mobile & Confirm (Enhanced to skip prefix fields)
                // We create a custom selector strategy for mobile to avoid the ISD code box
                const mobileHandler = (selectors: string[], label: string, val: string) => {
                     // Try standard setVal first
                     let el: HTMLInputElement | null = null;
                     for (const s of selectors) {
                        el = targetDoc.querySelector(s) as HTMLInputElement;
                        if (el) break;
                     }
                     if (!el) el = getLabelledInput(label);

                     // Smart Check: If element is too small (width < 50px) or maxlength < 10, find next sibling
                     if (el) {
                         const r = el.getBoundingClientRect();
                         const maxLen = parseInt(el.getAttribute('maxlength') || '100');
                         if ((r.width > 0 && r.width < 60) || maxLen < 10) {
                             // This is likely the prefix/ISD box. Find the NEXT input.
                             let next = el.nextElementSibling;
                             while(next) {
                                 const nextInp = next.querySelector('input') || (next.tagName === 'INPUT' ? next : null);
                                 if (nextInp && nextInp.getBoundingClientRect().width > 60) {
                                     el = nextInp as HTMLInputElement;
                                     break;
                                 }
                                 next = next.nextElementSibling;
                             }
                             // If not found in siblings, try parent's next sibling
                             if (!next && el.parentElement && el.parentElement.nextElementSibling) {
                                  const parentNext = el.parentElement.nextElementSibling.querySelector('input');
                                  if (parentNext) el = parentNext as HTMLInputElement;
                             }
                         }
                         
                         if (el && el.value !== val) {
                             el.value = val;
                             dispatchInputEvent(el);
                         }
                     }
                }

                mobileHandler(['input[name="txtBeneficiaryMobile"]', 'input[name="txtMobileNo"]'], 'Beneficiary Mobile', cfg.mobile);
                mobileHandler(['input[name="txtReenterBeneficiaryMobile"]', 'input[name="txtReenterMobileNo"]'], 'Confirm Beneficiary Mobile', cfg.confirmMobile || cfg.mobile);

                // 5. Message
                setVal(['input[name="txtMessage"]', 'textarea[name="txtMessage"]'], 'Message', cfg.message || 'Gift');

                // 6. Passwords (VCC login password)
                // Use isPassword=true
                setVal(['input[name="txtPassword"]'], 'Password', cfg.cardPassword || cfg.password, true);
                setVal(['input[name="txtReenterPassword"]'], 'Confirm Password', cfg.cardPassword || cfg.password, true);

          }, 300);

          sendLog('[Netsafe] Form Filled. Submitting in 3s...');
          
          await new Promise(r => setTimeout(r, 3000));
          
          // Try standard submit button selectors
          let sendBtn = targetDoc.querySelector('input[type="image"][alt="Send"], input[src*="send.gif"], input[src*="submit.gif"]') as HTMLElement;
          if (!sendBtn) {
             sendBtn = Array.from(targetDoc.querySelectorAll('a, button, input[type="button"], input[type="submit"], img')).find(b => {
                const t = ((b as HTMLElement).innerText || b.getAttribute('alt') || b.getAttribute('value') || b.getAttribute('src') || '').toLowerCase();
                return (t.includes('send') || t.includes('submit') || t === 'go') && (b as HTMLElement).offsetParent !== null;
            }) as HTMLElement;
          }
          
          if (sendBtn) {
              window['netsafe_form_submitted'] = true; // Stop interval
              sendLog('[Netsafe] Clicking Send...');
              aggressiveClick(sendBtn);
          }
     }

    // 5. Check Card Details & Save
    const body = document.body.innerText
    // Pattern: 16 digits often spaced
    const cardMatch = body.match(/\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/)
    if (cardMatch && (body.includes('CVV') || body.includes('C V V'))) {
         if (!window['cardSaved']) {
            window['cardSaved'] = true
            
            // Looser regex to assume text nearby, handling "CVV2 - ", "Expiry - ", etc.
            const cvvMatch = body.match(/(?:CVV2|CVV|C\s*V\s*V)(?:[^0-9]{0,20})(\d{3})/i)
            const expMatch = body.match(/(?:Expiry|Exp|Valid)(?:[^0-9]{0,20})(\d{2}\/\d{2})/i)
            
            const details = {
                number: cardMatch[0].replace(/\s/g, ''),
                cvv: cvvMatch ? cvvMatch[1] : '???',
                expiry: expMatch ? expMatch[1] : '??/??',
                amount: cfg.amount
            }

            sendLog(`[Netsafe] Card Generated! (${generated + 1}/${total})`)
            // Copy to clipboard for user convenience (optional "fast" feature)
            try { 
                const { clipboard } = require('electron')
                clipboard.writeText(`${details.number}|${details.expiry}|${details.cvv}`)
            } catch(e) {}

            // Attempt to capture visual card area
            let rect: any = undefined
            try {
                const cleanNum = (details.number || '').replace(/\s/g, '');
                // Find element containing this number (spaced or unspaced)
                const allEls = Array.from(document.body.querySelectorAll('*'))
                const targetEl = allEls.find(e => {
                     // @ts-ignore
                     if (e.children.length > 0) return false // Leaf nodes only for text
                     // @ts-ignore
                     const t = (e.innerText || '').replace(/\s/g, '')
                     return t.includes(cleanNum)
                }) || allEls.find(e => {
                     // @ts-ignore
                     const t = (e.innerText || '').replace(/\s/g, '')
                     return t.includes(cleanNum)
                })

                if (targetEl) {
                     // Look for a container with card-like dimensions
                     let el: Element | null = targetEl
                     let foundContainer = false
                     for (let i=0; i<8; i++) {
                         if (!el || el.tagName === 'BODY') break
                         const r = el.getBoundingClientRect()
                         // Card aspect ratio is ~1.58. Accept 1.4 - 1.8. Width usually > 250px.
                         const aspect = r.width / r.height
                         if (r.width > 250 && r.width < 800 && aspect > 1.3 && aspect < 2.0) {
                             rect = { x: r.x, y: r.y, width: r.width, height: r.height }
                             foundContainer = true
                             break
                         }
                         el = el.parentElement
                     }
                     if (!foundContainer && targetEl) {
                         const r = targetEl.getBoundingClientRect()
                         // Fallback: padded box around number
                         rect = { 
                             x: Math.max(0, r.x - 40), 
                             y: Math.max(0, r.y - 80), 
                             width: 400, 
                             height: 250 
                         }
                     }
                }
            } catch(e) {}

            await ipcRenderer.invoke('automation:save-vcc', { ...details, rect })
            
            // Increment
            generated++
            sessionStorage.setItem('netsafe_generated_count', generated.toString())
            sendProgress(generated, total, 'Card Generated')
            
            if (generated < total) {
                sendLog('[Netsafe] Waiting before next card...')
                await new Promise(r => setTimeout(r, 3000))
                
                // Try to find a "Back" or "Generate Another" button
                const backBtn = getDeepElements('a, button, input').find(b => {
                    const t = ((b as HTMLElement).innerText || (b as HTMLInputElement).value || '').toLowerCase()
                    // Exclude "ivr" to avoid "Generate IVR Password" link
                    // Look for specific "back" or "create another" or generic "generate" but strictly NOT ivr or log
                    return (t.includes('back') || t.includes('create another') || (t.includes('generate') && !t.includes('ivr'))) 
                           && !t.includes('log') && !t.includes('profile')
                }) as HTMLElement
                
                if (backBtn) {
                     sendLog('[Netsafe] Found Back button, clicking...')
                     aggressiveClick(backBtn)
                } else {
                     sendLog('[Netsafe] Back button not found, forcing reload...')
                     // Force Reload / Navigate to entry
                     window.location.href = 'https://netsafe.hdfc.bank.in/ACSWeb/enrolljsp/HDFCValidate.jsp'
                }
            } else {
                sendLog('[Netsafe] All Cards Generated. Job Done.')
                sendProgress(generated, total, 'Completed')
                sessionStorage.removeItem(CMD_KEY)
            }
        }
    }
    
    // Loop frequency
    setTimeout(() => runNetsafeLoop(cfg), 1500)
}

// --- AGGRESSIVE CLICKER ---
async function aggressiveClick(el, depth = 0) {
    if (!el || depth > 2) return false
    
    try {
        el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        await new Promise(r => setTimeout(r, 150))
        
        const rect = el.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        
        // 1. Mouse Clicks (Native & JS)
        if (rect.width > 0 && rect.height > 0) {
            try { await ipcRenderer.invoke('automation:click-at', { x, y }) } catch(e){}
            await new Promise(r => setTimeout(r, 50))
            try { await ipcRenderer.invoke('automation:click-at', { x: x-5, y: y-5 }) } catch(e){}
        }
        
        const evts = ['mousedown', 'mouseup', 'click']
        evts.forEach(t => {
            el.dispatchEvent(new MouseEvent(t, { 
                bubbles: true, cancelable: true, view: window,
                buttons: 1, clientX: x, clientY: y 
            }))
        })
        el.click() 
        
        // 2. KEYBOARD FALLBACK (The Real Fix)
        try {
            if (el.tabIndex < 0) el.tabIndex = 0 // Force focusable
            el.focus()
            await ipcRenderer.invoke('automation:keypress', { key: 'Enter' })
            await new Promise(r => setTimeout(r, 50))
            await ipcRenderer.invoke('automation:keypress', { key: ' ' }) // Spacebar too
        } catch (e) { }

        // 3. Parent Propagation
        if (el.parentElement && (el.parentElement.tagName === 'BUTTON' || el.parentElement.tagName === 'DIV' || el.parentElement.tagName === 'A')) {
             aggressiveClick(el.parentElement, depth + 1)
        }
        
        return true
    } catch(e) { 
        return false 
    }
}

ipcRenderer.on('automation:run', async (_event, command, data) => {
    if(command !== 'add-to-cart') sendLog(`[Auto] Running: ${command}`)
    
    // Helper to get base domain URL
    const getBaseUrl = () => {
        const host = window.location.hostname;
        if (host.includes('shopsy')) return 'https://www.shopsy.in';
        return 'https://www.flipkart.com';
    }

    try {
        if (command === 'empty-cart') {
            if (!window.location.href.includes('viewcart')) {
                window.location.href = `${getBaseUrl()}/viewcart`
                return
            }
            await new Promise(r => setTimeout(r, 2000))
            let removedCount = 0
            for(let i=0; i<15; i++) {
                const allElements = Array.from(document.querySelectorAll('div, span, button'))
                const removeBtn = allElements.find(el => {
                    const text = ((el as HTMLElement).innerText || '').trim().toLowerCase()
                    if (text === 'remove' && (el as HTMLElement).offsetParent !== null) return true
                    return false
                })
                if (!removeBtn) break
                await aggressiveClick(removeBtn as HTMLElement)
                await new Promise(r => setTimeout(r, 1000))
                
                let confirmBtn = Array.from(document.querySelectorAll('div, button, span')).find(el => {
                     const text = ((el as HTMLElement).innerText || '').trim().toLowerCase()
                     return text === 'remove' && el !== removeBtn && el.isConnected && el.closest('div._3dsJAO')
                })
                if(!confirmBtn) confirmBtn = document.querySelector('div._3dsJAO._24d-qY.FhkMJZ') || undefined
                if (confirmBtn) {
                    await aggressiveClick(confirmBtn as HTMLElement)
                    await new Promise(r => setTimeout(r, 2000))
                    removedCount++
                }
            }
            if (removedCount > 0) sendLog(`[Auto] Emptied ${removedCount} items`)
        }
        
        if (command === 'add-to-cart') {
            if (data.url && !window.location.href.includes(data.url)) { window.location.href = data.url; return; }
            await new Promise(r => setTimeout(r, 3000))
            let success = false
            for(let attempt=0; attempt<3; attempt++) {
                const btns = Array.from(document.querySelectorAll('button, div, span, ul li'))
                const goBtn = btns.find(b => ((b as HTMLElement).innerText || '').toUpperCase().includes('GO TO CART'))
                if (goBtn) { success = true; break; }
                
                let candidates = btns.filter(b => {
                    const txt = ((b as HTMLElement).innerText || '').toUpperCase()
                    if (!txt.includes('ADD TO CART') || (b as HTMLElement).offsetParent === null) return false
                    const tagName = b.tagName.toUpperCase()
                    const className = b.className || ''
                    if (tagName === 'BUTTON') return true
                    if (className.includes('_2KpZ6l')) return true 
                    if (tagName === 'LI' && b.children.length < 3) return true
                    return false 
                })
                candidates.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
                candidates = candidates.filter(b => b.getBoundingClientRect().height < 100)

                if (candidates.length > 0) {
                    const addBtn = candidates[0]
                    sendLog(`[Auto] Adding to Cart...`)
                    await aggressiveClick(addBtn as HTMLElement)
                    for(let k=0; k<12; k++) {
                        await new Promise(r => setTimeout(r, 250))
                        const checkBtns = Array.from(document.querySelectorAll('button, div, span'))
                        const foundGo = checkBtns.find(b => ((b as HTMLElement).innerText || '').toUpperCase().includes('GO TO CART'))
                        if (foundGo) { success = true; break }
                    }
                    if(success) break
                    const skipBtn = btns.find(b => {
                         const t = ((b as HTMLElement).innerText || '').toUpperCase()
                         return (t === 'SKIP' || t === 'CONTINUE' || t === 'SAVE & CONTINUE') && (b as HTMLElement).offsetParent !== null
                    })
                    if (skipBtn) await aggressiveClick(skipBtn as HTMLElement)
                }
            }
            if (success) {
                 sendLog('[Auto] Successfully Added.')
                 window.location.href = `${getBaseUrl()}/viewcart`
            } else {
                 if(!document.body.innerText.includes('GO TO CART')) sendLog('[Auto] Retry/Check needed.')
                 window.location.href = `${getBaseUrl()}/viewcart`
            }
        }

        if (command === 'update-profile-auto') {
             // Login Handling
             const loginBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Login'));
             if (document.querySelector('input[type="password"]') && data.password && !window.location.href.includes('address')) {
                  const u = document.querySelector('input[type="text"], input[type="email"]') as HTMLInputElement;
                  const p = document.querySelector('input[type="password"]') as HTMLInputElement;
                  if (u && data.email) { u.value = data.email; u.dispatchEvent(new Event('input', {bubbles:true})); }
                  if (p) { p.value = data.password; p.dispatchEvent(new Event('input', {bubbles:true})); }
                  
                  if (loginBtn) {
                      sendLog('[Auto] Login needed. logging in...')
                      sessionStorage.setItem(CMD_KEY, 'update-profile-auto-pending')
                      sessionStorage.setItem('profile_data', JSON.stringify(data))
                      aggressiveClick(loginBtn as HTMLElement);
                  }
                  return;
             }

             // Address Page Handling
             if (window.location.href.includes('address')) {
                  const addBtn = Array.from(document.querySelectorAll('div, button')).find(el => (el as HTMLElement).innerText?.toUpperCase() === 'ADD A NEW ADDRESS');
                  if (addBtn) {
                       await aggressiveClick(addBtn as HTMLElement);
                       await new Promise(r => setTimeout(r, 2000));
                  }
                  
                  const fillField = (identifiers: string[], val: string, isTextarea = false) => {
                      if (!val) return;
                      const allInputs = Array.from(document.querySelectorAll(isTextarea ? 'textarea' : 'input'));
                      const el = allInputs.find(i => {
                          const t = (i.getAttribute('name') || '').toLowerCase();
                          const p = (i.getAttribute('placeholder') || '').toLowerCase();
                          let labelText = '';
                          if (i.previousElementSibling) labelText += (i.previousElementSibling as HTMLElement).innerText || '';
                          if (i.parentElement?.previousElementSibling) labelText += (i.parentElement.previousElementSibling as HTMLElement).innerText || '';
                          
                          labelText = labelText.toLowerCase();
                          return identifiers.some(id => t.includes(id) || p.includes(id) || labelText.includes(id));
                      }) as HTMLInputElement | HTMLTextAreaElement;
                      
                      if (el) {
                           el.value = val;
                           el.dispatchEvent(new Event('input', {bubbles:true}));
                           el.dispatchEvent(new Event('change', {bubbles:true}));
                      }
                  };

                  // Fields matching user screenshot
                  fillField(['name'], data.name);
                  fillField(['mobile', 'phone'], data.mobile);
                  fillField(['pincode'], data.pincode);
                  // Screenshot shows Locality = City (Amritsar)
                  fillField(['locality'], data.city); 
                  fillField(['address', 'area', 'street'], data.address, true);
                  fillField(['city', 'district', 'town'], data.city);
                  fillField(['state'], data.state);

                  // Set "Home" as Address Type
                  const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                  const homeRadio = radios.find(r => {
                      const l = (r.parentElement?.innerText || '').toLowerCase();
                      const sib = ((r.nextElementSibling as HTMLElement)?.innerText || '').toLowerCase();
                      return l.includes('home') || sib.includes('home');
                  });
                  if (homeRadio) aggressiveClick(homeRadio as HTMLElement);
                  
                  await new Promise(r => setTimeout(r, 1000));
                  const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toUpperCase() === 'SAVE');
                  if (saveBtn) await aggressiveClick(saveBtn as HTMLElement);
                  sendLog('[Auto] Address details submitted.');
             }
        }
        
        if (command === 'camp-checkout') {
             const allBtns = Array.from(document.querySelectorAll('button, span, div'))
             const visibleCheckoutBtn = allBtns.find(b => {
                 const t = ((b as HTMLElement).innerText || '').toUpperCase()
                 return (t.includes('PLACE ORDER') || t.includes('DELIVER HERE') || t.includes('CONTINUE')) && (b as HTMLElement).offsetParent !== null
             })
             
             if (visibleCheckoutBtn) {
                 startCheckoutLoop()
                 return
             }
             
             if (!window.location.href.includes('viewcart') && !window.location.href.includes('checkout')) {
                  sendLog('[Auto] Navigating to Cart...')
                  sessionStorage.setItem(CMD_KEY, 'camp-checkout')
                  window.location.href = `${getBaseUrl()}/viewcart`
                  return
             }
             startCheckoutLoop()
        }
        
        if (command === 'create-netsafe') {
             sessionStorage.setItem(CMD_KEY, 'create-netsafe-pending')
             sessionStorage.setItem('netsafe_config', JSON.stringify(data))
             sendLog('[Auto] Navigating to HDFC Netsafe...')
             window.location.href = 'https://netsafe.hdfc.bank.in/ACSWeb/enrolljsp/HDFCValidate.jsp'
        }
    } catch(e: any) {
        sendLog(`[Auto] Error: ${e.message}`)
    }
})
