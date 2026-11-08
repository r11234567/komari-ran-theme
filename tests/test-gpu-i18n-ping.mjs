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
  console.log('1. Starting Vite server on port 5220...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5220 },
  })
  await server.listen()
  console.log('Vite server running at http://localhost:5220')

  console.log('2. Launching Chrome...')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })

  const saveScreenshots = async (baseName, fullPage = false) => {
    const p1 = path.join(ARTIFACT_DIR, `${baseName}.png`)
    const p2 = path.join(LOCAL_SHOTS_DIR, `${baseName}.png`)
    await page.screenshot({ path: p1, fullPage })
    await page.screenshot({ path: p2, fullPage })
    console.log(`Saved screenshot: ${baseName}.png`)
  }

  // ── Step 1: Overview page (V2) with GPU nodes and alerts ──
  console.log('3. Navigating to http://localhost:5220/#/v2/overview ...')
  await page.goto('http://localhost:5220/#/v2/overview', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await saveScreenshots('verification_01_overview_gpu_zh')

  // Check language buttons
  const clickLang = async (langText) => {
    const buttons = await page.$$('button')
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent?.trim(), btn)
      if (text === langText) {
        await btn.click()
        await new Promise((r) => setTimeout(r, 600))
        break
      }
    }
  }

  // ── Step 2: Language switches ──
  console.log('4. Switching to English (EN)...')
  await clickLang('EN')
  await saveScreenshots('verification_02_overview_en')

  console.log('5. Switching to Japanese (日)...')
  await clickLang('日')
  await saveScreenshots('verification_03_overview_ja')

  console.log('6. Switching to Traditional Chinese (繁)...')
  await clickLang('繁')
  await saveScreenshots('verification_04_overview_zh_tw')

  // Switch back to Simplified Chinese for next steps
  console.log('7. Switching back to Simplified Chinese (简)...')
  await clickLang('简')

  // ── Step 3: NodeDetail with GPU (795F7F9C) ──
  console.log('8. Navigating to NodeDetail with GPU (795F7F9C)...')
  await page.goto('http://localhost:5220/#/nodes/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await saveScreenshots('verification_05_nodedetail_with_gpu', true)

  // ── Step 4: NodeDetail without GPU (F47C1B82) ──
  console.log('9. Navigating to NodeDetail without GPU (F47C1B82)...')
  await page.goto('http://localhost:5220/#/nodes/F47C1B82', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await saveScreenshots('verification_06_nodedetail_no_gpu', true)

  // ── Step 5: Hub cockpit view with GPU (795F7F9C) ──
  console.log('10. Navigating to Hub cockpit (795F7F9C)...')
  await page.goto('http://localhost:5220/#/hub/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  await saveScreenshots('verification_07_hub_view', true)

  // ── Step 6: Sparse ping verification ──
  // Switch to latency tab on NodeDetail
  console.log('11. Navigating to latency tab on NodeDetail to verify PingChart...')
  await page.goto('http://localhost:5220/#/nodes/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1200))
  
  // Click Latency tab
  const tabs = await page.$$('button, [role="tab"]')
  for (const t of tabs) {
    const text = await page.evaluate((el) => el.textContent?.trim(), t)
    if (text?.includes('测速点') || text?.includes('Latency')) {
      await t.click()
      await new Promise((r) => setTimeout(r, 600))
      break
    }
  }
  await saveScreenshots('verification_08_ping_latency_tab')

  await browser.close()
  await server.close()
  console.log('All verifications completed successfully!')
}

run().catch((err) => {
  console.error('Verification error:', err)
  process.exit(1)
})
