import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

console.log('[build] Running tsc -b...')
execSync('npx tsc -b', { stdio: 'inherit' })

console.log('[build] Building main (dist/index.html)...')
execSync('npx vite build', {
  stdio: 'inherit',
  env: { ...process.env, BUILD_TARGET: 'main' },
})

console.log('[build] Building map (dist/map.html)...')
execSync('npx vite build', {
  stdio: 'inherit',
  env: { ...process.env, BUILD_TARGET: 'map' },
})

// Copy og.png
const ogSrc = path.resolve('og.png')
const ogDest = path.resolve('dist/og.png')
if (fs.existsSync(ogSrc)) {
  fs.copyFileSync(ogSrc, ogDest)
  console.log('[build] Copied og.png -> dist/og.png')
}

// Replace OG tags in dist/index.html
const indexHtml = path.resolve('dist/index.html')
if (fs.existsSync(indexHtml)) {
  let content = fs.readFileSync(indexHtml, 'utf-8')
  content = content.replace(/__OG_IMAGE__/g, 'https://obsr.net/og.png')
  content = content.replace(/__OG_URL__/g, 'https://obsr.net')
  fs.writeFileSync(indexHtml, content, 'utf-8')
  console.log('[build] Injected OG metadata into dist/index.html')
}

console.log('[build] All builds completed successfully!')
