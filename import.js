/**
 * Import helpers: turn a training log (CSV, TSV, JSONL, or a JSON array) into
 * metric points the store can append. Used by the `metrics_import` tool.
 */

const STEP_KEYS = ['step', '_step', 'global_step', 'iteration', 'iter', 'train_step', 'epoch']
const SKIP_KEYS = new Set(['t', 'timestamp', 'wall_time', 'walltime', 'metrics'])

function splitDelimited(line, delimiter) {
  const out = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        value += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        value += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      out.push(value)
      value = ''
    } else {
      value += ch
    }
  }
  out.push(value)
  return out
}

function parseDelimited(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) throw new Error('delimited log needs a header row and at least one data row')
  const delimiter = lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ','
  const header = splitDelimited(lines[0], delimiter).map((name) => name.trim())
  const rows = []
  for (const line of lines.slice(1)) {
    const cells = splitDelimited(line, delimiter)
    const row = {}
    for (let i = 0; i < header.length; i += 1) {
      if (header[i] === '') continue
      row[header[i]] = cells[i]
    }
    rows.push(row)
  }
  return rows
}

function parseJsonRows(text) {
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('JSON log must be an array of objects')
    return parsed
  }
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed === '[' || trimmed === ']') continue
    const value = JSON.parse(trimmed.replace(/,\s*$/, ''))
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) rows.push(value)
  }
  return rows
}

function numberOrUndefined(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Parse one log file's text into flat points shaped `{ step, <metric>: number }`.
 * @param {string} text file contents.
 * @param {{ stepColumn?: string, maxPoints?: number }} options
 */
export function parseMetricText(text, { stepColumn, maxPoints = 5000 } = {}) {
  const trimmed = text.trim()
  if (trimmed === '') throw new Error('log file is empty')
  const rows = trimmed.startsWith('[') || trimmed.startsWith('{') ? parseJsonRows(trimmed) : parseDelimited(trimmed)
  if (rows.length === 0) throw new Error('log file contains no rows')

  const metricKeys = new Set()
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    for (const key of Object.keys(row)) {
      if (SKIP_KEYS.has(key)) continue
      if (numberOrUndefined(row[key]) !== undefined) metricKeys.add(key)
    }
  }
  if (metricKeys.size === 0) throw new Error('log file contains no numeric columns')

  const explicitStep = typeof stepColumn === 'string' && stepColumn.length > 0 ? stepColumn : undefined
  const detectedStep = explicitStep !== undefined
    ? explicitStep
    : STEP_KEYS.find((key) => metricKeys.has(key) && rows.some((row) => numberOrUndefined(row[key]) !== undefined))
  const xKey = detectedStep
  // A detected `epoch` stays a metric as well; every other x column is only the axis.
  const keepX = xKey === 'epoch'

  const points = []
  rows.forEach((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return
    let step = xKey === undefined ? undefined : numberOrUndefined(row[xKey])
    if (step === undefined && explicitStep !== undefined) return
    const point = {}
    for (const [key, value] of Object.entries(row)) {
      if (SKIP_KEYS.has(key)) continue
      if (xKey !== undefined && key === xKey && !keepX) continue
      const parsed = numberOrUndefined(value)
      if (parsed !== undefined) point[key] = parsed
    }
    if (Object.keys(point).length === 0) return
    point.step = step === undefined ? (points.length === 0 ? 0 : index) : step
    points.push(point)
  })
  if (points.length === 0) throw new Error(`no numeric rows found${explicitStep === undefined ? '' : ` using step column "${explicitStep}"`}`)

  const sampled = samplePoints(points, maxPoints)
  return {
    points: sampled,
    rowCount: rows.length,
    pointCount: points.length,
    stepColumn: xKey ?? '(row index)',
    metrics: [...metricKeys].filter((key) => key !== xKey || keepX).sort(),
    sampled: sampled.length < points.length,
  }
}

function samplePoints(points, maxPoints) {
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 2 || points.length <= maxPoints) return points
  const out = []
  const stride = (points.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints - 1; i += 1) out.push(points[Math.round(i * stride)])
  out.push(points[points.length - 1])
  return out
}
