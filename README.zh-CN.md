<p align="center">
  <img src="docs/banner.svg" alt="dsh-metrics — 实时训练曲线" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2ea44f"></a>
  <img alt="DeepSeek Harness Web" src="https://img.shields.io/badge/DeepSeek%20Harness-Web-4c8dff">
  <img alt="Python 3.8+" src="https://img.shields.io/badge/Python-3.8%2B-3776AB">
  <img alt="零运行时依赖" src="https://img.shields.io/badge/runtime%20deps-0-8b5cf6">
</p>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b></p>

**dsh-metrics** 给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
的 Web GUI 加了一个 W&B 风格的实时训练看板。它是一个标准的 DSH 插件：一个侧边栏入口、
一个全屏曲线页、四个 agent 工具，以及一个零依赖的 Python 上报脚本。

不需要账号、不联网、不用改训练框架、没有构建步骤。曲线以 JSONL 存在
`~/.dsh/metrics`，通过本机 Harness 服务实时送到页面。

```text
训练循环 ──► dsh_metrics.py ──► ~/.dsh/metrics/<project>/<run>/history.jsonl
                                        │
                     Harness Host ◄─────┘  (HTTP + agent 工具)
                          │
                 Web GUI ▸ 侧边栏 ▸ 指标
```

## 特性

- **整条训练曲线，不是滚动窗口**：横轴从第一个 step 到最新 step，新点只会延长同一条线。
- **默认实时**：页面打开时每 3 秒刷新；跟踪日志文件时会自动追加新 epoch。
- **多运行对比**：多选叠加、每个 run 独立颜色、EMA 平滑、对数纵轴、悬停读数、最新数值表。
- **按项目查看**：项目筛选、项目分组折叠，只对比自己勾选的 run；首次打开不默认选择任何 run。
- **Python 三行接入**：只用标准库；NaN/inf 自动跳过；每个点都 flush，崩溃不丢曲线。
- **Agent 原生**：`metrics_log`、`metrics_import`、`metrics_list`、`metrics_get`
  让任意 DSH agent 直接上报、导入、查看和分析。
- **已有日志直接导入**：CSV、TSV、JSONL、JSON 数组；重复导入只追加新行。
- **本地优先**：数据不出机器，run 就是目录，可以直接读、备份、grep 或删除。

## 环境要求

| | |
|---|---|
| Harness | 使用 **web** profile 的 `dsh`（DSH 0.2.x） |
| 浏览器 | 现代 Chromium/Firefox/Safari，页面跟随宿主主题 |
| Python（可选） | 3.8+，无第三方依赖 |
| 包管理器 | `pnpm`（`dsh plugin` 安装插件时使用） |

## 安装

```bash
dsh plugin --profile web add github:inkwindA/dsh-metrics
```

或者从本地 clone 安装：

```bash
git clone https://github.com/inkwindA/dsh-metrics.git
dsh plugin --profile web add ./dsh-metrics
```

安装后会链接进当前 profile 并即时生效。**刷新一次 Web 页面**即可，不需要重启 Harness。
侧边栏面板列表会出现折线图标 **指标 / Metrics**。

验证：

```bash
curl -s http://127.0.0.1:3080/dsh-metrics/api/state
```

```json
{"version":"1.0.0","root":"/home/you/.dsh/metrics","runs":[]}
```

## 快速开始

训练脚本里直接下载并使用零依赖 SDK：

```bash
curl -fsSL http://127.0.0.1:3080/dsh-metrics/sdk/dsh_metrics.py -o dsh_metrics.py
```

```python
import dsh_metrics

run = dsh_metrics.init(
    project="mnist",
    name="baseline",
    config={"lr": 1e-3, "batch_size": 64},
    tags=["cnn"],
)

for epoch in range(1, 11):
    train_loss, train_acc = train_one_epoch(model)
    val_loss, val_acc = evaluate(model)
    run.log({
        "loss": train_loss,
        "acc": train_acc,
        "val_loss": val_loss,
        "val_acc": val_acc,
    }, step=epoch)

run.finish()
```

也支持 `run.log(loss=..., acc=..., step=...)`。指标名可以带 `/`
（如 `"train/loss"`、`"val/acc"`）；不传 `step` 时从 0 自增。

每次 `init()` 创建新 run；`resume=True` 续上同名且未结束的 run。数据目录优先级：
`$DSH_METRICS_DIR` → `$DSH_HOME/metrics` → `~/.dsh/metrics`。

## 页面

侧边栏点击 **指标**：

| 区域 | 功能 |
|---|---|
| 左列 | 项目筛选、搜索、项目分组折叠、多选和删除；首次打开不默认选择 run；`running` 表示还在写，`finished` 表示已结束 |
| 图表区 | 每个指标一张 SVG 图；悬停十字线读数；选中的 run 用不同颜色叠加 |
| 工具栏 | 指标筛选、EMA 平滑、对数纵轴、Live 轮询（3 秒）、手动刷新 |
| 最新数值表 | 每个选中 run 的各指标最新值、步数和 config |
| Python SDK | 页面内复制代码或直接下载 `dsh_metrics.py` |

