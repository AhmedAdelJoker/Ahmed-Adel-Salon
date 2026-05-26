from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from threading import Lock
from typing import Any


_RUNTIME_SETTINGS_LOCK = Lock()
_RUNTIME_SETTINGS_PATH = (
    Path(__file__).resolve().parents[2] / "runtime_data" / "runtime_settings.json"
)


def _ensure_runtime_settings_file() -> None:
    _RUNTIME_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _RUNTIME_SETTINGS_PATH.exists():
        _RUNTIME_SETTINGS_PATH.write_text("{}", encoding="utf-8")


def _read_all_settings() -> dict[str, Any]:
    _ensure_runtime_settings_file()
    try:
        raw = _RUNTIME_SETTINGS_PATH.read_text(encoding="utf-8").strip() or "{}"
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def get_runtime_settings(namespace: str, defaults: dict[str, Any]) -> dict[str, Any]:
    with _RUNTIME_SETTINGS_LOCK:
        data = _read_all_settings()
        stored = data.get(namespace, {})
        if not isinstance(stored, dict):
            stored = {}
        return {**defaults, **stored}


def update_runtime_settings(
    namespace: str,
    payload: dict[str, Any],
    defaults: dict[str, Any],
) -> dict[str, Any]:
    with _RUNTIME_SETTINGS_LOCK:
        data = _read_all_settings()
        current = data.get(namespace, {})
        if not isinstance(current, dict):
            current = {}

        merged = {**defaults, **current, **payload}
        data[namespace] = merged

        _ensure_runtime_settings_file()
        _RUNTIME_SETTINGS_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return merged



