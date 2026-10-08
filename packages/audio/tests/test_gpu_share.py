import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gpu_share import GpuWatch, foreign_compute_pids, is_gpu_program, yield_while_busy, young_gpu_programs  # noqa: E402


class Watch(unittest.TestCase):
    def test_flag_follows_the_probe_and_a_broken_probe_reads_as_free(self):
        state = {"busy": True}
        watch = GpuWatch(probe=lambda: state["busy"], poll_seconds=0.01).start()
        import time
        time.sleep(0.05)
        self.assertTrue(watch.busy)
        state["busy"] = False
        self.assertFalse(watch.probe_now())
        self.assertFalse(watch.busy)

        def broken():
            raise RuntimeError("nvidia-smi exploded")

        broken_watch = GpuWatch(probe=broken, poll_seconds=0.01).start()
        time.sleep(0.05)
        self.assertFalse(broken_watch.busy)
        watch.stop()
        broken_watch.stop()


class ForeignPids(unittest.TestCase):
    def test_parses_csv_and_excludes_self(self):
        csv = "1234, 4210\n5678, 1200\n"
        self.assertEqual(foreign_compute_pids(csv, self_pid=5678), [1234])

    def test_empty_output_means_nobody(self):
        self.assertEqual(foreign_compute_pids("", self_pid=1), [])
        self.assertEqual(foreign_compute_pids("\n", self_pid=1), [])

    def test_ignores_malformed_lines(self):
        csv = "No running processes found\n[N/A], 0\n42, 100\n"
        self.assertEqual(foreign_compute_pids(csv, self_pid=1), [42])


class YieldWhileBusy(unittest.TestCase):
    def test_free_card_costs_nothing(self):
        calls = []
        waited = yield_while_busy(lambda: calls.append("off"), lambda: calls.append("on"), lambda m: calls.append(m), busy=lambda: False)
        self.assertEqual(waited, 0.0)
        self.assertEqual(calls, [])

    def test_offloads_waits_then_restores(self):
        calls = []
        states = iter([True, True, False])
        slept = []
        yield_while_busy(
            lambda: calls.append("off"),
            lambda: calls.append("on"),
            lambda m: calls.append("log"),
            poll_seconds=7,
            busy=lambda: next(states),
            sleep=slept.append,
        )
        self.assertEqual(calls, ["off", "log", "on", "log"])
        self.assertEqual(slept, [7])


if __name__ == "__main__":
    unittest.main()


class GpuProgramMatch(unittest.TestCase):
    def test_only_an_interpreter_running_main_py_counts(self):
        self.assertTrue(is_gpu_program(["python3", "/home/x/ComfyUI/main.py", "--listen"]))
        self.assertTrue(is_gpu_program(["/opt/venv/bin/python", "main.py"]) is False)  # bare name, no ComfyUI path
        self.assertTrue(is_gpu_program(["/opt/venv/bin/python3.12", "/srv/comfyui/main.py"]))
        # a shell, grep or tail that merely mentions the program is not the program
        self.assertFalse(is_gpu_program(["/bin/bash", "-c", "pgrep -f ComfyUI/main.py"]))
        self.assertFalse(is_gpu_program(["grep", "ComfyUI/main.py", "notes.md"]))
        self.assertFalse(is_gpu_program(["tail", "-f", "/home/x/ComfyUI/main.py.log"]))
        self.assertFalse(is_gpu_program([]))

    def test_young_programs_read_from_a_scratch_proc(self):
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as proc:
            for pid, argv in ((4242, ["python3", "/x/ComfyUI/main.py"]), (4343, ["bash", "-c", "ComfyUI/main.py"])):
                os.makedirs(os.path.join(proc, str(pid)))
                with open(os.path.join(proc, str(pid), "cmdline"), "wb") as f:
                    f.write(b"\0".join(a.encode() for a in argv) + b"\0")
            os.makedirs(os.path.join(proc, "not-a-pid"))
            found = young_gpu_programs(grace_seconds=1e9, proc=proc)
            # a scratch /proc has no stat file, so the age is unknown and the process counts
            self.assertEqual([pid for pid, _ in found], [4242])


class ReasonInLog(unittest.TestCase):
    def test_step_aside_line_names_the_reason(self):
        lines = []
        states = iter([True, False])
        yield_while_busy(lambda: None, lambda: None, lines.append, poll_seconds=0,
                         busy=lambda: next(states), sleep=lambda s: None, reason=lambda: "pid 7 on the card")
        self.assertIn("pid 7 on the card", lines[0])
