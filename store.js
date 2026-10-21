/**
 * Local run store for the Metrics dashboard.
 *
 * Layout (one directory per run, append-only history):
 *
 *   <root>/<project>/<run>/run.json       run metadata (name, config, tags, status)
 *   <root>/<project>/<run>/history.jsonl  one JSON record per logged point
 *
 * A history record is `{"t": <ms>, "step": <number>, "metrics": {...}}`.
 * Flat records such as `{"step": 3, "loss": 0.4}` are accepted too, which keeps
 * hand-written or ad-hoc imported files readable by the same reader.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const META_FILE = 'run.json'
const HISTORY_FILE = 'history.jsonl'
const ID_LIMIT = 80
const SKIP_KEYS = new Set(['step', '_step', 'global_step', 't', 'metrics', 'event', 'timestamp', 'wall_time', 'walltime'])

/** Turn a display name into a safe single path segment. */
export function toId(value, fallback = 'run') {
  const raw = String(value ?? '').normalize('NFKC').trim()
  let text = ''
  for (const ch of raw) {
    if (ch === '/' || ch === '\\' || ch.charCodeAt(0) < 0x20) text += '-'
    else text += ch
  }
  text = text.replace(/\s+/g, '-').replace(/^[.\-]+/, '').replace(/[.\-]+$/, '').slice(0, ID_LIMIT)
  return text.length > 0 ? text : fallback
}

/** True when `value` is one valid already-stored id segment. */
export function isId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= ID_LIMIT
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0')
}

/** Numeric metric value or undefined. */
function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Extract the metric map of one history record. */
function metricsOf(record) {
  const source = record.metrics !== null && typeof record.metrics === 'object' && !Array.isArray(record.metrics)
    ? record.metrics
    : record
  const out = {}
  for (const [key, value] of Object.entries(source)) {
    if (SKIP_KEYS.has(key)) continue
    const parsed = numeric(value)
    if (parsed !== undefined) out[key] = parsed
  }
  return out
}

/** Smallest/largest/last summary for one metric series. */
function statsOf(points) {
  let min = Infinity
  let max = -Infinity
  for (const [, value] of points) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return { last: points.length > 0 ? points[points.length - 1][1] : null, min, max, count: points.length }
}

/** Uniformly thin a series while always keeping the final point. */
export function downsample(points, maxPoints) {
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 2 || points.length <= maxPoints) return points
  const out = []
  const last = points.length - 1
  for (let i = 0; i < maxPoints - 1; i += 1) out.push(points[Math.round((i * last) / (maxPoints - 1))])
  out.push(points[last])
  return out
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

