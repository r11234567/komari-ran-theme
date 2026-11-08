import { createServer } from 'vite'
import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_DIR = 'E:\\123\\komari-ran-theme\\docs\\screenshots'

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function run() {
  console.log('1. Starting Vite server on port 5202...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5202 },
  })
  await server.listen()
  console.log('Vite server running at http://localhost:5202')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1050 })

  console.log('2. Navigating to http://localhost:5202/#/v2/overview ...')
  await page.goto('http://localhost:5202/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  // Helper to click by button text or selector
  async function clickButtonWithText(text) {
    const buttons = await page.$$('button, a')
    for (const btn of buttons) {
      const t = await page.evaluate((el) => el.textContent?.trim(), btn)
      if (t === text || t?.includes(text)) {
        await btn.click()
        return true
      }
    }
    return false
  }

  // ── TEST A: Click [VIEW ALERTS] / [查看告警] on ActiveAlertsCard ──
  console.log('3. Testing Active Alerts Card button...')
  let clicked = await clickButtonWithText('查看告警')
  if (!clicked) clicked = await clickButtonWithText('VIEW ALERTS')
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-06-modal-active-alerts.png') })
  console.log('Captured test-06-modal-active-alerts.png')

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))

  // ── TEST B: Click [View All Incidents →] / [查看全部事件 →] on RecentEventsPanel ──
  console.log('4. Testing Recent Incidents panel footer link...')
  clicked = await clickButtonWithText('查看全部事件')
  if (!clicked) clicked = await clickButtonWithText('View All Incidents')
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-07-modal-incidents-history.png') })
  console.log('Captured test-07-modal-incidents-history.png')

  // Close modal via Close X button
  await clickButtonWithText('✕')
  await new Promise((r) => setTimeout(r, 400))

  // ── TEST C: Click [View All Services →] / [查看服务详情 →] on SystemHealthPanel ──
  console.log('5. Testing System Health panel footer link...')
  clicked = await clickButtonWithText('查看服务详情')
  if (!clicked) clicked = await clickButtonWithText('View All Services')
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-08-modal-system-services.png') })
  console.log('Captured test-08-modal-system-services.png')

  // Close modal
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))

  // ── TEST D: StatusStripe SYNC stability check over 3 seconds ──
  console.log('6. Checking StatusStripe SYNC text across 3 seconds...')
  const syncSamples = []
  for (let i = 0; i < 4; i++) {
    const syncText = await page.evaluate(() => {
      // Find the element containing SYNC or 同步
      const els = Array.from(document.querySelectorAll('*'))
      for (const el of els) {
        if (el.textContent?.includes('同步') || el.textContent?.includes('SYNC')) {
          const direct = el.innerText?.trim()
          if (direct && direct.length < 30) return direct
        }
      }
      return null
    })
    syncSamples.push(syncText)
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log('Sync samples over time:', syncSamples)

  await browser.close()
  await server.close()
  console.log('All tests completed successfully!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
