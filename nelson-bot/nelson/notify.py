"""Phone notifications through ntfy (https://ntfy.sh), free and with no account.

Nelson posts each alert to a private, randomly named ntfy topic. The ntfy app
on the phone subscribes to that topic (one tap from the Nelson app) and shows
the alerts instantly, even when the Nelson app is closed. Tapping an alert
opens the Nelson app on its Signals page.
"""
from __future__ import annotations

import logging
import queue
import threading

log = logging.getLogger("nelson.notify")
CLICK_URL = "nelsongold://signals"


def _ascii(text: str) -> str:
    # HTTP header values must be plain ASCII
    return text.encode("ascii", "replace").decode("ascii").replace("?", "-") if text else text


class Pusher:
    def __init__(self, server: str, topic: str, prefix: str = ""):
        self.url = f"{server.rstrip('/')}/{topic}"
        self.prefix = prefix
        self._q: queue.Queue = queue.Queue(maxsize=200)
        threading.Thread(target=self._worker, name="nelson-notify", daemon=True).start()

    def push(self, title: str, message: str, priority: int = 3, tags: tuple[str, ...] = ()) -> None:
        """Queues an alert; never blocks or raises (trading must not wait on a notification)."""
        try:
            self._q.put_nowait((self.prefix + title, message, priority, tags))
        except queue.Full:
            log.warning("Notification queue full - dropped: %s", title)

    def _worker(self) -> None:
        import requests
        session = requests.Session()
        while True:
            title, message, priority, tags = self._q.get()
            headers = {"Title": _ascii(title), "Priority": str(priority), "Click": CLICK_URL}
            if tags:
                headers["Tags"] = ",".join(tags)
            try:
                r = session.post(self.url, data=message.encode("utf-8"), headers=headers, timeout=20)
                r.raise_for_status()
            except Exception as exc:
                log.warning("Notification not sent (%s): %s", exc, title)
