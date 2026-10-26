"""The phone-app API: key check, snapshot, and actions run by the main loop."""
import json
import socket
import sys
import threading
import time
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nelson.api import AppServer
from test_live import TestLiveLoop

KEY = "k" * 32


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class TestAppApi(TestLiveLoop):
    # reuse the fake-broker setup only, not the live-loop tests themselves
    test_places_order_then_manages_position = None
    test_real_account_is_never_traded_without_permission = None
    test_tier1_news_flattens = None

    def setUp(self):
        super().setUp()
        self.port = free_port()
        self.bot, self.fake = self._bot()
        self.bot.app = AppServer("127.0.0.1", self.port, KEY)
        self.bot.app.start()
        self._run_until(self.bot, self.fake, self.i + 4)      # places one order
        self.stop = threading.Event()

        def loop():
            while not self.stop.is_set():
                self.bot.step()
                time.sleep(0.05)
        self.thread = threading.Thread(target=loop, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.stop.set()
        self.thread.join(5)
        self.bot.app.stop()
        super().tearDown()

    def call(self, path, body=None, key=KEY):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/{path}",
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"Authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_wrong_key_rejected(self):
        self.assertEqual(self.call("ping", key="nope")[0], 401)
        self.assertEqual(self.call("ping")[0], 200)

    def test_snapshot(self):
        code, s = self.call("snapshot")
        self.assertEqual(code, 200)
        self.assertTrue(s["ready"])
        self.assertEqual(s["symbol"], "XAUUSD")
        self.assertEqual(len(s["orders"]), 1)
        self.assertEqual(s["orders"][0]["side"], "SELL")
        self.assertEqual(len(s["chart"]), 120)
        self.assertIn(s["analysis"]["trend"], (-1, 0, 1))
        self.assertTrue(any(r["event"] == "order" for r in s["journal"]))

    def test_actions(self):
        self.assertTrue(self.call("pause", {})[1]["ok"])
        self.assertTrue(self.bot.paused)
        self.assertFalse(self.call("risk", {"value": 9})[1]["ok"])
        self.assertTrue(self.call("risk", {"value": 0.25})[1]["ok"])
        self.assertEqual(self.bot.cfg.risk.risk_per_trade_pct, 0.25)
        code, res = self.call("close-all", {})
        self.assertEqual(code, 400)                      # needs explicit confirmation
        self.assertEqual(len(self.fake.orders_), 1)
        code, res = self.call("close-all", {"confirm": "CLOSE"})
        self.assertTrue(res["ok"])
        self.assertEqual(self.fake.orders_, [])

    def test_short_key_refused(self):
        with self.assertRaises(ValueError):
            AppServer("127.0.0.1", 0, "short")


if __name__ == "__main__":
    unittest.main()
