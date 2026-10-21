"""Log training metrics to the local DSH Metrics dashboard.

A tiny, dependency-free W&B-style logger. It appends JSON lines to the store
that the ``Metrics`` panel in the DeepSeek Harness web sidebar reads, so curves
appear online while training is still running::

    import dsh_metrics

    run = dsh_metrics.init(
        project="mnist",
        name="baseline",
        config={"lr": 1e-3, "batch_size": 64},
        tags=["cnn"],
    )
    for step, (loss, acc) in enumerate(zip(losses, accs)):
        run.log({"loss": loss, "train/acc": acc}, step=step)
    run.finish()

The store root defaults to ``$DSH_METRICS_DIR``, then ``$DSH_HOME/metrics``,
then ``~/.dsh/metrics``. Set ``DSH_METRICS_DIR`` to share a different folder.
The file is also downloadable from a running Harness at
``/dsh-metrics/sdk/dsh_metrics.py``.

Format (one directory per run)::

    <root>/<project>/<run>/run.json       metadata and config
    <root>/<project>/<run>/history.jsonl  append-only points

Nothing here blocks for long and no third-party package is required, so it is
safe to call from a training loop.
"""

from __future__ import annotations

import json
import math
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Iterable, Mapping

__all__ = ["Run", "init", "log", "finish", "current_run", "data_dir"]
__version__ = "1.0.0"

_HISTORY = "history.jsonl"
_META = "run.json"
_ID_LIMIT = 80


def data_dir() -> Path:
    """Return the store root currently in effect."""
    explicit = os.environ.get("DSH_METRICS_DIR", "").strip()
    if explicit:
        return Path(explicit).expanduser()
    home = os.environ.get("DSH_HOME", "").strip()
    base = Path(home).expanduser() if home else Path.home() / ".dsh"
    return base / "metrics"


