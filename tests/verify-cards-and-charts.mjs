import { createServer } from 'vite'
import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACT_DIR = 'C:\\Users\\yuqiujiang\\.gemini\\antigravity\\brain\\32632fcb-01db-4bd0-9d0d-5826930d01ee'
const LOCAL_SHOTS_DIR = 'E:\\123\\komari-ran-theme\\docs\\screenshots'

for (const dir of [ARTIFACT_DIR, LOCAL_SHOTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function run() {
  console.log('1. Starting Vite preview server...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5230 },
  })
  await server.listen()
  console.log('Server running on http://localhost:5230')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1200'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 })

  const saveElementScreenshot = async (selector, baseName) => {
    const el = await page.$(selector)
    if (el) {
      const p1 = path.join(ARTIFACT_DIR, `${baseName}.png`)
      const p2 = path.join(LOCAL_SHOTS_DIR, `${baseName}.png`)
      await el.screenshot({ path: p1 })
      await el.screenshot({ path: p2 })
      console.log(`Saved element shot: ${baseName}.png`)
    } else {
      console.warn(`Element not found for selector: ${selector}`)
    }
  }

  const savePageScreenshot = async (baseName, fullPage = false) => {
    const p1 = path.join(ARTIFACT_DIR, `${baseName}.png`)
    const p2 = path.join(LOCAL_SHOTS_DIR, `${baseName}.png`)
    await page.screenshot({ path: p1, fullPage })
    await page.screenshot({ path: p2, fullPage })
    console.log(`Saved page shot: ${baseName}.png`)
  }

  // 1. Overview V2 - Node Cards Comparison (Compact)
  console.log('2. Loading Overview V2...')
  await page.goto('http://localhost:5230/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await savePageScreenshot('verification_cards_overview_v2')

  // Find cards on the page
  const cards = await page.$$('.precision-card')
  console.log(`Found ${cards.length} cards on overview page.`)
  if (cards.length >= 2) {
    // Card 0 is Tokyo (with GPU), Card 2 is Frankfurt (no GPU)
    const pGpu1 = path.join(ARTIFACT_DIR, 'verification_card_with_gpu.png')
    const pGpu2 = path.join(LOCAL_SHOTS_DIR, 'verification_card_with_gpu.png')
    await cards[0].screenshot({ path: pGpu1 })
    await cards[0].screenshot({ path: pGpu2 })
    console.log('Saved card_with_gpu.png')

    // Find card without GPU (Frankfurt: F47C1B82)
    for (const c of cards) {
      const text = await page.evaluate((el) => el.textContent, c)
      if (text && text.includes('frankfurt')) {
        const pNo1 = path.join(ARTIFACT_DIR, 'verification_card_no_gpu.png')
        const pNo2 = path.join(LOCAL_SHOTS_DIR, 'verification_card_no_gpu.png')
        await c.screenshot({ path: pNo1 })
        await c.screenshot({ path: pNo2 })
        console.log('Saved card_no_gpu.png')
        break
      }
    }
  }

  // 2. NodeDetail with GPU (795F7F9C) - 6 charts
  console.log('3. Loading NodeDetail with GPU (795F7F9C)...')
  await page.goto('http://localhost:5230/#/nodes/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await savePageScreenshot('verification_05_nodedetail_with_gpu', true)

  // 3. NodeDetail without GPU (F47C1B82) - 4 charts
  console.log('4. Loading NodeDetail without GPU (F47C1B82)...')
  await page.goto('http://localhost:5230/#/nodes/F47C1B82', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await savePageScreenshot('verification_06_nodedetail_no_gpu', true)

  // 4. Hub Cockpit (795F7F9C)
  console.log('5. Loading Hub cockpit (795F7F9C)...')
  await page.goto('http://localhost:5230/#/hub/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await savePageScreenshot('verification_07_hub_view', true)

  await browser.close()
  await server.close()
  console.log('Done verifying cards and charts!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
