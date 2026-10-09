import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build import envelope  # the min/max logic at build.py:694-703, extracted into a function
POS = [
    {"tradition": "critical", "earliest": -1279, "latest": -1213, "dates": "event"},
    {"tradition": "critical", "earliest": -650, "latest": -550, "dates": "composition"},
    {"tradition": "traditional", "earliest": -1450, "latest": -1440, "dates": "event"},
]
class Envelope(unittest.TestCase):
    def test_composition_positions_do_not_widen_the_event_envelope(self):
        e = envelope(POS)
        self.assertEqual((e["earliest"], e["latest"]), (-1279, -1213))
        self.assertEqual((e["trad_earliest"], e["trad_latest"]), (-1450, -1440))
    def test_an_event_with_only_composition_positions_has_no_envelope(self):
        self.assertIsNone(envelope([POS[1]])["earliest"])