def _slug(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    text = "".join("-" if ch in "/\\" or ord(ch) < 32 else ch for ch in text)
    text = re.sub(r"\s+", "-", text).strip(".-")[:_ID_LIMIT]
    return text or fallback


def _finite(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    return str(value)


def _atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


class Run:
    """One run directory. Construction creates the run; :meth:`log` appends points."""

    def __init__(
        self,
        project: str,
        name: str | None = None,
        config: Mapping[str, Any] | None = None,
        tags: Iterable[str] | None = None,
        description: str = "",
        resume: bool = False,
        root: str | os.PathLike[str] | None = None,
    ) -> None:
        if not str(project or "").strip():
            raise ValueError("project must be a non-empty string")
        self.project = _slug(project, "project")
        self.name = str(name or f"run-{time.strftime('%Y%m%d-%H%M%S')}")
        base = _slug(self.name, "run")
        store = Path(root).expanduser() if root is not None else data_dir()
        project_dir = store / self.project
        project_dir.mkdir(parents=True, exist_ok=True)

        run_dir = None
        if resume:
            run_dir = self._latest_unfinished(project_dir, self.name)
        if run_dir is None:
            candidate = project_dir / base
            if not candidate.exists():
                run_dir = candidate
            else:
                counter = 2
                while True:
                    candidate = project_dir / f"{base}-{counter}"
                    if not candidate.exists():
                        run_dir = candidate
                        break
                    counter += 1

        self.dir = run_dir
        self.dir.mkdir(parents=True, exist_ok=True)
        self._meta_path = self.dir / _META
        self._history_path = self.dir / _HISTORY
        self._lock = threading.Lock()
        self._closed = False
        self._step = self._last_step()
        self._started = time.time()
        self.config = {str(key): _jsonable(value) for key, value in (config or {}).items()}
        self.tags = [str(tag) for tag in (tags or [])]
        self.description = description
        meta = self._read_meta()
        meta.update(
            {
                "version": 1,
                "id": self.dir.name,
                "project": self.project,
                "name": self.name,
                "status": "running",
                "description": description or meta.get("description", ""),
                "config": {**meta.get("config", {}), **self.config},
                "tags": sorted({*meta.get("tags", []), *self.tags}),
            }
        )
        meta.setdefault("created", int(time.time() * 1000))
        meta.pop("finished", None)
        _atomic_json(self._meta_path, meta)

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _latest_unfinished(project_dir: Path, name: str) -> Path | None:
        best = None
        best_time = -1.0
        for entry in project_dir.iterdir():
            if not entry.is_dir():
                continue
            meta_path = entry / _META
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if meta.get("name") != name or meta.get("status") == "finished":
                continue
            try:
                stamp = meta_path.stat().st_mtime
            except OSError:
                stamp = 0.0
            if stamp > best_time:
                best, best_time = entry, stamp
        return best

    def _read_meta(self) -> dict[str, Any]:
        try:
            value = json.loads(self._meta_path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            return {}

    def _last_step(self) -> int:
        if not self._history_path.exists():
            return -1
        try:
            with open(self._history_path, "rb") as handle:
                handle.seek(0, os.SEEK_END)
                size = handle.tell()
                handle.seek(max(0, size - 65536))
                tail = handle.read().decode("utf-8", errors="replace")
        except OSError:
            return -1
        for line in reversed(tail.splitlines()):
            try:
                record = json.loads(line)
            except ValueError:
                continue
            step = _finite(record.get("step"))
            if step is not None:
                return int(step) if float(step).is_integer() else step  # type: ignore[return-value]
        return -1

    # -- public API --------------------------------------------------------

    def log(
        self,
        metrics: Mapping[str, Any] | None = None,
        step: int | float | None = None,
        **kwargs: Any,
    ) -> "Run":
        """Append one point.

        ``metrics`` may contain any numeric values, including nested names such
        as ``"train/loss"``. Keyword arguments are merged on top, so
        ``run.log(loss=0.3, step=4)`` works as well. Non-finite values are
        skipped instead of written as invalid JSON.
        """
        values: dict[str, float] = {}
        if metrics is not None:
            if not isinstance(metrics, Mapping):
                raise TypeError("metrics must be a mapping of name -> number")
            for key, value in metrics.items():
                number = _finite(value)
                if number is not None:
                    values[str(key)] = number
        for key, value in kwargs.items():
            number = _finite(value)
            if number is not None:
                values[str(key)] = number
        if not values:
            return self
        with self._lock:
            if self._closed:
                raise RuntimeError("run is finished; call init() to start a new run")
            if step is None:
                self._step = self._step + 1
                chosen = self._step
            else:
                number = _finite(step)
                if number is None:
                    raise ValueError("step must be a finite number")
                chosen = int(number) if float(number).is_integer() else number
                self._step = chosen
            record = {"t": int(time.time() * 1000), "step": chosen, "metrics": values}
            with self._history_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
                handle.flush()
                os.fsync(handle.fileno())
        return self

    def finish(self, summary: Mapping[str, Any] | None = None) -> None:
        """Mark the run finished so the dashboard shows it as completed."""
        with self._lock:
            if self._closed:
                return
            meta = self._read_meta()
            meta["status"] = "finished"
            meta["finished"] = int(time.time() * 1000)
            meta["duration_seconds"] = round(time.time() - self._started, 3)
            if summary is not None:
                meta["summary"] = _jsonable(summary)
            _atomic_json(self._meta_path, meta)
            self._closed = True

    @property
    def id(self) -> str:
        return self.dir.name

    @property
    def key(self) -> str:
        return f"{self.project}/{self.dir.name}"

    def __enter__(self) -> "Run":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.finish()

    def __repr__(self) -> str:
        return f"<dsh_metrics.Run {self.key}>"


_default: Run | None = None


def init(**kwargs: Any) -> Run:
    """Create (or resume) a run and make it the module-level default."""
    global _default
    run = Run(**kwargs)
    _default = run
    return run


def current_run() -> Run | None:
    """Return the run created by the last :func:`init`, if any."""
    return _default


def log(metrics: Mapping[str, Any] | None = None, step: int | float | None = None, **kwargs: Any) -> Run:
    """Log to the run created by :func:`init`."""
    if _default is None:
        raise RuntimeError("dsh_metrics.log() needs dsh_metrics.init(project=..., name=...) first")
    return _default.log(metrics, step=step, **kwargs)


def finish(summary: Mapping[str, Any] | None = None) -> None:
    """Finish the run created by :func:`init`."""
    global _default
    if _default is not None:
        _default.finish(summary)
        _default = None
