"""Status vocabulary for packages/timeline/build.py. Contract: build.py defines
STATUSES = {"draft", "sources-located", "claims-checked", "expert-reviewed"} and reports anything
else as "unknown status '<value>'". Stdlib unittest only."""
import unittest

from test_build import BuildCase, mutate, valid_files


class StatusVocabulary(BuildCase):
    def test_unknown_status_is_reported_with_its_value(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'status = "draft"', 'status = "reviewed"')
        r = self.build(f)
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("unknown status 'reviewed'", r.stderr)
        self.assertIn("ev-narr.toml", r.stderr)

    def test_claims_checked_status_builds_without_errors(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'status = "draft"', 'status = "claims-checked"')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT status FROM events WHERE event_id='ev-narr'"),
                         [("claims-checked",)])


if __name__ == "__main__":
    unittest.main()
