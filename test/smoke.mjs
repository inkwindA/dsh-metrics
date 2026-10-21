/**
 * Dependency-free smoke test for the store and import parser.
 * Run with: node test/smoke.mjs
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseMetricText } from '../import.js'
import { MetricsStore, downsample, toId } from '../store.js'

const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-metrics-smoke-'))
try {
  const store = new MetricsStore({ dataDir: root, maxPoints: 50 })

  await store.log({
    project: 'smoke',
    run: 'baseline',
    points: [
      { step: 1, loss: 2.0, acc: 0.1 },
      { step: 2, loss: 1.0, acc: 0.5 },
    ],
    config: { lr: 1e-3 },
    tags: ['test'],
  })
  await store.log({ project: 'smoke', run: 'baseline', points: [{ loss: 0.5, acc: 0.8 }] })

  const runs = await store.listRuns()
  assert.equal(runs.length, 1)
  assert.equal(runs[0].key, 'smoke/baseline')
  assert.equal(runs[0].pointCount, 3)
  assert.equal(runs[0].steps, 3, 'auto steps continue from the last step')
  assert.equal(runs[0].metrics.loss.last, 0.5)
  assert.deepEqual(runs[0].tags, ['test'])

  const detail = await store.summary('smoke', 'baseline', { withSeries: true })
  assert.deepEqual(detail.series.loss.map(([step]) => step), [1, 2, 3])
  assert.equal(detail.config.lr, 1e-3)

  const csv = 'step,epoch,loss,val_acc\n1,1,2.2,0.11\n2,1,1.1,0.62\n3,2,0.7,nan\n4,2,0.6,0.9\n'
  const parsed = parseMetricText(csv)
  assert.equal(parsed.stepColumn, 'step')
  assert.equal(parsed.points.length, 4)
  assert.equal(parsed.points[2].val_acc, undefined, 'NaN cells are skipped')
  assert.equal(parsed.points[2].epoch, 2, 'epoch stays a metric when step is the axis')

  const jsonl = '{"step":1,"loss":3.0}\n{"step":2,"loss":2.0}\n'
  assert.equal(parseMetricText(jsonl).points.length, 2)

  assert.equal(toId('my run/1'), 'my-run-1')
  assert.equal(downsample([1, 2, 3, 4, 5, 6], 3).length, 3)
  assert.equal(await store.markFinished('smoke', 'baseline').then((run) => run.status), 'finished')

  await store.deleteRun('smoke', 'baseline')
  assert.equal((await store.listRuns()).length, 0)
  console.log('smoke test passed')
} finally {
  await rm(root, { recursive: true, force: true })
}
