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
  console.log('1. Starting Vite dev server on port 5215...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5215 },
  })
  await server.listen()
  console.log('✓ Vite dev server running at http://localhost:5215')

  console.log('2. Launching Chrome...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1100'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 1100 })

    // View 1: Nodes page with V2 compact card style
    console.log('3. Navigating to http://localhost:5215/#/nodes (compact style)...')
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('ran.v2.nodeCardStyle', 'compact')
    })
    await page.goto('http://localhost:5215/#/nodes', { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1800))

    const compactText = await page.evaluate(() => document.body.innerText)
    if (!compactText.includes('TRAFFIC') || !compactText.includes('还有')) {
      throw new Error('Missing traffic reset elements in compact card view')
    }
    const compactScreenshot = path.join(SCREENSHOT_DIR, 'test-traffic-reset-v2-compact.png')
    await page.screenshot({ path: compactScreenshot, fullPage: true })
    console.log(`✓ Captured: ${compactScreenshot}`)

    // View 2: Click tokyo-edge-01 to open side panel
    console.log('4. Clicking tokyo-edge-01 to inspect side detail panel...')
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div, span, a')).find(
        (e) => e.textContent && e.textContent.includes('tokyo-edge-01')
      )
      if (el) el.click()
    })
    await new Promise((r) => setTimeout(r, 1000))

    const sidePanelText = await page.evaluate(() => {
      const aside = document.querySelector('aside.precision-card')
      return aside ? aside.innerText : ''
    })
    if (!sidePanelText.includes('流量阈值') || !sidePanelText.includes('重置周期')) {
      throw new Error('Missing traffic reset elements in side detail panel')
    }
    const detailScreenshot = path.join(SCREENSHOT_DIR, 'test-traffic-reset-detail-panel.png')
    await page.screenshot({ path: detailScreenshot, fullPage: true })
    console.log(`✓ Captured: ${detailScreenshot}`)

    // View 3: Nodes page with classic card style
    console.log('5. Switching to classic card style...')
    await page.evaluate(() => {
      localStorage.setItem('ran.v2.nodeCardStyle', 'classic')
    })
    await page.goto('http://localhost:5215/#/nodes', { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1800))

    const classicCardText = await page.evaluate(() => document.body.innerText)
    if (!classicCardText.includes('流量阈值') || !classicCardText.includes('重置周期')) {
      throw new Error('Missing traffic reset elements in classic card view')
    }
    const classicCardScreenshot = path.join(SCREENSHOT_DIR, 'test-traffic-reset-v2-classic.png')
    await page.screenshot({ path: classicCardScreenshot, fullPage: true })
    console.log(`✓ Captured: ${classicCardScreenshot}`)

    // View 4: Classic Overview (/#/v1/overview)
    console.log('6. Navigating to http://localhost:5215/#/v1/overview ...')
    await page.goto('http://localhost:5215/#/v1/overview', { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1800))

    const overviewText = await page.evaluate(() => document.body.innerText)
    if (!overviewText.includes('流量阈值') || !overviewText.includes('重置周期')) {
      throw new Error('Missing traffic reset elements in classic overview')
    }
    const v1OverviewScreenshot = path.join(SCREENSHOT_DIR, 'test-traffic-reset-v1-overview.png')
    await page.screenshot({ path: v1OverviewScreenshot, fullPage: true })
    console.log(`✓ Captured: ${v1OverviewScreenshot}`)

    console.log('✓ All 4 E2E screenshot validations verified and passed!')
  } finally {
    await browser.close()
    await server.close()
    console.log('✓ Vite server and browser closed cleanly.')
  }
}

run().catch((err) => {
  console.error('E2E Test Failed:', err)
  process.exit(1)
})
