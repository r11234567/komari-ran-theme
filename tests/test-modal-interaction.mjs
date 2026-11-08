import { createServer } from 'vite'
import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const SCREENSHOT_DIR = 'E:\\123\\komari-ran-theme\\docs\\screenshots'

async function run() {
  console.log('Starting Vite server...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5203 },
  })
  await server.listen()

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1050 })
  await page.goto('http://localhost:5203/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  // 1. Click "查看全部告警" on AlertSummaryPanel
  console.log('Clicking "查看全部告警" on AlertSummaryPanel...')
  const buttons = await page.$$('button, a')
  for (const btn of buttons) {
    const t = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (t?.includes('查看全部告警')) {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 600))

  // 2. Click node name "sao-paulo-relay" inside modal
  console.log('Clicking node "sao-paulo-relay" inside modal...')
  const modalButtons = await page.$$('button')
  for (const btn of modalButtons) {
    const t = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (t === 'sao-paulo-relay') {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 800))

  const shot = path.join(SCREENSHOT_DIR, 'test-09-alert-click-drawer.png')
  await page.screenshot({ path: shot })
  console.log('Captured test-09-alert-click-drawer.png')

  await browser.close()
  await server.close()
  console.log('Interaction test completed!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
