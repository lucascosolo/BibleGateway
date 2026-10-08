import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gpu_share import GpuWatch, foreign_compute_pids, yield_while_busy  # noqa: E402


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
