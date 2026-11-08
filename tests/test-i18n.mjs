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
  console.log('Starting Vite server...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5199 },
  })
  await server.listen()
  console.log('Vite server running at http://localhost:5199')

  console.log('Launching Chrome...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  console.log('Navigating to http://localhost:5199/#/v2/overview ...')
  await page.goto('http://localhost:5199/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))

  // 1. Screenshot default (zh-CN)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-01-lang-zh-CN.png') })
  console.log('Captured test-01-lang-zh-CN.png')

  // 2. Click English button ('EN')
  const buttons = await page.$$('button')
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (text === 'EN') {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 500))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-02-lang-EN.png') })
  console.log('Captured test-02-lang-EN.png')

  // 3. Click Japanese button ('日')
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (text === '日') {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 500))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-03-lang-JA.png') })
  console.log('Captured test-03-lang-JA.png')

  // 4. Click Traditional Chinese button ('繁')
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), btn)
    if (text === '繁') {
      await btn.click()
      break
    }
  }
  await new Promise((r) => setTimeout(r, 500))
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'test-04-lang-zh-TW.png') })
  console.log('Captured test-04-lang-zh-TW.png')

  await browser.close()
  await server.close()
  console.log('Done!')
}

run().catch((err) => {
  console.error('Error during test:', err)
  process.exit(1)
})
