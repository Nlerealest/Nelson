"""Control Nelson from your phone through a private Telegram bot.

A background thread long-polls Telegram for messages and queues the commands.
The main loop runs them (MetaTrader 5 must only be called from one thread).
Messages from any chat not listed in telegram.chat_ids are ignored.
"""
from __future__ import annotations

import logging
import queue
import threading
import time

import requests

log = logging.getLogger("nelson.telegram")
API = "https://api.telegram.org/bot{token}/{method}"

HELP = """Nelson - XAUUSD bot commands
/status - account, open trades, today's result
/brief - Nelson's read of gold right now
/news - high-impact USD news coming up
/journal - last 10 events from the journal
/missed - what Nelson missed while it was off
/lessons - the latest lessons from losses
/pause - stop opening new trades (open trades are still managed)
/resume - allow new trades again
/closeall - close every Nelson trade and cancel orders
/risk 0.5 - set risk per trade in %
/help - this list"""


class TelegramLink:
    def __init__(self, token: str, chat_ids: list[int]):
        self.token = token
        self.chat_ids = {int(c) for c in chat_ids}
        self.commands: queue.Queue[tuple[int, str]] = queue.Queue()
        self._offset = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._session = requests.Session()

    def _call(self, method: str, timeout: float = 20, **params):
        r = self._session.post(API.format(token=self.token, method=method), json=params, timeout=timeout)
        r.raise_for_status()
        return r.json().get("result")

    # ---------- outgoing
    def send(self, text: str, chat_id: int | None = None) -> None:
        """Sends to one chat, or to every allowed chat. Never raises: trading must not stop over a message."""
        for cid in ([chat_id] if chat_id else self.chat_ids):
            for chunk in [text[i:i + 3900] for i in range(0, len(text), 3900)] or [""]:
                try:
                    self._call("sendMessage", chat_id=cid, text=chunk, disable_web_page_preview=True)
                except Exception as exc:
                    log.warning("Telegram send failed: %s", exc)

    # ---------- incoming
    def start(self) -> None:
        try:   # skip messages sent while Nelson was off, so old commands are not replayed
            pending = self._call("getUpdates", offset=-1, timeout=10) or []
            if pending:
                self._offset = pending[-1]["update_id"] + 1
        except Exception as exc:
            log.warning("Telegram not reachable yet: %s", exc)
        self._thread = threading.Thread(target=self._poll, name="telegram", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _poll(self) -> None:
        while not self._stop.is_set():
            try:
                for u in self._get_updates() or []:
                    self._offset = u["update_id"] + 1
                    msg = u.get("message") or {}
                    cid = (msg.get("chat") or {}).get("id")
                    text = (msg.get("text") or "").strip()
                    if not text:
                        continue
                    if cid not in self.chat_ids:
                        log.warning("Ignored Telegram message from unknown chat %s", cid)
                        continue
                    self.commands.put((cid, text))
            except Exception as exc:
                log.warning("Telegram polling error: %s", exc)
                time.sleep(10)

    def _get_updates(self):
        # Telegram's long-poll parameter is called "timeout" too, so build the request by hand
        r = self._session.post(API.format(token=self.token, method="getUpdates"),
                               json={"offset": self._offset, "timeout": 30, "allowed_updates": ["message"]},
                               timeout=40)
        r.raise_for_status()
        return r.json().get("result")

    def pending_commands(self) -> list[tuple[int, str]]:
        out = []
        while True:
            try:
                out.append(self.commands.get_nowait())
            except queue.Empty:
                return out


def find_chat_ids(token: str) -> list[tuple[int, str]]:
    """Chats that have messaged the bot recently: used once during setup to learn your chat id."""
    r = requests.get(API.format(token=token, method="getUpdates"), timeout=20)
    r.raise_for_status()
    seen = {}
    for u in r.json().get("result", []):
        chat = (u.get("message") or {}).get("chat") or {}
        if "id" in chat:
            seen[chat["id"]] = chat.get("username") or chat.get("first_name") or ""
    return list(seen.items())
