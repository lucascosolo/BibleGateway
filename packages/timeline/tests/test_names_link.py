"""A `names` verse link: a book-level link meaning "this source names or lists the book"."""
import unittest

from test_build import BuildCase, mutate, valid_files
from test_works import PATH, files_with


class NamesLink(BuildCase):
    def test_event_verses_accept_names(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'link = "dates"', 'link = "names"')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(
            self.query("SELECT COUNT(*) FROM verse_links WHERE subject_kind='event' "
                       "AND subject_id='ev-narr' AND link_type='names'"), [(1,)])

    def test_work_verses_accept_names(self):
        f = files_with()
        mutate(f, PATH, 'link = "alludes"', 'link = "names"')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT link_type FROM work_verses"), [("names",)])

    def test_unknown_link_type_still_rejected(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'link = "dates"', 'link = "mentions"')
        r = self.build(f)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("mentions", r.stderr + r.stdout)


if __name__ == "__main__":
    unittest.main()
