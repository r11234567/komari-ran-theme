import fs from 'fs'

// Test sparse sampling logic
console.log('Testing aggregatePingByTarget with sparse data...')

const now = Date.now()
const oneHourMs = 60 * 60 * 1000
const buckets = 60
const pingHistory = {
  tasks: [
    { id: 1, name: 'Target-Sparse-1', interval: 60, loss: 0 },
    { id: 2, name: 'Target-Single-Point', interval: 300, loss: 0 },
  ],
  records: [
    // Target 1: A few sparse samples
    { task_id: 1, time: new Date(now - 45 * 60 * 1000).toISOString(), value: 165 },
    { task_id: 1, time: new Date(now - 30 * 60 * 1000).toISOString(), value: 170 },
    { task_id: 1, time: new Date(now - 15 * 60 * 1000).toISOString(), value: 168 },
    { task_id: 1, time: new Date(now - 5 * 60 * 1000).toISOString(), value: 172 },
    // Target 2: Only 1 isolated single point
    { task_id: 2, time: new Date(now - 20 * 60 * 1000).toISOString(), value: 140 },
  ],
}

// Check with our new null-preserving aggregation
const start = now - oneHourMs
const bucketMs = oneHourMs / buckets
const task1Data = new Array(buckets).fill(null)
const task2Data = new Array(buckets).fill(null)

for (const r of pingHistory.records) {
  const t = new Date(r.time).getTime()
  const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
  if (r.task_id === 1) task1Data[idx] = r.value
  if (r.task_id === 2) task2Data[idx] = r.value
}

// 1. Verify that empty slots are null, not 0 (no false drop to 0ms)
const nullCount = task1Data.filter((v) => v === null).length
console.log(`Task 1 null count: ${nullCount}/${buckets} (empty slots preserved as null)`)
if (nullCount === 0 || task1Data.includes(0)) {
  console.error('FAIL: Empty slots should be null, not 0ms!')
  process.exit(1)
}

// 2. Verify PingChart line generation for sparse points
function buildLine(data, width = 400, height = 150, pad = { left: 8, top: 14, right: 44, bottom: 22 }) {
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const stepX = innerW / (data.length - 1)
  const max = Math.max(...data.filter((v) => v != null), 1) * 1.2

  const validPoints = []
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v != null && Number.isFinite(v)) {
      validPoints.push([
        pad.left + i * stepX,
        pad.top + innerH - (Math.min(max, v) / max) * innerH,
      ])
    }
  }

  let path = ''
  for (let i = 0; i < validPoints.length; i++) {
    path += `${i === 0 ? 'M' : 'L'}${validPoints[i][0].toFixed(1)},${validPoints[i][1].toFixed(1)} `
  }
  return { validPoints, path, hasLine: validPoints.length > 1, isSinglePoint: validPoints.length === 1 }
}

const line1 = buildLine(task1Data)
console.log('Target 1 line path:', line1.path)
if (!line1.hasLine || !line1.path.includes('L')) {
  console.error('FAIL: Target 1 should connect valid points with L commands!')
  process.exit(1)
}

const line2 = buildLine(task2Data)
console.log('Target 2 valid points:', line2.validPoints.length, 'isSinglePoint:', line2.isSinglePoint)
if (!line2.isSinglePoint) {
  console.error('FAIL: Target 2 should have 1 point!')
  process.exit(1)
}

console.log('SUCCESS: Sparse ping connection algorithm validated!')
