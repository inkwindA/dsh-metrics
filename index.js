/**
 * Host half of the Metrics bundle.
 *
 * Owns the local run store, exposes it to the browser page over
 * `/dsh-metrics/api/*`, and gives the agent tools to log points directly or
 * import a CSV/JSONL training log.
 */

import { readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMetricsHandler } from './http.js'
import { parseMetricText } from './import.js'
import { MetricsStore, downsample, toId } from './store.js'

const VERSION = '1.0.0'
const PLUGIN_NAME = 'dsh-metrics'

/** Services required before apply runs. */
export const inject = ['tools']

/** Default store root: `$DSH_METRICS_DIR`, else `<DSH_HOME|~/.dsh>/metrics`. */
function defaultDataDir() {
  const explicit = process.env.DSH_METRICS_DIR
  if (explicit !== undefined && explicit.trim() !== '') return path.resolve(explicit)
  const home = process.env.DSH_HOME
  const base = home !== undefined && home.trim() !== '' ? home : path.join(os.homedir(), '.dsh')
  return path.join(base, 'metrics')
}

function describeRun(run) {
  const latest = run.latest !== null && typeof run.latest === 'object' ? run.latest : {}
  const quality = Object.entries(latest)
    .map(([name, value]) => `${name}=${value}`)
    .slice(0, 8)
    .join(', ')
  return `${run.project}/${run.name} — step ${run.steps}, ${run.pointCount} points${quality === '' ? '' : `, latest ${quality}`}`
}

/** Text block shown in the chat for a tool result. */
function textBlock(text) {
  return [{ type: 'text', text }]
}

/**
 * Register the metrics store, HTTP API, and tools.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ dataDir?: string, maxPoints?: number }} [config]
 */