横轴始终覆盖**整个 run**。`maxPoints` 只决定浏览器拿到多少采样点（均匀降采样），
不会缩小横轴范围。

## Agent 工具

同一 profile 里的任意 DSH agent 都会自动看到这些工具，和页面共用同一份数据。

| 工具 | 用途 |
|---|---|
| `metrics_log` | 追加数据点；把分析结果直接变成曲线 |
| `metrics_import` | 导入 CSV/TSV/JSONL/JSON；重复导入只追加新行，`follow: true` 可持续跟踪 |
| `metrics_list` | 列出 run、最新值、最小/最大值、步数、config |
| `metrics_get` | 读取单个 run 的序列（默认降采样到 120 点），用于分析、对比、找异常 |

### 一条命令展示完整训练任务

```json
{
  "path": "runs/exp1/train.csv",
  "project": "detr",
  "run": "exp1",
  "follow": true,
  "intervalSeconds": 5,
  "idleSeconds": 900
}
```

`metrics_import` 先读一次文件，随后 Host 每 5 秒只追加新行。曲线从第一个 epoch 一直延长到
最后一个，不会重画或重复。连续 15 分钟没有新行就停止跟踪并标记 finished。
重启 DSH 会停止跟踪（数据不丢），重新执行一次导入即可接着追加。

### 给其他智能体的一句话

> 跟踪 `runs/exp1/train.csv` 到指标看板，project=`detr`、run=`exp1`，
> 要完整训练曲线，并随新 epoch 实时刷新。

通用版：

> 把这次训练的**完整曲线**（每个 step/epoch，从第 1 轮到结束）持续写进指标看板：
> 训练脚本在循环里调 `run.log()`；只有日志文件就用 `metrics_import` 加 `follow: true`
> 跟踪；project=`xxx`，run=`yyy`。

工具描述里已经写清参数，一句话足够。不能调用 DSH 工具的 agent 可以走下面的 HTTP API
或直接写 JSONL。

## HTTP API

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| `GET` | `/dsh-metrics/api/state` | — | 所有 run 及指标摘要 |
| `GET` | `/dsh-metrics/api/run` | `?project=&run=` | 单个 run 的完整（降采样）序列 |
| `POST` | `/dsh-metrics/api/log` | `{project, run, points, config?, tags?}` | 追加数据点 |
| `POST` | `/dsh-metrics/api/delete` | `{project, run}` | 删除 run 目录 |
| `GET` | `/dsh-metrics/sdk/dsh_metrics.py` | — | 下载 Python SDK |

> API 依赖监听地址仅本机（默认 `127.0.0.1:3080`），没有额外的 token 校验。
> 如果把 Harness 暴露到网络，请自行在反向代理层加鉴权。

## 数据格式

```
~/.dsh/metrics/<project>/<run>/run.json       # 名称、config、tags、状态、导入游标
~/.dsh/metrics/<project>/<run>/history.jsonl  # 追加写入的数据点
```

每行：

```json
{"t": 1792564685211, "step": 120, "metrics": {"loss": 0.42, "acc": 0.91}}
```

也接受扁平写法 `{"step": 120, "loss": 0.42}`，方便其它语言直接生成。追加使用 O_APPEND，
Python 和 Host 可以同时写。

## 配置

在 profile 的 `cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: dsh-metrics
  name: "@inkwinda/dsh-metrics"
  config:
    maxPoints: 1500      # 每张图返回给浏览器的采样点数
    dataDir: /absolute/path/to/metrics
```

数据目录也可以通过环境变量 `DSH_METRICS_DIR` 指定。

## 开发

没有构建步骤：Host 是纯 ESM，Client 是 Harness 模块加载器直接加载的 `client.js`，
Python 只用标准库。

```bash
git clone https://github.com/inkwindA/dsh-metrics.git
cd dsh-metrics
node --check index.js
node --check client.js
python3 -m py_compile python/dsh_metrics.py
dsh plugin --profile web add "$PWD"
```

目录结构：

```
index.js            Host 插件：工具、日志跟随、HTTP 路由
store.js            run 目录、缓存、降采样、导入游标
import.js           CSV/TSV/JSONL/JSON 解析
http.js             /dsh-metrics API
client.js           侧边栏图标 + 看板页面
python/dsh_metrics.py   零依赖上报脚本
examples/           模拟训练示例 + 示例 CSV
docs/banner.svg     README 头图
```

## 兼容性与说明

- 面向 DSH **web** profile 和 0.2.x 插件 API。
- 页面带渲染错误边界：即使出错也会显示错误卡片，不会白屏。
- 看板只展示你写入的数据，不会伪造曲线。
- 删除 run 需要两次点击确认，会移除对应目录。

## License

[MIT](LICENSE) © 2026 inkwindA
