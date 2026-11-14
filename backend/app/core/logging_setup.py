"""Structured logging: one JSON-ish line per event plus a request id.

Two problems this solves:

* ``print()`` in request handlers writes to stdout with no timestamp, no level
  and no correlation id, so a failure can't be tied back to the request that
  caused it.
* A 500 logged with ``exc_info`` but no request id is close to useless when four
  requests are in flight.

Every request gets an id (honouring an inbound ``X-Request-ID`` so a gateway can
propagate it), and it is stashed in a :class:`contextvars.ContextVar` so any
``logger.*`` call made deeper in the stack picks it up automatically.
"""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
_request_path: ContextVar[str] = ContextVar("request_path", default="-")


def current_request_id() -> str:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        record.request_path = _request_path.get()
        return True


class JsonFormatter(logging.Formatter):
    """One compact JSON object per line, so log shipping never has to guess."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        path = getattr(record, "request_path", "-")
        if path and path != "-":
            payload["path"] = path
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key, value in getattr(record, "extra_fields", {}).items():
            payload[key] = value
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO", json_output: bool | None = None) -> None:
    """Install a single stdout handler with the request-id filter attached."""
    import os

    if json_output is None:
        json_output = os.getenv("LOG_FORMAT", "").lower() == "json"

    root = logging.getLogger()
    root.setLevel(level.upper())

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    if json_output:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    root.addHandler(handler)

    # uvicorn installs its own handlers; route them through ours so the request
    # id shows up on access lines too.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv = logging.getLogger(name)
        uv.handlers = []
        uv.propagate = True
    logging.getLogger("uvicorn.access").addFilter(RequestIdFilter())

    # SQLAlchemy echoing every statement drowns everything else.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def bind_request(request_id: str, path: str):
    _request_id.set(request_id)
    _request_path.set(path)
    return request_id


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


def access_logger() -> logging.Logger:
    return logging.getLogger("app.access")