export function apply(ctx, config = {}) {
  const dataDir = typeof config.dataDir === 'string' && config.dataDir.trim() !== ''
    ? path.resolve(config.dataDir)
    : defaultDataDir()
  const store = new MetricsStore({ dataDir, maxPoints: config.maxPoints })
  const sdkPath = fileURLToPath(new URL('./python/dsh_metrics.py', import.meta.url))
  const dashboard = 'the Metrics panel in the DSH web sidebar'

  const registerLogTool = () => ctx.tools.register({
    name: 'metrics_log',
    description: `Append numeric training metrics to the local Metrics dashboard (${dashboard}, a W&B-like page of loss/accuracy curves). `
      + 'Use it to publish a finished or running training result, or to chart numbers you computed while analysing code or logs. '
      + 'Runs are grouped by project and identified by run name; calling again with the same names appends more points to the same curve. '
      + 'Each point is an object whose numeric fields become series, with an optional "step" field for the x axis. '
      + 'The page refreshes itself, so no browser action is needed after logging.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        project: { type: 'string', description: 'Project group shown in the dashboard, for example "mnist" or "detr-finetune". Created on first use.' },
        run: { type: 'string', description: 'Run name shown in the legend, for example "baseline" or "lr-3e-4".' },
        points: {
          type: 'array',
          description: 'Samples in order. Example: [{"step": 1, "loss": 2.31, "acc": 0.10}, {"step": 2, "loss": 1.02, "acc": 0.55}]. '
            + 'Keys become chart names, so prefer stable names such as "loss", "val_loss", "acc", "val_acc", "lr".',
          items: { type: 'object', additionalProperties: true },
        },
        config: { type: 'object', additionalProperties: true, description: 'Hyperparameters and other metadata, merged into the run config.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for the run.' },
        description: { type: 'string', description: 'Optional free-form note about the run.' },
      },
      required: ['project', 'run', 'points'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          project: { type: 'string' },
          run: { type: 'string' },
          key: { type: 'string' },
          steps: { type: 'number' },
          written: { type: 'number' },
          pointCount: { type: 'number' },
          metrics: { type: 'array', items: { type: 'string' } },
          root: { type: 'string' },
        },
        required: ['project', 'run', 'key', 'written'],
      },
      render(_args, value) {
        return textBlock(`Logged ${value.written} point(s) to ${value.key}; the run now has ${value.pointCount} point(s), last step ${value.steps}.\n`
          + `Metrics: ${value.metrics.join(', ')}\n`
          + `Open ${dashboard} to see the curve. Data dir: ${value.root}`)
      },
    },
    async execute(args) {
      if (args === null || typeof args !== 'object') throw new Error('metrics_log expects an object argument')
      if (typeof args.project !== 'string' || args.project.trim() === '') throw new Error('metrics_log requires a non-empty project')
      if (typeof args.run !== 'string' || args.run.trim() === '') throw new Error('metrics_log requires a non-empty run')
      if (!Array.isArray(args.points) || args.points.length === 0) throw new Error('metrics_log requires a non-empty points array')
      const summary = await store.log({
        project: args.project,
        run: args.run,
        points: args.points,
        config: args.config,
        tags: args.tags,
        description: args.description,
      })
      return {
        project: summary.project,
        run: summary.id,
        key: summary.key,
        steps: summary.steps,
        written: summary.written,
        pointCount: summary.pointCount,
        metrics: Object.keys(summary.metrics),
        root: store.root,
      }
    },
  })

  const registerListTool = () => ctx.tools.register({
    name: 'metrics_list',
    description: `List runs already stored in the local Metrics dashboard (${dashboard}) with their latest values, best values, step counts, and config. `
      + 'Use it to discover what is available before analysing or comparing experiments; pass project to narrow the list.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        project: { type: 'string', description: 'Optional project name filter.' },
        search: { type: 'string', description: 'Optional case-insensitive substring filter over run name, project, tags, and config.' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          root: { type: 'string' },
          count: { type: 'number' },
          runs: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['root', 'count', 'runs'],
      },
      render(_args, value) {
        if (value.count === 0) return textBlock(`No runs stored yet under ${value.root}. Use metrics_log or metrics_import to create one.`)
        return textBlock(value.runs.map((run) => describeRun(run)).join('\n'))
      },
    },
    async execute(args) {
      const projectFilter = typeof args?.project === 'string' && args.project.trim() !== '' ? args.project : undefined
      const search = typeof args?.search === 'string' ? args.search.trim().toLowerCase() : ''
      let runs = await store.listRuns()
      if (projectFilter !== undefined) {
        const projectId = toId(projectFilter)
        runs = runs.filter((run) => run.project === projectFilter || run.project === projectId)
      }
      if (search !== '') {
        runs = runs.filter((run) => {
          const haystack = `${run.project} ${run.name} ${run.tags.join(' ')} ${JSON.stringify(run.config)}`.toLowerCase()
          return haystack.includes(search)
        })
      }
      const compact = runs.slice(0, 100).map((run) => ({
        project: run.project,
        run: run.id,
        name: run.name,
        key: run.key,
        status: run.status,
        steps: run.steps,
        pointCount: run.pointCount,
        updated: new Date(run.updated).toISOString(),
        tags: run.tags,
        config: run.config,
        latest: Object.fromEntries(Object.entries(run.metrics).map(([name, stats]) => [name, stats.last])),
        min: Object.fromEntries(Object.entries(run.metrics).map(([name, stats]) => [name, stats.min])),
        max: Object.fromEntries(Object.entries(run.metrics).map(([name, stats]) => [name, stats.max])),
      }))
      return { root: store.root, count: runs.length, runs: compact }
    },
  })

  const registerGetTool = () => ctx.tools.register({
    name: 'metrics_get',
    description: `Read one run's numeric series from the local Metrics dashboard (${dashboard}) for analysis, comparison, or anomaly inspection. `
      + 'Returns per-metric points downsampled to maxPoints (default 120) plus min/max/last, so a long run fits in context. '
      + 'Use metrics_list first to discover the project and run names.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        project: { type: 'string', description: 'Project name shown in the dashboard.' },
        run: { type: 'string', description: 'Run name or run id.' },
        metrics: { type: 'array', items: { type: 'string' }, description: 'Optional metric names to read; omit for every metric.' },
        maxPoints: { type: 'number', description: 'Points kept per metric (default 120, capped at 500).' },
      },
      required: ['project', 'run'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          key: { type: 'string' },
          steps: { type: 'number' },
          pointCount: { type: 'number' },
          series: { type: 'object', additionalProperties: true },
        },
        required: ['key', 'series'],
      },
      render(_args, value) {
        const lines = [`${value.key} — ${value.pointCount} point(s), last step ${value.steps}`]
        for (const [name, entry] of Object.entries(value.series)) {
          const stats = value.stats[name]
          const points = entry.map(([x, y]) => `${x}=${y}`).join(', ')
          lines.push(`${name} (min ${stats.min}, max ${stats.max}, last ${stats.last}): ${points}`)
        }
        return textBlock(lines.join('\n'))
      },
    },
    async execute(args) {
      if (args === null || typeof args !== 'object') throw new Error('metrics_get expects an object argument')
      if (typeof args.project !== 'string' || args.project.trim() === '') throw new Error('metrics_get requires a project')
      if (typeof args.run !== 'string' || args.run.trim() === '') throw new Error('metrics_get requires a run')
      const requested = Array.isArray(args.metrics) ? args.metrics.filter((name) => typeof name === 'string') : undefined
      const maxPoints = Number.isFinite(args.maxPoints) ? Math.min(500, Math.max(2, Math.floor(args.maxPoints))) : 120
      const summary = await store.summary(toId(args.project), toId(args.run), { withSeries: true })
      const all = summary.series ?? {}
      const series = {}
      const stats = {}
      const names = requested === undefined || requested.length === 0 ? Object.keys(all) : requested.filter((name) => all[name] !== undefined)
      for (const name of names) {
        series[name] = downsample(all[name], maxPoints)
        stats[name] = summary.metrics[name]
      }
      if (names.length === 0) throw new Error(`metrics_get found no matching metrics in ${summary.key}; available: ${Object.keys(all).join(', ') || '(none)'}`)
      return { key: summary.key, steps: summary.steps, pointCount: summary.pointCount, series, stats }
    },
  })

  const followers = new Map()
  const parseCache = new Map()
  const MAX_IMPORT_BYTES = 128 * 1024 * 1024

  function clampNumber(value, min, max, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return Math.min(max, Math.max(min, value))
  }

  /** Parse a log file, reusing the last parse while its size/mtime are unchanged. */
  async function parseLogFile(file, stepColumn) {
    const info = await stat(file).catch(() => undefined)
    if (info === undefined || !info.isFile()) throw new Error(`cannot import ${file}: file not found`)
    if (info.size > MAX_IMPORT_BYTES) throw new Error(`cannot import ${file}: file is larger than 128 MiB`)
    const cached = parseCache.get(file)
    if (cached !== undefined && cached.size === info.size && cached.mtimeMs === info.mtimeMs && cached.stepColumn === stepColumn) {
      return { info, parsed: cached.parsed }
    }
    const text = await readFile(file, 'utf8')
    const parsed = parseMetricText(text, { stepColumn, maxPoints: Number.MAX_SAFE_INTEGER })
    parseCache.set(file, { size: info.size, mtimeMs: info.mtimeMs, stepColumn, parsed })
    if (parseCache.size > 16) parseCache.delete(parseCache.keys().next().value)
    return { info, parsed }
  }

  /**
   * Append only rows the run has not ingested yet. The cursor lives in run.json,
   * so calling this repeatedly (or from a follower) keeps one continuous curve.
   */
  async function importIntoRun(options) {
    const { parsed } = await parseLogFile(options.file, options.stepColumn)
    const projectId = toId(options.project, 'project')
    const runId = toId(options.run, 'run')
    const meta = await store.metaOf(projectId, runId)
    const previous = meta !== null && typeof meta === 'object'
      && meta.ingest !== null && typeof meta.ingest === 'object'
      && meta.ingest.path === options.file
      && Number.isFinite(meta.ingest.ingested)
      ? meta.ingest.ingested
      : 0
    let start = previous
    let reset = false
    if (start > parsed.points.length) {
      start = 0
      reset = true
    }
    const fresh = parsed.points.slice(start)
    const maxPoints = clampNumber(options.maxPoints, 2, 200000, 5000)
    const sampled = downsample(fresh, maxPoints)
    const extraConfig = options.config !== null && typeof options.config === 'object' && !Array.isArray(options.config) ? options.config : {}
    let summary
    let appended = 0
    if (sampled.length > 0) {
      summary = await store.log({
        project: projectId,
        run: runId,
        points: sampled,
        config: { source: path.basename(options.file), ...extraConfig },
        tags: options.tags,
        description: `Imported from ${options.file}`,
        finish: options.finish === true,
        ingest: { path: options.file, ingested: parsed.points.length, at: Date.now() },
      })
      appended = summary.written ?? sampled.length
    } else {
      summary = await store.summary(projectId, runId, { withSeries: false })
    }
    return { summary, parsed, appended, fresh: fresh.length, total: parsed.points.length, reset, projectId, runId }
  }

  /**
   * Tail a growing log file into one run. `importIntoRun` appends only new rows,
   * so the dashboard's existing curve keeps extending instead of restarting.
   * Stops after `idleMs` without growth and then marks the run finished.
   */
  function startFollower(options) {
    const projectId = toId(options.project, 'project')
    const runId = toId(options.run, 'run')
    const key = `${projectId}/${runId}`
    followers.get(key)?.stop()
    const limit = Math.max(2, Math.ceil(options.idleMs / options.intervalMs))
    let idle = 0
    let busy = false
    let stopped = false
    const tick = async () => {
      if (busy || stopped) return
      busy = true
      try {
        const result = await importIntoRun({ ...options, project: projectId, run: runId, finish: false })
        if (result.fresh > 0) idle = 0
        else idle += 1
        if (result.reset) {
          ctx.logger?.warn?.(`dsh-metrics: ${options.file} shrank; re-imported from the start`)
        }
        if (idle >= limit) {
          stop()
          await store.markFinished(projectId, runId).catch(() => {})
        }
      } catch (error) {
        idle += 1
        ctx.logger?.warn?.(`dsh-metrics: follow failed for ${options.file}`, error)
        if (idle >= limit) stop()
      } finally {
        busy = false
      }
    }
    const timer = setInterval(tick, options.intervalMs)
    if (typeof timer.unref === 'function') timer.unref()
    const stop = () => {
      if (stopped) return
      stopped = true
      clearInterval(timer)
      if (followers.get(key)?.stop === stop) followers.delete(key)
    }
    followers.set(key, { stop, file: options.file, started: Date.now() })
    return { stop }
  }

  ctx.effect(() => () => {
    for (const entry of followers.values()) entry.stop()
    followers.clear()
  }, `${PLUGIN_NAME}: followed imports`)

  const registerImportTool = () => ctx.tools.register({
    name: 'metrics_import',
    description: `Import an existing training log (CSV, TSV, JSONL, or a JSON array of objects) into the local Metrics dashboard (${dashboard}) as one run. `
      + 'Numeric columns become curves; the step axis is taken from a step-like column (step, global_step, iteration, epoch) or the row index. '
      + 'Re-importing the same run is incremental: only rows appended since the previous import are added, so the run always shows the whole training curve. '
      + 'Set follow=true to tail a log that is still being written: the run then keeps extending as new epochs/steps appear, and is marked finished after idleSeconds without growth. '
      + 'This is the way to show one complete training task, W&B style, without rerunning training. Relative paths resolve against the session working directory.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Path to the CSV/TSV/JSONL/JSON log file.' },
        project: { type: 'string', description: 'Project name; defaults to the file\'s parent directory name.' },
        run: { type: 'string', description: 'Run name; defaults to the file name without extension.' },
        stepColumn: { type: 'string', description: 'Explicit column to use as the x axis.' },
        maxPoints: { type: 'number', description: 'Points kept per import call (default 5000; already-imported rows are never repeated).' },
        config: { type: 'object', additionalProperties: true, description: 'Optional config merged into the run.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
        follow: { type: 'boolean', description: 'Keep tailing the file and appending new rows every intervalSeconds.' },
        intervalSeconds: { type: 'number', description: 'Follow poll interval in seconds (default 5, max 60).' },
        idleSeconds: { type: 'number', description: 'Stop following (and mark finished) after this long without new rows (default 900).' },
        finished: { type: 'boolean', description: 'Mark the run finished after a one-shot import (default true; ignored while following).' },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          project: { type: 'string' },
          run: { type: 'string' },
          key: { type: 'string' },
          points: { type: 'number' },
          totalPoints: { type: 'number' },
          rows: { type: 'number' },
          stepColumn: { type: 'string' },
          sampled: { type: 'boolean' },
          metrics: { type: 'array', items: { type: 'string' } },
          follow: { type: 'boolean' },
          intervalSeconds: { type: 'number' },
          root: { type: 'string' },
        },
        required: ['project', 'run', 'key', 'points'],
      },
      render(_args, value) {
        const lines = [
          `Imported ${value.points} new point(s) into ${value.key} (now ${value.totalPoints} point(s) in the run, x axis: ${value.stepColumn}).`,
          `Metrics: ${value.metrics.join(', ')}`,
        ]
        if (value.follow === true) {
          lines.push(`Following the log every ${value.intervalSeconds}s; new epochs will extend the same curve, and the run finishes after a long quiet period.`)
        }
        lines.push(`Open ${dashboard} to see the whole training curve. Data dir: ${value.root}`)
        return textBlock(lines.join('\n'))
      },
    },
    async execute(args, exec) {
      if (args === null || typeof args !== 'object') throw new Error('metrics_import expects an object argument')
      if (typeof args.path !== 'string' || args.path.trim() === '') throw new Error('metrics_import requires a file path')
      const workingDirectory = ctx.get('workingDirectory')
      let base = process.cwd()
      try {
        if (workingDirectory !== undefined && exec !== undefined && exec.agent !== undefined) {
          const current = workingDirectory.get(exec.agent.session)
          if (typeof current === 'string' && current !== '') base = current
        }
      } catch {
        base = process.cwd()
      }
      const file = path.resolve(base, args.path)
      const project = typeof args.project === 'string' && args.project.trim() !== '' ? args.project : path.basename(path.dirname(file))
      const run = typeof args.run === 'string' && args.run.trim() !== '' ? args.run : path.basename(file, path.extname(file))
      const follow = args.follow === true
      const intervalSeconds = clampNumber(args.intervalSeconds, 1, 60, 5)
      const idleSeconds = clampNumber(args.idleSeconds, intervalSeconds * 2, 86400, 900)
      const result = await importIntoRun({
        file,
        project,
        run,
        stepColumn: args.stepColumn,
        maxPoints: args.maxPoints,
        config: args.config,
        tags: args.tags,
        finish: follow ? false : args.finished !== false,
      })
      if (follow) {
        startFollower({
          file,
          project: result.projectId,
          run: result.runId,
          stepColumn: args.stepColumn,
          maxPoints: args.maxPoints,
          config: args.config,
          tags: args.tags,
          intervalMs: intervalSeconds * 1000,
          idleMs: idleSeconds * 1000,
        })
      }
      return {
        project: result.summary.project,
        run: result.summary.id,
        key: result.summary.key,
        points: result.appended,
        totalPoints: result.total,
        rows: result.parsed.rowCount,
        stepColumn: result.parsed.stepColumn,
        sampled: result.fresh > result.appended,
        metrics: result.parsed.metrics,
        follow,
        intervalSeconds,
        root: store.root,
      }
    },
  })

  registerLogTool()
  registerListTool()
  registerGetTool()
  registerImportTool()

  ctx.inject(['webServer'], (sub) => {
    const handler = createMetricsHandler({ store, sdkPath, version: VERSION })
    sub.effect(
      () => sub.webServer.register({ kind: 'prefix', path: '/dsh-metrics', handler }),
      `${PLUGIN_NAME}: http api`,
    )
    sub.effect(() => {
      store.ensureRoot().catch(() => {})
      return () => {}
    }, `${PLUGIN_NAME}: data dir`)
  })
}
