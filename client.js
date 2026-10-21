window.__ModuleLoader__.load({
  id: '@inkwinda/dsh-metrics',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-metrics'
    const API = '/dsh-metrics/api'
    const COLORS = ['#4c8dff', '#f2a03d', '#4cc38a', '#e5646e', '#a78bfa', '#22b8cf', '#f472b6', '#eab308', '#94a3b8', '#0ea5e9']
    const PREF_PROJECT = 'dsh-metrics:project'
    const PREF_COLLAPSED = 'dsh-metrics:collapsed'

    function readPref(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw === null ? fallback : JSON.parse(raw)
      } catch {
        return fallback
      }
    }

    function writePref(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Preferences are optional; private modes may refuse storage.
      }
    }

    const zh = {
      'panel.title': '指标',
      'page.title': '指标看板',
      'page.runs': '{count} 个运行',
      'page.loading': '正在读取运行…',
      'page.error': '无法连接指标服务：{message}',
      'page.retry': '重试',
      'page.selectHint': '在左侧选择一个或多个运行，即可绘制曲线。',
      'page.metricsHidden': '另有 {count} 个指标未显示',
      'search.placeholder': '搜索运行、标签或配置',
      'runs.all': '全选',
      'runs.none': '清空',
      'runs.empty': '没有匹配的运行',
      'runs.selected': '已选 {count}',
      'project.filter': '按项目筛选',
      'project.all': '全部项目（{count}）',
      'group.expand': '展开 {name}',
      'group.collapse': '折叠 {name}',
      'page.selectTitle': '未选择运行',
      'page.selectVisible': '选择当前运行',
      'run.delete': '删除运行 {name}',
      'run.confirm': '确认删除',
      'run.noData': '暂无数据',
      'run.step': '第 {step} 步',
      'run.finished': '已完成',
      'run.running': '进行中',
      'controls.live': '实时刷新',
      'controls.smoothing': '平滑',
      'controls.logy': '对数纵轴',
      'controls.refresh': '刷新',
      'metrics.filter': '筛选指标',
      'chart.empty': '该指标暂无数据',
      'chart.runs': '{count} 个运行',
      'chart.axisX': '步数',
      'overview.title': '最新数值',
      'overview.run': '运行',
      'overview.project': '项目',
      'overview.steps': '步数',
      'overview.status': '状态',
      'empty.title': '还没有运行记录',
      'empty.body': '训练脚本调用下面的 Python 接口后，曲线会实时出现在这里；也可以让 agent 用 metrics_log 或 metrics_import 写入。',
      'empty.copy': '复制代码',
      'empty.copied': '已复制',
      'empty.download': '下载 Python SDK',
      'empty.dir': '数据目录',
      'empty.hint': 'Agent 工具：metrics_log · metrics_import · metrics_list · metrics_get',
      'sdk.title': '从 Python 上报',
      'crash.title': '页面渲染出错',
      'crash.hint': '请刷新页面重试；如果仍然失败，把下面的错误信息发给 agent。',
      'time.now': '刚刚',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.days': '{n} 天前',
    }

    const en = {
      'panel.title': 'Metrics',
      'page.title': 'Metrics',
      'page.runs': '{count} runs',
      'page.loading': 'Loading runs…',
      'page.error': 'Cannot reach the metrics service: {message}',
      'page.retry': 'Retry',
      'page.selectHint': 'Select one or more runs on the left to plot their curves.',
      'page.metricsHidden': '{count} more metrics hidden',
      'search.placeholder': 'Search runs, tags, or config',
      'runs.all': 'All',
      'runs.none': 'None',
      'runs.empty': 'No matching runs',
      'runs.selected': '{count} selected',
      'project.filter': 'Filter by project',
      'project.all': 'All projects ({count})',
      'group.expand': 'Expand {name}',
      'group.collapse': 'Collapse {name}',
      'page.selectTitle': 'No runs selected',
      'page.selectVisible': 'Select visible runs',
      'run.delete': 'Delete run {name}',
      'run.confirm': 'Confirm delete',
      'run.noData': 'no points',
      'run.step': 'step {step}',
      'run.finished': 'finished',
      'run.running': 'running',
      'controls.live': 'Live',
      'controls.smoothing': 'Smoothing',
      'controls.logy': 'Log Y',
      'controls.refresh': 'Refresh',
      'metrics.filter': 'Filter metrics',
      'chart.empty': 'No data for this metric',
      'chart.runs': '{count} runs',
      'chart.axisX': 'step',
      'overview.title': 'Latest values',
      'overview.run': 'Run',
      'overview.project': 'Project',
      'overview.steps': 'Steps',
      'overview.status': 'Status',
      'empty.title': 'No runs yet',
      'empty.body': 'Once a training script calls the Python logger below, curves show up here live. You can also ask the agent to write runs with metrics_log or metrics_import.',
      'empty.copy': 'Copy snippet',
      'empty.copied': 'Copied',
      'empty.download': 'Download Python SDK',
      'empty.dir': 'Data directory',
      'empty.hint': 'Agent tools: metrics_log · metrics_import · metrics_list · metrics_get',
      'sdk.title': 'Log from Python',
      'crash.title': 'The metrics page failed to render',
      'crash.hint': 'Refresh the page and try again; if it keeps failing, send the message below to the agent.',
      'time.now': 'just now',
      'time.minutes': '{n}m ago',
      'time.hours': '{n}h ago',
      'time.days': '{n}d ago',
    }

    const SNIPPET = [
      'import dsh_metrics',
      '',
      'run = dsh_metrics.init(',
      '    project="mnist",',
      '    name="baseline",',
      '    config={"lr": 1e-3, "batch_size": 64},',
      ')',
      'for step in range(steps):',
      '    run.log({"loss": loss, "acc": acc}, step=step)',
      'run.finish()',
    ].join('\n')

    const CSS = `
.dmx-root{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
.dmx-header{display:flex;flex:none;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px clamp(20px,3vw,32px) 14px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
[data-platform=darwin] .dmx-header{padding-top:calc(16px + var(--dsh-frame-top-clearance,0px))}
.dmx-heading{display:flex;align-items:baseline;gap:10px;min-width:0}
.dmx-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dmx-sub{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.dmx-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dmx-btn{height:30px;padding:0 10px;border:0;border-radius:15px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dmx-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmx-btn[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dmx-btn:focus-visible,.dmx-run-main:focus-visible,.dmx-icon-btn:focus-visible,.dmx-input:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dmx-live-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.dmx-btn[aria-pressed=true] .dmx-live-dot{background:var(--dsw-alias-state-success-primary)}
.dmx-fader{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px}
.dmx-fader input{width:86px;accent-color:var(--dsw-alias-brand-primary)}
.dmx-body{display:flex;flex:1;min-height:0}
.dmx-side{width:280px;flex:none;min-height:0;display:flex;flex-direction:column;border-right:.5px solid var(--dsw-alias-border-l1)}
.dmx-side-scroll{flex:1;min-height:0;overflow:auto;padding:12px 10px 18px;scrollbar-gutter:stable}
.dmx-select{box-sizing:border-box;width:100%;height:32px;margin-bottom:8px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px;outline:none;cursor:pointer}
.dmx-select:hover{border-color:var(--dsw-alias-border-l2)}
.dmx-select:focus-visible{border-color:var(--dsw-alias-state-business-primary);outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dmx-main{flex:1;min-width:0;min-height:0;overflow:auto;padding:16px clamp(16px,2.4vw,28px) 56px;scrollbar-gutter:stable}
.dmx-input{box-sizing:border-box;width:100%;height:32px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px;outline:none}
.dmx-input::placeholder{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.dmx-input:focus{border-color:var(--dsw-alias-state-business-primary)}
.dmx-side-actions{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:8px 2px 2px}
.dmx-group{padding-top:8px}
.dmx-group-head{display:flex;align-items:center;gap:4px;padding:0 2px}
.dmx-group-toggle{flex:1;min-width:0;display:flex;align-items:center;gap:6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font:inherit;font-size:11px;font-weight:500;letter-spacing:.03em;text-transform:uppercase;padding:4px 6px;cursor:pointer;text-align:left}
.dmx-group-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmx-group-toggle:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dmx-chevron{flex:none;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));transition:transform .12s ease}
.dmx-chevron[data-open=true]{transform:rotate(90deg)}
.dmx-group-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dmx-group-count{margin-left:auto;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:11px;font-weight:400;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums}
.dmx-run{display:flex;align-items:center;gap:2px;border-radius:10px}
.dmx-run:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmx-run[data-on=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dmx-run-main{flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:6px 8px;border-radius:10px;cursor:pointer}
.dmx-check{width:13px;height:13px;flex:none;border-radius:4px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;line-height:1;color:var(--dsw-alias-label-primary-foreground,#fff)}
.dmx-check[data-on=true]{border-color:transparent;background:var(--dsw-alias-brand-primary)}
.dmx-dot{width:8px;height:8px;flex:none;border-radius:50%}
.dmx-run-text{display:flex;flex-direction:column;min-width:0;flex:1}
.dmx-run-name{font-size:13px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dmx-run-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dmx-icon-btn{width:26px;height:26px;flex:none;margin-right:4px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font:inherit;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s}
.dmx-run:hover .dmx-icon-btn,.dmx-icon-btn:focus-visible,.dmx-icon-btn[data-armed=true]{opacity:1}
.dmx-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary)}
.dmx-icon-btn[data-armed=true]{color:var(--dsw-alias-state-error-primary);width:auto;padding:0 6px}
.dmx-sdk{margin:12px 4px 0;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;padding:8px 10px;font-size:12px}
.dmx-sdk summary{cursor:pointer;color:var(--dsw-alias-label-secondary);list-style:none}
.dmx-sdk summary::-webkit-details-marker{display:none}
.dmx-sdk pre{margin:8px 0;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.5;overflow:auto;max-height:220px}
.dmx-sdk-actions{display:flex;gap:6px;flex-wrap:wrap}
.dmx-link{color:var(--dsw-alias-brand-primary);text-decoration:none;font-size:12px}
.dmx-link:hover{text-decoration:underline}
.dmx-error{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-error-primary);font-size:13px}
.dmx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:16px}
.dmx-card{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l1);border-radius:16px;padding:12px 14px 10px;min-width:0}
.dmx-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px}
.dmx-card-head h3{margin:0;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dmx-card-note{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap}
.dmx-chartbox{position:relative;width:100%;min-height:120px}
.dmx-chart{display:block;overflow:visible}
.dmx-tip{position:absolute;z-index:2;pointer-events:none;min-width:150px;max-width:240px;background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;padding:7px 9px;box-shadow:0 6px 20px #00000026;font-size:12px;line-height:18px}
.dmx-tip-head{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;margin-bottom:2px}
.dmx-tip-row{display:flex;align-items:center;gap:6px;justify-content:space-between}
.dmx-tip-name{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dmx-tip-value{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.dmx-legend{display:flex;flex-wrap:wrap;gap:3px 12px;padding-top:4px}
.dmx-legend-item{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));max-width:100%}
.dmx-legend-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.dmx-legend-value{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.dmx-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:44px 20px;color:var(--dsw-alias-label-secondary)}
.dmx-empty h2{margin:0;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dmx-empty p{margin:0;max-width:560px;font-size:13px;line-height:1.7}
.dmx-empty-glyph{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.dmx-snippet{box-sizing:border-box;width:min(100%,560px);text-align:left;margin:4px 0 0;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.6;overflow:auto}
.dmx-row-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.dmx-path{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));word-break:break-all}
.dmx-range{display:flex;align-items:center;gap:6px}
.dmx-overview{margin-top:24px}
.dmx-overview h3{margin:0 0 8px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.dmx-table-wrap{overflow:auto;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px}
.dmx-table{width:100%;border-collapse:collapse;font-size:12px}
.dmx-table th,.dmx-table td{padding:7px 10px;text-align:left;white-space:nowrap;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dmx-table th{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-weight:500;background:var(--dsw-alias-bg-layer-2);position:sticky;top:0}
.dmx-table tr:last-child td{border-bottom:0}
.dmx-table td.num{font-variant-numeric:tabular-nums}
.dmx-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dmx-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}
.dmx-pill-dot[data-status=finished]{background:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
@media (width<=820px){.dmx-body{flex-direction:column}.dmx-side{width:auto;max-height:240px;border-right:0;border-bottom:.5px solid var(--dsw-alias-border-l1)}.dmx-main{padding-bottom:32px}}
`

    function formatNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const abs = Math.abs(value)
      if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) return value.toExponential(2)
      if (Number.isInteger(value)) return String(value)
      return String(Number(value.toPrecision(4)))
    }

    function formatTick(value) {
      const abs = Math.abs(value)
      if (abs === 0) return '0'
      if (abs >= 1e5 || abs < 1e-2) return value.toExponential(1)
      return String(Number(value.toPrecision(3)))
    }

    function splitKey(key) {
      const at = key.indexOf('/')
      return at < 0 ? [key, ''] : [key.slice(0, at), key.slice(at + 1)]
    }

    function metricRank(name) {
      const lower = name.toLowerCase()
      if (lower.includes('loss')) return 0
      if (/(acc|accuracy|f1|auc|precision|recall)/.test(lower)) return 1
      if (/(lr|learning.?rate)/.test(lower)) return 3
      return 2
    }

    function relativeTime(t, ms) {
      const delta = Date.now() - ms
      if (!Number.isFinite(delta) || delta < 60000) return t('time.now')
      if (delta < 3600000) return t('time.minutes', { n: Math.floor(delta / 60000) })
      if (delta < 86400000) return t('time.hours', { n: Math.floor(delta / 3600000) })
      return t('time.days', { n: Math.floor(delta / 86400000) })
    }

    function useWidth(ref) {
      const [width, setWidth] = React.useState(0)
      React.useEffect(() => {
        const element = ref.current
        if (element === null) return undefined
        const measure = () => setWidth(element.clientWidth)
        measure()
        if (typeof ResizeObserver !== 'function') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [ref])
      return width
    }

    function smoothPoints(points, alpha) {
      if (alpha <= 0.001) return points
      const out = new Array(points.length)
      let previous = null
      for (let i = 0; i < points.length; i += 1) {
        const [x, y] = points[i]
        previous = previous === null ? y : previous * alpha + y * (1 - alpha)
        out[i] = [x, previous]
      }
      return out
    }

    function nearestPoint(points, target) {
      let best = points[0]
      let distance = Math.abs(best[0] - target)
      for (let i = 1; i < points.length; i += 1) {
        const next = Math.abs(points[i][0] - target)
        if (next < distance) {
          best = points[i]
          distance = next
        }
      }
      return best
    }

    function Chart(props) {
      const { t, series, logY, smoothing, height } = props
      const box = React.useRef(null)
      const measured = useWidth(box)
      const width = measured > 0 ? measured : 480
      const [hover, setHover] = React.useState(null)
      const padLeft = 58
      const padRight = 14
      const padTop = 12
      const padBottom = 24
      const innerWidth = Math.max(40, width - padLeft - padRight)
      const innerHeight = Math.max(40, height - padTop - padBottom)

      const usable = series.filter((item) => item.points.length > 0)
      if (usable.length === 0) return null
      let xMin = Infinity
      let xMax = -Infinity
      let rawMin = Infinity
      let rawMax = -Infinity
      for (const item of usable) {
        for (const [x, y] of item.points) {
          if (x < xMin) xMin = x
          if (x > xMax) xMax = x
          if (y < rawMin) rawMin = y
          if (y > rawMax) rawMax = y
        }
      }
      const useLog = Boolean(logY) && rawMin > 0
      const transform = useLog ? (value) => Math.log10(value) : (value) => value
      let yMin = transform(rawMin)
      let yMax = transform(rawMax)
      if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null
      if (xMin === xMax) xMax = xMin + 1
      if (yMin === yMax) {
        const pad = Math.abs(yMin) * 0.08 || 0.5
        yMin -= pad
        yMax += pad
      }
      const yPad = (yMax - yMin) * 0.06
      yMin -= yPad
      yMax += yPad

      const xScale = (value) => padLeft + ((value - xMin) / (xMax - xMin)) * innerWidth
      const yScale = (value) => padTop + (1 - (transform(value) - yMin) / (yMax - yMin)) * innerHeight

      const yTicks = []
      for (let i = 0; i <= 4; i += 1) {
        const value = useLog
          ? 10 ** (yMin + ((yMax - yMin) * i) / 4)
          : yMin + ((yMax - yMin) * i) / 4
        yTicks.push({ value, y: padTop + (1 - i / 4) * innerHeight })
      }
      const xTicks = []
      for (let i = 0; i <= 4; i += 1) {
        const value = xMin + ((xMax - xMin) * i) / 4
        xTicks.push({ value, x: padLeft + (i / 4) * innerWidth })
      }

      const onMove = (event) => {
        if (usable.length === 0) return
        const rect = event.currentTarget.getBoundingClientRect()
        const left = Math.max(0, Math.min(innerWidth, event.clientX - rect.left - padLeft))
        const target = xMin + (left / innerWidth) * (xMax - xMin)
        const rows = usable.map((item) => {
          const point = nearestPoint(item.points, target)
          return { key: item.key, name: item.name, color: item.color, x: point[0], value: point[1] }
        })
        setHover({ left: left + padLeft, rows })
      }

      const children = []
      yTicks.forEach((tick, index) => {
        children.push(h('line', {
          key: `grid-y-${index}`,
          x1: padLeft,
          x2: width - padRight,
          y1: tick.y,
          y2: tick.y,
          stroke: 'var(--dsw-alias-border-l1)',
          strokeWidth: 1,
        }))
        children.push(h('text', {
          key: `label-y-${index}`,
          x: padLeft - 8,
          y: tick.y + 3.5,
          textAnchor: 'end',
          fill: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
          fontSize: 10,
        }, formatTick(tick.value)))
      })
      xTicks.forEach((tick, index) => {
        children.push(h('text', {
          key: `label-x-${index}`,
          x: tick.x,
          y: height - 7,
          textAnchor: index === 0 ? 'start' : index === 4 ? 'end' : 'middle',
          fill: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
          fontSize: 10,
        }, formatTick(tick.value)))
      })
      for (const item of usable) {
        const path = item.points
          .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${xScale(x).toFixed(2)},${yScale(y).toFixed(2)}`)
          .join(' ')
        if (smoothing > 0.001) {
          children.push(h('path', {
            key: `raw-${item.key}`,
            d: path,
            fill: 'none',
            stroke: item.color,
            strokeWidth: 1,
            opacity: 0.18,
          }))
        }
        const line = smoothing > 0.001 ? smoothPoints(item.points, smoothing) : item.points
        children.push(h('path', {
          key: `line-${item.key}`,
          d: line.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${xScale(x).toFixed(2)},${yScale(y).toFixed(2)}`).join(' '),
          fill: 'none',
          stroke: item.color,
          strokeWidth: 1.8,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }))
        const last = item.points[item.points.length - 1]
        children.push(h('circle', {
          key: `dot-${item.key}`,
          cx: xScale(last[0]),
          cy: yScale(last[1]),
          r: 2.4,
          fill: item.color,
        }))
      }

      if (hover !== null) {
        children.push(h('line', {
          key: 'hover-line',
          x1: hover.left,
          x2: hover.left,
          y1: padTop,
          y2: padTop + innerHeight,
          stroke: 'var(--dsw-alias-border-l2)',
          strokeWidth: 1,
          strokeDasharray: '3 3',
        }))
        for (const row of hover.rows) {
          children.push(h('circle', {
            key: `hover-dot-${row.key}`,
            cx: xScale(row.x),
            cy: yScale(row.value),
            r: 3,
            fill: row.color,
            stroke: 'var(--dsw-alias-bg-layer-1)',
            strokeWidth: 1.5,
          }))
        }
      }

      const lastValues = usable.map((item) => ({
        key: item.key,
        name: item.name,
        color: item.color,
        value: item.points[item.points.length - 1][1],
      }))
      const tipLeft = hover === null ? 0 : Math.min(Math.max(8, hover.left + 12), Math.max(8, width - 200))

      return h('div', { className: 'dmx-chartbox', ref: box },
        h('svg', {
          className: 'dmx-chart',
          width,
          height,
          role: 'img',
          'aria-label': props.metric,
          onMouseMove: onMove,
          onMouseLeave: () => setHover(null),
        }, children),
        hover === null ? null : h('div', { className: 'dmx-tip', style: { left: tipLeft, top: 6 } },
          h('div', { className: 'dmx-tip-head' }, `${props.metric} · ${formatTick(hover.rows[0].x)}`),
          hover.rows.slice(0, 8).map((row) => h('div', { className: 'dmx-tip-row', key: row.key },
            h('span', { className: 'dmx-tip-name' },
              h('span', { className: 'dmx-dot', style: { background: row.color } }),
              row.name),
            h('span', { className: 'dmx-tip-value' }, formatNumber(row.value))))),
        h('div', { className: 'dmx-legend' },
          lastValues.map((item) => h('span', { className: 'dmx-legend-item', key: item.key },
            h('span', { className: 'dmx-dot', style: { background: item.color } }),
            h('span', { className: 'dmx-legend-name' }, item.name),
            h('span', { className: 'dmx-legend-value' }, formatNumber(item.value))))))
    }

    function SdkBlock(props) {
      const { t, sdkUrl } = props
      const [copied, setCopied] = React.useState(false)
      const copy = () => {
        const done = () => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }
        try {
          navigator.clipboard.writeText(SNIPPET).then(done, () => {})
        } catch {
          // Clipboard access can be unavailable; the snippet stays selectable.
        }
      }
      return h(React.Fragment, null,
        h('pre', { className: 'dmx-snippet' }, SNIPPET),
        h('div', { className: 'dmx-row-actions' },
          h('button', { type: 'button', className: 'dmx-btn', onClick: copy }, copied ? t('empty.copied') : t('empty.copy')),
          h('a', {
            className: 'dmx-link',
            href: sdkUrl || '/dsh-metrics/sdk/dsh_metrics.py',
            download: 'dsh_metrics.py',
          }, t('empty.download'))))
    }

    function Overview(props) {
      const { t, runs, details, colors } = props
      const names = []
      for (const run of runs) {
        const data = details[run.key] !== undefined ? details[run.key].data : undefined
        if (data === undefined || data === null) continue
        for (const name of Object.keys(data.series || {})) {
          if (!names.includes(name)) names.push(name)
        }
      }
      names.sort((left, right) => metricRank(left) - metricRank(right) || left.localeCompare(right))
      const shown = names.slice(0, 8)
      return h('section', { className: 'dmx-overview' },
        h('h3', null, t('overview.title')),
        h('div', { className: 'dmx-table-wrap' },
          h('table', { className: 'dmx-table' },
            h('thead', null, h('tr', null,
              h('th', null, t('overview.run')),
              h('th', null, t('overview.project')),
              h('th', null, t('overview.steps')),
              h('th', null, t('overview.status')),
              shown.map((name) => h('th', { key: name }, name)))),
            h('tbody', null, runs.map((run) => {
              const data = details[run.key] !== undefined ? details[run.key].data : undefined
              const series = data !== undefined && data !== null ? data.series || {} : {}
              return h('tr', { key: run.key },
                h('td', null, h('span', { className: 'dmx-pill' },
                  h('span', { className: 'dmx-dot', style: { background: colors[run.key] } }),
                  run.name)),
                h('td', null, run.project),
                h('td', { className: 'num' }, run.steps >= 0 ? formatNumber(run.steps) : '—'),
                h('td', null, h('span', { className: 'dmx-pill' },
                  h('span', { className: 'dmx-pill-dot', 'data-status': run.status }),
                  run.status === 'finished' ? t('run.finished') : t('run.running'))),
                shown.map((name) => {
                  const points = series[name]
                  const value = Array.isArray(points) && points.length > 0 ? points[points.length - 1][1] : undefined
                  return h('td', { key: name, className: 'num' }, formatNumber(value))
                }))
            })))),
        names.length > shown.length
          ? h('div', { className: 'dmx-path', style: { marginTop: 6 } }, t('page.metricsHidden', { count: names.length - shown.length }))
          : null)
    }

    class PageBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        console.error('dsh-metrics: page render failed', error, info)
      }

      render() {
        if (this.state.error !== null) {
          const t = this.props.t
          return h('div', { className: 'dmx-root' },
            h('style', null, CSS),
            h('div', { className: 'dmx-empty' },
              h('h2', null, t('crash.title')),
              h('p', null, t('crash.hint')),
              h('pre', { className: 'dmx-snippet' }, String((this.state.error && this.state.error.stack) || this.state.error))))
        }
        return this.props.children
      }
    }

    function MetricsPanel(props) {
      return h(PageBoundary, { t: props.t }, h(MetricsPage, props))
    }

    function MetricsPage(props) {
      const t = props.t
      const [state, setState] = React.useState({ status: 'loading', runs: [], root: '', sdkUrl: '' })
      const [error, setError] = React.useState('')
      const [selected, setSelected] = React.useState(() => new Set())
      const [projectFilter, setProjectFilter] = React.useState(() => {
        const saved = readPref(PREF_PROJECT, 'all')
        return typeof saved === 'string' && saved !== '' ? saved : 'all'
      })
      const [collapsed, setCollapsed] = React.useState(() => {
        const saved = readPref(PREF_COLLAPSED, [])
        return new Set(Array.isArray(saved) ? saved.filter((name) => typeof name === 'string') : [])
      })
      const [details, setDetails] = React.useState({})
      const [live, setLive] = React.useState(true)
      const [smoothing, setSmoothing] = React.useState(0.35)
      const [logY, setLogY] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [metricQuery, setMetricQuery] = React.useState('')
      const [armed, setArmed] = React.useState(null)
      const stateRef = React.useRef(state)
      stateRef.current = state

      React.useEffect(() => { writePref(PREF_PROJECT, projectFilter) }, [projectFilter])
      React.useEffect(() => { writePref(PREF_COLLAPSED, [...collapsed]) }, [collapsed])

      const loadState = React.useCallback(async () => {
        const payload = await fetch(`${API}/state`, { cache: 'no-store' }).then(async (response) => {
          const text = await response.text()
          let value
          try {
            value = text === '' ? undefined : JSON.parse(text)
          } catch {
            throw new Error(`bad response (${response.status})`)
          }
          if (!response.ok) throw new Error((value && value.error) || `request failed (${response.status})`)
          return value
        })
        const runs = Array.isArray(payload.runs) ? payload.runs : []
        setState({ status: 'ready', runs, root: typeof payload.root === 'string' ? payload.root : '', sdkUrl: typeof payload.sdkUrl === 'string' ? payload.sdkUrl : '' })
        setError('')
      }, [])

      React.useEffect(() => {
        let alive = true
        let timer = null
        const run = async () => {
          try {
            await loadState()
          } catch (cause) {
            if (alive) {
              setError(cause instanceof Error ? cause.message : String(cause))
              setState((previous) => (previous.status === 'loading' ? { ...previous, status: 'error' } : previous))
            }
          } finally {
            if (alive) timer = window.setTimeout(run, live ? 3000 : 15000)
          }
        }
        run()
        return () => {
          alive = false
          if (timer !== null) window.clearTimeout(timer)
        }
      }, [live, loadState])

      const selectedKeys = React.useMemo(() => [...selected].sort(), [selected])
      const runSignature = React.useMemo(
        () => state.runs.map((run) => `${run.key}:${run.updated}:${run.steps}`).join('|'),
        [state.runs],
      )

      React.useEffect(() => {
        let alive = true
        const known = new Set(stateRef.current.runs.map((run) => run.key))
        const keys = selectedKeys.filter((key) => known.has(key))
        if (keys.length === 0) return () => { alive = false }
        Promise.all(keys.map(async (key) => {
          const [project, run] = splitKey(key)
          try {
            const response = await fetch(`${API}/run?project=${encodeURIComponent(project)}&run=${encodeURIComponent(run)}`, { cache: 'no-store' })
            const text = await response.text()
            const data = text === '' ? undefined : JSON.parse(text)
            if (!response.ok) throw new Error((data && data.error) || `request failed (${response.status})`)
            return [key, { status: 'ready', data }]
          } catch (cause) {
            return [key, { status: 'error', error: cause instanceof Error ? cause.message : String(cause) }]
          }
        })).then((entries) => {
          if (!alive) return
          setDetails((previous) => {
            const next = { ...previous }
            for (const [key, entry] of entries) next[key] = entry
            return next
          })
        })
        return () => { alive = false }
      }, [selectedKeys, runSignature])

      const colors = React.useMemo(() => {
        const map = {}
        const sorted = state.runs.slice().sort((left, right) => left.key.localeCompare(right.key))
        sorted.forEach((run, index) => { map[run.key] = COLORS[index % COLORS.length] })
        return map
      }, [state.runs])

      const projects = React.useMemo(() => {
        const map = new Map()
        for (const run of state.runs) {
          const entry = map.get(run.project) ?? { name: run.project, count: 0, updated: 0 }
          entry.count += 1
          if (run.updated > entry.updated) entry.updated = run.updated
          map.set(run.project, entry)
        }
        return [...map.values()].sort((left, right) => right.updated - left.updated)
      }, [state.runs])

      const activeProject = projectFilter === 'all' || projects.some((project) => project.name === projectFilter) ? projectFilter : 'all'

      React.useEffect(() => {
        if (activeProject !== projectFilter) setProjectFilter(activeProject)
      }, [activeProject, projectFilter])

      const selectedRuns = React.useMemo(
        () => state.runs.filter((run) => selected.has(run.key) && (activeProject === 'all' || run.project === activeProject)),
        [state.runs, selected, activeProject],
      )

      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return state.runs.filter((run) => {
          if (activeProject !== 'all' && run.project !== activeProject) return false
          if (needle === '') return true
          const haystack = `${run.project} ${run.name} ${run.tags.join(' ')} ${JSON.stringify(run.config)}`.toLowerCase()
          return haystack.includes(needle)
        })
      }, [state.runs, query, activeProject])

      const groups = React.useMemo(() => {
        const map = new Map()
        for (const run of filtered) {
          if (!map.has(run.project)) map.set(run.project, [])
          map.get(run.project).push(run)
        }
        return [...map.entries()].sort((left, right) => {
          const leftTime = Math.max(...left[1].map((run) => run.updated))
          const rightTime = Math.max(...right[1].map((run) => run.updated))
          return rightTime - leftTime
        })
      }, [filtered])

      const metrics = React.useMemo(() => {
        const names = new Set()
        for (const run of selectedRuns) {
          const entry = details[run.key]
          const data = entry !== undefined ? entry.data : undefined
          if (data === undefined || data === null) continue
          for (const name of Object.keys(data.series || {})) names.add(name)
        }
        const needle = metricQuery.trim().toLowerCase()
        return [...names]
          .filter((name) => needle === '' || name.toLowerCase().includes(needle))
          .sort((left, right) => metricRank(left) - metricRank(right) || left.localeCompare(right))
      }, [selectedRuns, details, metricQuery])

      const toggle = (key) => {
        setSelected((previous) => {
          const next = new Set(previous)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        })
      }

      const selectAll = () => setSelected(new Set(filtered.map((run) => run.key)))
      const selectNone = () => setSelected(new Set())

      const removeRun = async (key) => {
        const [project, run] = splitKey(key)
        setArmed(null)
        try {
          const response = await fetch(`${API}/delete`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ project, run }),
          })
          const text = await response.text()
          const value = text === '' ? undefined : JSON.parse(text)
          if (!response.ok) throw new Error((value && value.error) || `request failed (${response.status})`)
          setSelected((previous) => {
            const next = new Set(previous)
            next.delete(key)
            return next
          })
          setDetails((previous) => {
            const next = { ...previous }
            delete next[key]
            return next
          })
          await loadState()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      const sidebar = h('aside', { className: 'dmx-side' },
        h('div', { className: 'dmx-side-scroll' },
          h('select', {
            className: 'dmx-select',
            value: activeProject,
            onChange: (event) => {
              setProjectFilter(event.target.value)
              setCollapsed(new Set())
            },
            'aria-label': t('project.filter'),
            title: t('project.filter'),
          },
          h('option', { value: 'all' }, t('project.all', { count: state.runs.length })),
          projects.map((project) => h('option', { value: project.name, key: project.name }, `${project.name} · ${project.count}`))),
          h('input', {
            className: 'dmx-input',
            type: 'search',
            placeholder: t('search.placeholder'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t('search.placeholder'),
          }),
          h('div', { className: 'dmx-side-actions' },
            h('span', { className: 'dmx-path' }, t('page.runs', { count: filtered.length })),
            h('span', { style: { display: 'inline-flex', gap: 2 } },
              h('button', { type: 'button', className: 'dmx-btn', onClick: selectAll }, t('runs.all')),
              h('button', { type: 'button', className: 'dmx-btn', onClick: selectNone }, t('runs.none')))),
          groups.length === 0
            ? h('div', { className: 'dmx-path', style: { padding: '14px 6px' } }, state.status === 'loading' ? t('page.loading') : t('runs.empty'))
            : groups.map(([project, runs]) => {
              const isCollapsed = collapsed.has(project)
              return h('div', { className: 'dmx-group', key: project },
                h('div', { className: 'dmx-group-head' },
                  h('button', {
                    type: 'button',
                    className: 'dmx-group-toggle',
                    'aria-expanded': !isCollapsed,
                    title: t(isCollapsed ? 'group.expand' : 'group.collapse', { name: project }),
                    onClick: () => setCollapsed((previous) => {
                      const next = new Set(previous)
                      if (next.has(project)) next.delete(project)
                      else next.add(project)
                      return next
                    }),
                  },
                  h(Chevron, { open: !isCollapsed }),
                  h('span', { className: 'dmx-group-name' }, project),
                  h('span', { className: 'dmx-group-count' }, runs.length))),
                isCollapsed ? null : runs.map((run) => {
                const on = selected.has(run.key)
                const color = colors[run.key] || COLORS[0]
                const isArmed = armed === run.key
                return h('div', { className: 'dmx-run', 'data-on': on, key: run.key },
                  h('button', {
                    type: 'button',
                    className: 'dmx-run-main',
                    'aria-pressed': on,
                    onClick: () => toggle(run.key),
                    title: run.description || run.key,
                  },
                  h('span', { className: 'dmx-check', 'data-on': on }, on ? '✓' : ''),
                  h('span', { className: 'dmx-dot', style: { background: color } }),
                  h('span', { className: 'dmx-run-text' },
                    h('span', { className: 'dmx-run-name' }, run.name),
                    h('span', { className: 'dmx-run-meta' },
                      `${run.steps >= 0 ? t('run.step', { step: formatNumber(run.steps) }) : t('run.noData')} · ${relativeTime(t, run.updated)} · ${run.status === 'finished' ? t('run.finished') : t('run.running')}`))),
                  h('button', {
                    type: 'button',
                    className: 'dmx-icon-btn',
                    'data-armed': isArmed,
                    'aria-label': t('run.delete', { name: run.name }),
                    title: t('run.delete', { name: run.name }),
                    onClick: (event) => {
                      event.stopPropagation()
                      if (isArmed) removeRun(run.key)
                      else {
                        setArmed(run.key)
                        window.setTimeout(() => setArmed((current) => (current === run.key ? null : current)), 4000)
                      }
                    },
                  }, isArmed ? t('run.confirm') : '✕'))
                }))
            })
        ),
        h('details', { className: 'dmx-sdk' },
          h('summary', null, t('sdk.title')),
          h(SdkBlock, { t, sdkUrl: state.sdkUrl })))

      const hasRuns = state.runs.length > 0
      let main
      if (!hasRuns && state.status === 'loading') {
        main = h('div', { className: 'dmx-empty' }, h('p', null, t('page.loading')))
      } else if (!hasRuns) {
        main = h('div', { className: 'dmx-empty' },
          h('div', { className: 'dmx-empty-glyph' }, h(ChartGlyph, { size: 44 })),
          h('h2', null, t('empty.title')),
          h('p', null, t('empty.body')),
          h(SdkBlock, { t, sdkUrl: state.sdkUrl }),
          h('div', { className: 'dmx-path' }, `${t('empty.dir')}: ${state.root || '—'}`),
          h('p', { className: 'dmx-path' }, t('empty.hint')))
      } else if (selectedRuns.length === 0) {
        main = h('div', { className: 'dmx-empty' },
          h('div', { className: 'dmx-empty-glyph' }, h(ChartGlyph, { size: 40 })),
          h('h2', null, t('page.selectTitle')),
          h('p', null, t('page.selectHint')),
          h('button', { type: 'button', className: 'dmx-btn', onClick: selectAll }, t('page.selectVisible')))
      } else {
        main = h(React.Fragment, null,
          h('div', { className: 'dmx-grid' },
            metrics.length === 0
              ? h('div', { className: 'dmx-card' }, h('div', { className: 'dmx-card-head' }, h('h3', null, t('page.loading'))))
              : metrics.map((metric) => {
                const series = selectedRuns
                  .map((run) => {
                    const entry = details[run.key]
                    const data = entry !== undefined ? entry.data : undefined
                    const points = data !== undefined && data !== null && data.series ? data.series[metric] : undefined
                    return {
                      key: run.key,
                      name: run.name,
                      color: colors[run.key] || COLORS[0],
                      points: Array.isArray(points) ? points : [],
                    }
                  })
                  .filter((item) => item.points.length > 0)
                return h('div', { className: 'dmx-card', key: metric },
                  h('div', { className: 'dmx-card-head' },
                    h('h3', { title: metric }, metric),
                    h('span', { className: 'dmx-card-note' }, t('chart.runs', { count: series.length }))),
                  series.length === 0
                    ? h('div', { className: 'dmx-path', style: { padding: '24px 0' } }, t('chart.empty'))
                    : h(Chart, { t, metric, series, logY, smoothing, height: 190 }))
              })),
          metrics.length > 0 ? h(Overview, { t, runs: selectedRuns, details, colors }) : null)
      }

      return h('div', { className: 'dmx-root' },
        h('style', null, CSS),
        h('header', { className: 'dmx-header' },
          h('div', { className: 'dmx-heading' },
            h('h1', null, t('page.title')),
            h('span', { className: 'dmx-sub', title: state.root },
              state.status === 'ready'
                ? `${t('page.runs', { count: state.runs.length })}${selectedRuns.length > 0 ? ` · ${t('runs.selected', { count: selectedRuns.length })}` : ''}${state.root === '' ? '' : ` · ${state.root}`}`
                : t('page.loading'))),
          h('div', { className: 'dmx-controls' },
            hasRuns ? h('input', {
              className: 'dmx-input',
              style: { width: 150 },
              type: 'search',
              placeholder: t('metrics.filter'),
              value: metricQuery,
              onChange: (event) => setMetricQuery(event.target.value),
              'aria-label': t('metrics.filter'),
            }) : null,
            h('div', { className: 'dmx-fader' },
              h('span', null, t('controls.smoothing')),
              h('input', {
                type: 'range',
                min: 0,
                max: 0.95,
                step: 0.05,
                value: smoothing,
                onChange: (event) => setSmoothing(Number(event.target.value)),
                'aria-label': t('controls.smoothing'),
              })),
            h('button', {
              type: 'button',
              className: 'dmx-btn',
              'aria-pressed': logY,
              onClick: () => setLogY((value) => !value),
            }, t('controls.logy')),
            h('button', {
              type: 'button',
              className: 'dmx-btn',
              'aria-pressed': live,
              onClick: () => setLive((value) => !value),
            }, h('span', { className: 'dmx-live-dot' }), t('controls.live')),
            h('button', {
              type: 'button',
              className: 'dmx-btn',
              onClick: () => { loadState().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause))) },
            }, t('controls.refresh')))),
        h('div', { className: 'dmx-body' },
          sidebar,
          h('div', { className: 'dmx-main' },
            error === '' ? null : h('div', { className: 'dmx-error' },
              h('span', null, t('page.error', { message: error })),
              h('button', {
                type: 'button',
                className: 'dmx-btn',
                onClick: () => {
                  setError('')
                  loadState().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
                },
              }, t('page.retry'))),
            main)))
    }

    function ChartGlyph({ size }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 64 64',
        fill: 'none',
        'aria-hidden': true,
      },
      h('rect', { x: 4, y: 4, width: 56, height: 56, rx: 16, fill: 'currentColor', opacity: 0.08 }),
      h('path', { d: 'M16 46 L16 18 M16 46 L50 46', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.45 }),
      h('path', { d: 'M20 39 L29 31 L37 35 L47 20', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('circle', { cx: 20, cy: 39, r: 2.6, fill: 'var(--dsw-alias-brand-primary)' }),
      h('circle', { cx: 47, cy: 20, r: 2.6, fill: 'var(--dsw-alias-brand-primary)' }))
    }

    function Chevron({ open }) {
      return h('svg', {
        className: 'dmx-chevron',
        'data-open': open,
        width: 10,
        height: 10,
        viewBox: '0 0 12 12',
        fill: 'none',
        'aria-hidden': true,
      }, h('path', {
        d: 'M4 2 L8 6 L4 10',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    function PanelIcon({ size }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
      },
      h('path', { d: 'M4 19 L4 5 M4 19 L20 19', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', opacity: 0.55 }),
      h('path', { d: 'M7 15 L11 11 L14.5 13 L19 6.5', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      h('circle', { cx: 7, cy: 15, r: 1.4, fill: 'currentColor' }),
      h('circle', { cx: 19, cy: 6.5, r: 1.4, fill: 'currentColor' }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-metrics: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'metrics',
          locale: NS,
          inject: () => ({ t }),
        }, MetricsPanel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'metrics',
          order: 20,
          locale: NS,
          label: () => t('panel.title'),
        }, PanelIcon))
      },
    }
  },
})
