"""
Share one GPU with other jobs on this PC without anyone sending messages.

The GTX 980 Ti has 6 GB; an image-generation job fills most of it, so the aligner must not merely
be polite, it must be absent while anyone else is on the card, and absent quickly: the other
job's first step allocates 4–5 GB and fails outright if the memory is not there. So:

- A watchdog thread polls every few seconds for (a) any compute process on the card other than
  this one, via `nvidia-smi`, and (b) a ComfyUI process that exists at all, via `pgrep`, which
  catches the seconds between that program starting and its first allocation.
- The aligner checks the watchdog's flag between audio chunks (a chunk is a few seconds of
  compute), not only between windows. When the flag is up it moves its model to the CPU,
  releases its cached VRAM, and sleeps, polling until the card is clear; then it moves the model
  back and continues. Chapter state on disk makes any stop resumable, so waiting loses nothing.

`nvidia-smi` or `pgrep` missing or failing means "cannot tell": the aligner proceeds, which is
right on a CPU-only machine and the only safe answer when a tool is broken.
"""
from __future__ import annotations

import os
import subprocess
import threading
import time
from collections.abc import Callable

QUERY = ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"]
OTHER_GPU_PROGRAMS = ("ComfyUI", "comfyui")


def foreign_compute_pids(nvidia_smi_csv: str, self_pid: int) -> list[int]:
    """PIDs of compute processes on the GPU other than `self_pid`, from nvidia-smi's CSV lines."""
    pids: list[int] = []
    for line in nvidia_smi_csv.splitlines():
        cells = [c.strip() for c in line.split(",")]
        if not cells or not cells[0].isdigit():
            continue
        pid = int(cells[0])
        if pid != self_pid:
            pids.append(pid)
    return pids


def gpu_held_by_others(self_pid: int | None = None) -> bool:
    """True only when nvidia-smi reports another process on the card; False when it cannot tell."""
    try:
        out = subprocess.run(QUERY, capture_output=True, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return False
    if out.returncode != 0:
        return False
    return bool(foreign_compute_pids(out.stdout, self_pid if self_pid is not None else os.getpid()))


def other_gpu_program_running(names: tuple[str, ...] = OTHER_GPU_PROGRAMS) -> bool:
    """True when a known GPU-hungry program is running at all, allocated or not."""
    for name in names:
        try:
            out = subprocess.run(["pgrep", "-f", name], capture_output=True, text=True, timeout=10, check=False)
        except (OSError, subprocess.TimeoutExpired):
            return False
        if out.returncode == 0 and out.stdout.strip():
            return True
    return False


def card_is_busy() -> bool:
    return gpu_held_by_others() or other_gpu_program_running()


class GpuWatch:
    """A daemon thread that keeps `busy` current; reading it costs nothing on the hot path."""

    def __init__(self, probe: Callable[[], bool] = card_is_busy, poll_seconds: float = 5.0):
        self.probe = probe
        self.poll_seconds = poll_seconds
        self._busy = threading.Event()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="gpu-watch", daemon=True)

    def start(self) -> "GpuWatch":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                busy = self.probe()
            except Exception:  # a broken probe must never take the aligner down
                busy = False
            (self._busy.set if busy else self._busy.clear)()
            self._stop.wait(self.poll_seconds)

    @property
    def busy(self) -> bool:
        return self._busy.is_set()

    def probe_now(self) -> bool:
        """A fresh read, for the wait loop, so resuming does not lag a poll interval behind."""
        try:
            busy = self.probe()
        except Exception:
            busy = False
        (self._busy.set if busy else self._busy.clear)()
        return busy


def yield_while_busy(
    offload: Callable[[], None],
    restore: Callable[[], None],
    log: Callable[[str], None],
    poll_seconds: float = 10.0,
    busy: Callable[[], bool] = card_is_busy,
    sleep: Callable[[float], None] = time.sleep,
) -> float:
    """
    If the GPU is held by someone else, call `offload()`, wait until it is free, call `restore()`.
    Returns the seconds spent waiting (0 when the card was free). Pure in its collaborators so it
    can be tested without a GPU.
    """
    if not busy():
        return 0.0
    started = time.monotonic()
    offload()
    log("    GPU wanted by another process; stepped aside until it is free")
    while busy():
        sleep(poll_seconds)
    restore()
    waited = time.monotonic() - started
    log(f"    GPU free again after {waited/60:.1f} min; resuming")
    return waited
