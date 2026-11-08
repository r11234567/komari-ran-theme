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
    server: { port: 5201 },
  })
  await server.listen()
  console.log('Vite server running at http://localhost:5201')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1050 })

  console.log('Navigating to http://localhost:5201/#/v2/overview ...')
  await page.goto('http://localhost:5201/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))

  // Capture full page
  const screenshotPath = path.join(SCREENSHOT_DIR, 'test-05-alerts-incidents-v2.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log('Saved screenshot to', screenshotPath)

  // Inspect ALERT SUMMARY and RECENT INCIDENTS content
  const info = await page.evaluate(() => {
    const textNodes = Array.from(document.querySelectorAll('div, span, p, h2, h3'))
    const alertsCard = document.querySelector('section, div')
    return {
      title: document.title,
      bodySnippet: document.body.innerText.slice(0, 1500)
    }
  })
  console.log('Page text snippet:\n', info.bodySnippet)

  await browser.close()
  await server.close()
  console.log('Done.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
