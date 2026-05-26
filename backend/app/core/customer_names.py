from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
def _normalize_name_part(value: str | None) -> str:
    text = str(value or "").strip()
    if text in {"-", "_", "—"}:
        return ""
    return text


def compose_customer_name(
    first_name: str | None,
    last_name: str | None = None,
    fallback: str = "عميل",
) -> str:
    parts = [_normalize_name_part(first_name), _normalize_name_part(last_name)]
    return " ".join(part for part in parts if part).strip() or fallback