let tempCounter = 0

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${(tempCounter += 1)}.${Math.random().toString(36).slice(2, 8)}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try {
    await fs.rename(temp, file)
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

/** Writable run store shared by the agent tools, the HTTP API, and the page. */
export class MetricsStore {
  /**
   * @param {object} options
   * @param {string} options.dataDir absolute directory holding every project.
   * @param {number} [options.maxPoints] page-series cap after downsampling.
   */
  constructor({ dataDir, maxPoints = 1500 }) {
    this.root = path.resolve(dataDir)
    this.maxPoints = Number.isSafeInteger(maxPoints) && maxPoints >= 2 ? maxPoints : 1500
    /** @type {Map<string, object>} parsed history cache, keyed by run directory. */
    this.cache = new Map()
    /** @type {Map<string, Promise<unknown>>} per-file write serialization. */
    this.locks = new Map()
  }

  /** Run directory for a pair of already-sanitized ids. */
  dirOf(project, run) {
    if (!isId(project) || !isId(run)) throw new Error(`invalid metric path: ${String(project)}/${String(run)}`)
    return path.join(this.root, project, run)
  }

  /** Serialize writers per history file inside this process. */
  withLock(key, operation) {
    const previous = this.locks.get(key) ?? Promise.resolve()
    const next = previous.then(operation, operation)
    const guarded = next.catch(() => {})
    this.locks.set(key, guarded)
    return next.finally(() => {
      if (this.locks.get(key) === guarded) this.locks.delete(key)
    })
  }

  /** Create the root directory (idempotent). */
  async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true })
  }

  /** Every run, newest activity first, without series payloads. */
  async listRuns() {
    const projects = await fs.readdir(this.root, { withFileTypes: true }).catch(() => [])
    const runs = []
    for (const entry of projects) {
      if (!entry.isDirectory() || !isId(entry.name)) continue
      const dirs = await fs.readdir(path.join(this.root, entry.name), { withFileTypes: true }).catch(() => [])
      const present = dirs.filter((item) => item.isDirectory() && isId(item.name))
      const summaries = await Promise.all(present.map((item) => this.summary(entry.name, item.name, { withSeries: false }).catch(() => undefined)))
      for (const summary of summaries) if (summary !== undefined) runs.push(summary)
    }
    runs.sort((left, right) => right.updated - left.updated)
    return runs
  }

  /** Current run metadata, or undefined when the run does not exist yet. */
  async metaOf(project, run) {
    return readJson(path.join(this.dirOf(project, run), META_FILE))
  }

  /** One run with summary stats, optionally including downsampled series. */
  async summary(project, run, { withSeries = false } = {}) {
    const dir = this.dirOf(project, run)
    const meta = (await readJson(path.join(dir, META_FILE))) ?? {}
    const history = await this.loadHistory(dir)
    const metrics = {}
    const series = {}
    for (const [name, points] of Object.entries(history.series)) {
      metrics[name] = statsOf(points)
      if (withSeries) series[name] = downsample(points, this.maxPoints)
    }
    const updated = history.mtimeMs > 0 ? history.mtimeMs : (meta.created ?? Date.now())
    return {
      key: `${project}/${run}`,
      project,
      id: run,
      name: typeof meta.name === 'string' && meta.name.length > 0 ? meta.name : run,
      description: typeof meta.description === 'string' ? meta.description : '',
      config: meta.config !== null && typeof meta.config === 'object' && !Array.isArray(meta.config) ? meta.config : {},
      tags: Array.isArray(meta.tags) ? meta.tags.filter((tag) => typeof tag === 'string') : [],
      status: meta.status === 'finished' ? 'finished' : 'running',
      created: Number.isFinite(meta.created) ? meta.created : updated,
      finished: Number.isFinite(meta.finished) ? meta.finished : null,
      updated,
      steps: history.lastStep,
      pointCount: history.pointCount,
      metrics,
      ...(withSeries ? { series } : {}),
      dir,
    }
  }

  /** Parse and cache one history file; `mtimeMs + size` is the invalidation key. */
  async loadHistory(dir) {
    const file = path.join(dir, HISTORY_FILE)
    const info = await fs.stat(file).catch(() => undefined)
    if (info === undefined) return { series: {}, lastStep: -1, pointCount: 0, mtimeMs: 0 }
    const cached = this.cache.get(dir)
    if (cached !== undefined && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached
    let text = ''
    try {
      text = await fs.readFile(file, 'utf8')
    } catch {
      return { series: {}, lastStep: -1, pointCount: 0, mtimeMs: info.mtimeMs }
    }
    const collected = new Map()
    let lastStep = -1
    let pointCount = 0
    let index = 0
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      let record
      try {
        record = JSON.parse(trimmed)
      } catch {
        continue
      }
      if (record === null || typeof record !== 'object' || Array.isArray(record)) continue
      const metrics = metricsOf(record)
      const names = Object.keys(metrics)
      if (names.length === 0) continue
      const rawStep = numeric(record.step ?? record._step ?? record.global_step)
      const step = rawStep === undefined ? index : rawStep
      for (const name of names) {
        let points = collected.get(name)
        if (points === undefined) {
          points = []
          collected.set(name, points)
        }
        points.push([step, metrics[name]])
      }
      index += 1
      pointCount += 1
      if (step > lastStep) lastStep = step
    }
    const series = {}
    for (const [name, points] of collected) {
      points.sort((left, right) => left[0] - right[0])
      series[name] = points.map(([x, y]) => [x, y])
    }
    const history = { series, lastStep, pointCount, mtimeMs: info.mtimeMs, size: info.size }
    this.cache.set(dir, history)
    return history
  }

  /**
   * Create or extend a run.
   * @returns the run summary plus how many points were written.
   */
  async log({ project, run, points, config, tags, description, finish = false, ingest }) {
    const projectId = toId(project, 'project')
    const runId = toId(run, 'run')
    if (!Array.isArray(points) || points.length === 0) throw new Error('metrics_log needs at least one point')
    const dir = this.dirOf(projectId, runId)
    await fs.mkdir(dir, { recursive: true })
    const metaPath = path.join(dir, META_FILE)
    let meta = await readJson(metaPath)
    if (meta === undefined || meta === null || typeof meta !== 'object') {
      meta = {
        version: 1,
        project: projectId,
        id: runId,
        name: String(run ?? runId),
        created: Date.now(),
        config: {},
        tags: [],
        description: '',
      }
    }
    if (config !== undefined && config !== null && typeof config === 'object' && !Array.isArray(config)) {
      meta.config = { ...(meta.config ?? {}), ...config }
    }
    if (Array.isArray(tags) && tags.length > 0) {
      const merged = new Set([...(Array.isArray(meta.tags) ? meta.tags : []), ...tags.filter((tag) => typeof tag === 'string')])
      meta.tags = [...merged]
    }
    if (typeof description === 'string' && description.length > 0) meta.description = description
    if (typeof meta.name !== 'string' || meta.name.length === 0) meta.name = String(run ?? runId)
    if (finish) {
      meta.status = 'finished'
      meta.finished = Date.now()
    } else {
      meta.status = 'running'
      delete meta.finished
    }
    await writeJsonAtomic(metaPath, meta)

    return this.withLock(dir, async () => {
      const history = await this.loadHistory(dir)
      let step = history.lastStep
      const lines = []
      let written = 0
      for (const point of points) {
        if (point === null || typeof point !== 'object' || Array.isArray(point)) continue
        const values = metricsOf(point)
        const names = Object.keys(values)
        if (names.length === 0) continue
        const explicit = numeric(point.step ?? point._step ?? point.global_step)
        step = explicit === undefined ? step + 1 : explicit
        lines.push(`${JSON.stringify({ t: Date.now(), step, metrics: values })}\n`)
        written += 1
      }
      if (written === 0) throw new Error('metrics_log found no numeric metric values in points')
      const historyPath = path.join(dir, HISTORY_FILE)
      await fs.appendFile(historyPath, lines.join(''), 'utf8')
      this.cache.delete(dir)
      if (ingest !== undefined && ingest !== null) {
        const fresh = (await readJson(metaPath)) ?? meta
        fresh.ingest = ingest
        if (finish) {
          fresh.status = 'finished'
          if (!Number.isFinite(fresh.finished)) fresh.finished = Date.now()
        }
        await writeJsonAtomic(metaPath, fresh)
      }
      const summary = await this.summary(projectId, runId, { withSeries: false })
      return { ...summary, written }
    })
  }

  /** Mark a run finished without touching its history. */
  async markFinished(project, run, summary) {
    const dir = this.dirOf(project, run)
    const metaPath = path.join(dir, META_FILE)
    const meta = (await readJson(metaPath)) ?? { version: 1, project, id: run, name: run, created: Date.now() }
    meta.status = 'finished'
    meta.finished = Date.now()
    if (summary !== undefined) meta.summary = summary
    await fs.mkdir(dir, { recursive: true })
    await writeJsonAtomic(metaPath, meta)
    return this.summary(project, run, { withSeries: false })
  }

  /** Remove a run directory and prune the project directory when it empties. */
  async deleteRun(project, run) {
    const dir = this.dirOf(project, run)
    await fs.rm(dir, { recursive: true, force: true })
    this.cache.delete(dir)
    const projectDir = path.join(this.root, project)
    const remaining = await fs.readdir(projectDir).catch(() => [])
    if (remaining.length === 0) await fs.rmdir(projectDir).catch(() => {})
    return { project, run, deleted: true }
  }
}

/** Read a small JSON body from a Node request with a hard size limit. */
export async function readJsonBody(request, limitBytes = 4 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limitBytes) throw Object.assign(new Error('request body too large'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return undefined
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw Object.assign(new Error('request body is not valid JSON'), { statusCode: 400 })
  }
}

