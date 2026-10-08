"""
Share one GPU with other jobs on this PC without anyone sending messages.

The GTX 980 Ti has 6 GB; an image-generation job fills most of it, so the aligner must not merely
be polite, it must be absent while anyone else is on the card, and absent quickly: the other
job's first step allocates 4–5 GB and fails outright if the memory is not there. So:

- A watchdog thread polls every few seconds for (a) any compute process on the card other than
  this one, via `nvidia-smi`, and (b) a Python process running ComfyUI's main.py that started in
  the last three minutes, read from /proc, which catches the seconds between that program
  starting and its first allocation. Only a real interpreter counts, never a shell or grep whose
  command line mentions the name, and only while young: an idle server that has released the
  card is not a reason to wait, and nvidia-smi is the authority once it is up.
- The aligner checks the watchdog's flag between audio chunks (a chunk is a few seconds of
  compute), not only between windows. When the flag is up it moves its model to the CPU,
  releases its cached VRAM, and sleeps, polling until the card is clear; then it moves the model
  back and continues. Chapter state on disk makes any stop resumable, so waiting loses nothing.

`nvidia-smi` missing or failing, or /proc unreadable, means "cannot tell": the aligner proceeds, which is
right on a CPU-only machine and the only safe answer when a tool is broken.
"""
from __future__ import annotations

import os
import subprocess
import threading
import time
from collections.abc import Callable

QUERY = ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"]
OTHER_GPU_PROGRAMS = ("comfyui/main.py",)
STARTUP_GRACE_SECONDS = 180.0  # how long a freshly started GPU program is trusted to be about to allocate


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


def gpu_held_by_others(self_pid: int | None = None) -> list[int]:
    """Other processes on the card according to nvidia-smi; empty when none or when it cannot tell."""
    try:
        out = subprocess.run(QUERY, capture_output=True, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return []
    if out.returncode != 0:
        return []
    return foreign_compute_pids(out.stdout, self_pid if self_pid is not None else os.getpid())


def is_gpu_program(argv: list[str], names: tuple[str, ...] = OTHER_GPU_PROGRAMS) -> bool:
    """
    True for an interpreter actually running one of the named programs: argv[0] is a Python and
    some argument ends with the program's path. A shell, grep, tail or editor whose command line
    merely mentions the name is not one; `pgrep -f ComfyUI` matched all of those (on 2026-10-08
    it parked the aligner on a terminal command that contained the word) and so is not used.
    """
    if not argv:
        return False
    if "python" not in os.path.basename(argv[0]).lower():
        return False
    return any(arg.lower().replace("\\", "/").endswith(name) for arg in argv[1:] for name in names)


def _clock_ticks() -> float:
    try:
        return float(os.sysconf("SC_CLK_TCK"))
    except (ValueError, OSError, AttributeError):
        return 100.0


def _process_age_seconds(pid: int) -> float | None:
    """Seconds since the process started, from /proc; None when it cannot be read."""
    try:
        with open(f"/proc/{pid}/stat") as f:
            stat = f.read()
        with open("/proc/uptime") as f:
            uptime = float(f.read().split()[0])
    except OSError:
        return None
    # field 22 (1-based) is starttime in clock ticks; the comm field may contain spaces, so split after ')'
    fields = stat[stat.rindex(")") + 2 :].split()
    starttime = int(fields[19]) / _clock_ticks()
    return uptime - starttime


def young_gpu_programs(
    names: tuple[str, ...] = OTHER_GPU_PROGRAMS, grace_seconds: float = STARTUP_GRACE_SECONDS, proc: str = "/proc"
) -> list[tuple[int, float]]:
    """
    (pid, age) of named GPU programs started within `grace_seconds`. Only the start-up window
    matters: once a program has been up longer than that, nvidia-smi says whether it holds the
    card, and a resident but idle server must not park the aligner forever.
    """
    found: list[tuple[int, float]] = []
    try:
        entries = os.listdir(proc)
    except OSError:
        return found
    for entry in entries:
        if not entry.isdigit() or int(entry) == os.getpid():
            continue
        try:
            with open(os.path.join(proc, entry, "cmdline"), "rb") as f:
                argv = [a.decode("utf-8", "replace") for a in f.read().split(b"\0") if a]
        except OSError:
            continue
        if not is_gpu_program(argv, names):
            continue
        age = _process_age_seconds(int(entry))
        if age is None or age <= grace_seconds:
            found.append((int(entry), age if age is not None else 0.0))
    return found


def busy_reason() -> str | None:
    """Why the card counts as taken, in one line, or None when it is free."""
    pids = gpu_held_by_others()
    if pids:
        return "nvidia-smi reports other compute processes: " + ", ".join(str(p) for p in pids)
    young = young_gpu_programs()
    if young:
        return "a GPU program just started (pid, seconds ago): " + ", ".join(f"{p} ({a:.0f}s)" for p, a in young)
    return None


def card_is_busy() -> bool:
    return busy_reason() is not None


class GpuWatch:
    """A daemon thread that keeps `busy` current; reading it costs nothing on the hot path."""

    def __init__(self, probe: Callable[[], bool] = card_is_busy, poll_seconds: float = 5.0,
                 reason: Callable[[], str | None] = busy_reason):
        self.probe = probe
        self.reason = reason
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
    reason: Callable[[], str | None] = busy_reason,
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
    try:
        why = reason() or "reason unknown"
    except Exception:
        why = "reason unknown"
    log(f"    GPU wanted by another process ({why}); stepped aside until it is free")
    while busy():
        sleep(poll_seconds)
    restore()
    waited = time.monotonic() - started
    log(f"    GPU free again after {waited/60:.1f} min; resuming")
    return waited
