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
  console.log('1. Starting Vite server...')
  const server = await createServer({
    root: 'E:/123/komari-ran-theme',
    server: { port: 5240 },
  })
  await server.listen()
  console.log('Server started on port 5240')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1200'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 })

  const save = async (name, buffer) => {
    fs.writeFileSync(path.join(ARTIFACT_DIR, `${name}.png`), buffer)
    fs.writeFileSync(path.join(LOCAL_SHOTS_DIR, `${name}.png`), buffer)
    console.log(`Saved: ${name}.png`)
  }

  // 1. Capture Node Cards on /#/nodes
  console.log('2. Navigating to /#/nodes...')
  await page.goto('http://localhost:5240/#/nodes', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  const cards = await page.$$('.precision-card.liftable')
  console.log(`Found ${cards.length} cards`)
  if (cards.length >= 3) {
    // Card 0: tokyo-edge-01 (GPU RTX 4090 - 4 sparklines)
    const bufGpu = await cards[0].screenshot()
    await save('verification_card_gpu_detail', bufGpu)

    // Card 2: frankfurt-mesh-04 (No GPU - 2 sparklines)
    const bufNoGpu = await cards[2].screenshot()
    await save('verification_card_nogpu_detail', bufNoGpu)
  }

  // Also switch to Compact view on /#/nodes and capture compact cards
  const viewButtons = await page.$$('button')
  for (const b of viewButtons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), b)
    if (text === 'COMPACT' || text === '紧凑') {
      await b.click()
      await new Promise((r) => setTimeout(r, 600))
      break
    }
  }

  const compactCards = await page.$$('.precision-card.liftable')
  if (compactCards.length >= 3) {
    const bufCompactGpu = await compactCards[0].screenshot()
    await save('verification_compact_card_gpu', bufCompactGpu)
    const bufCompactNoGpu = await compactCards[2].screenshot()
    await save('verification_compact_card_nogpu', bufCompactNoGpu)
  }

  // Full Overview page shot
  await save('verification_01_overview_gpu_zh', await page.screenshot({ fullPage: false }))

  // 2. NodeDetail with GPU (795F7F9C) - charts section & full page
  console.log('3. Navigating to /#/nodes/795F7F9C...')
  await page.goto('http://localhost:5240/#/nodes/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  await save('verification_05_nodedetail_with_gpu', await page.screenshot({ fullPage: true }))

  // Capture charts grid specifically
  const chartsGridGpu = await page.$('.nodetable-grid, div[style*="grid-template-columns: repeat(2, 1fr)"]')
  if (chartsGridGpu) {
    await save('verification_nodedetail_6charts_gpu', await chartsGridGpu.screenshot())
  }

  // 3. NodeDetail without GPU (F47C1B82) - charts section & full page
  console.log('4. Navigating to /#/nodes/F47C1B82...')
  await page.goto('http://localhost:5240/#/nodes/F47C1B82', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))

  await save('verification_06_nodedetail_no_gpu', await page.screenshot({ fullPage: true }))

  const chartsGridNoGpu = await page.$('.nodetable-grid, div[style*="grid-template-columns: repeat(2, 1fr)"]')
  if (chartsGridNoGpu) {
    await save('verification_nodedetail_4charts_nogpu', await chartsGridNoGpu.screenshot())
  }

  // 4. Hub Cockpit
  console.log('5. Navigating to /#/hub/795F7F9C...')
  await page.goto('http://localhost:5240/#/hub/795F7F9C', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1800))
  await save('verification_07_hub_view', await page.screenshot({ fullPage: true }))

  await browser.close()
  await server.close()
  console.log('All comparison captures completed successfully!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
