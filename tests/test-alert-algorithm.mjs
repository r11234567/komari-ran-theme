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
  console.log('1. Starting Vite server on port 5204...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5204 },
  })
  await server.listen()
  console.log('Vite server running at http://localhost:5204')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })

  console.log('2. Navigating to http://localhost:5204/#/v2/overview ...')
  await page.goto('http://localhost:5204/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  // Screenshot 1: Overview page showing Alert Summary and Attention Needed Table
  const shot1 = path.join(SCREENSHOT_DIR, 'test-10-optimized-alerts-overview.png')
  await page.screenshot({ path: shot1, fullPage: true })
  console.log('Captured test-10-optimized-alerts-overview.png')

  // Screenshot 2: Click [VIEW ALERTS] / [查看告警] to open ActiveAlertsModal
  console.log('3. Opening ActiveAlertsModal...')
  const buttons = await page.$$('button, a')
  for (const btn of buttons) {
    const t = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (t === '查看告警' || t === 'VIEW ALERTS') {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 600))

  const shot2 = path.join(SCREENSHOT_DIR, 'test-11-optimized-alerts-modal.png')
  await page.screenshot({ path: shot2 })
  console.log('Captured test-11-optimized-alerts-modal.png')

  // Inspect modal text
  const modalText = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]')
    return modal ? modal.innerText : 'Modal not found'
  })
  console.log('Modal text content:\n', modalText)

  await browser.close()
  await server.close()
  console.log('Verification completed successfully!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
