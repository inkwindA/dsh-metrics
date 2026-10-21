"""Simulated training run for dsh-metrics — no PyTorch, no network, no deps.

From the repository root:

    python3 examples/simulated_training.py

It creates a `demo-sim/cnn-baseline` run with a realistic decaying loss and
rising accuracy. Open the Metrics panel in the DSH Web GUI to watch the full
curve appear while this script runs.

To use it from another project, copy `python/dsh_metrics.py` next to this file
or install it on `PYTHONPATH`.
"""

from __future__ import annotations

import math
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))

import dsh_metrics  # noqa: E402  (path bootstrap above)


def train_step(epoch: int, rng: random.Random) -> tuple[float, float]:
    """Return a plausible (loss, accuracy) pair for one epoch."""
    loss = 2.3 * math.exp(-epoch / 4.5) + 0.06 + rng.gauss(0, 0.02)
    accuracy = 0.99 - 0.86 * math.exp(-epoch / 4.0) + rng.gauss(0, 0.006)
    return max(loss, 0.0), min(max(accuracy, 0.0), 1.0)


def main() -> None:
    rng = random.Random(7)
    run = dsh_metrics.init(
        project="demo-sim",
        name="cnn-baseline",
        config={"lr": 1e-3, "batch_size": 64, "epochs": 20, "optimizer": "adamw"},
        tags=["example", "simulated"],
        description="Simulated run from examples/simulated_training.py",
    )
    print(f"logging to {run.key} ({run.dir})")
    for epoch in range(1, 21):
        loss, accuracy = train_step(epoch, rng)
        val_loss = loss * 1.06 + rng.gauss(0, 0.015)
        val_accuracy = accuracy * 0.97
        run.log(
            {
                "loss": round(loss, 5),
                "acc": round(accuracy, 5),
                "val_loss": round(max(val_loss, 0.0), 5),
                "val_acc": round(max(val_accuracy, 0.0), 5),
                "lr": 1e-3 * (0.95 ** epoch),
            },
            step=epoch,
        )
        print(f"epoch {epoch:02d}  loss={loss:.4f}  acc={accuracy:.4f}")
        time.sleep(0.25)
    run.finish({"best_val_acc": 0.95, "note": "simulated"})
    print("finished. Open the Metrics panel in the DSH Web GUI.")


if __name__ == "__main__":
    main()
