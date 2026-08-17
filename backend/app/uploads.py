"""CSV / Excel アップロードの読み込み・正規化処理。"""
import io
from datetime import datetime, timezone
from typing import List, Dict, Any

import pandas as pd

from .geocode import resolve_from_address, normalize_prefecture

INFLUENCER_COLUMNS = {
    "name", "instagram_url", "followers", "category", "age", "gender",
    "prefecture", "address", "latitude", "longitude",
}
SALON_COLUMNS = {
    "name", "address", "station", "line", "category", "instagram",
    "latitude", "longitude", "price_range", "business_hours",
    "is_premium", "model_recruit_experience", "google_map_url",
}


def _read_table(content: bytes, filename: str) -> pd.DataFrame:
    lower = filename.lower()
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content))
    else:
        df = pd.read_csv(io.BytesIO(content))
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df.where(pd.notnull(df), None)


def _to_int(value) -> Any:
    if value is None or value == "" or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _to_float(value) -> Any:
    if value is None or value == "" or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _clean(value) -> Any:
    """文字列カラム用。pandasのNaN(float)をNoneに正規化する。"""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    return value


def parse_influencer_rows(content: bytes, filename: str) -> List[Dict[str, Any]]:
    df = _read_table(content, filename)
    rows = []
    for _, r in df.iterrows():
        name = _clean(r.get("name"))
        if not name:
            continue
        prefecture = normalize_prefecture(_clean(r.get("prefecture")))
        address = _clean(r.get("address"))
        lat, lon = _to_float(r.get("latitude")), _to_float(r.get("longitude"))
        precision = "exact"
        if lat is None or lon is None:
            lat, lon, precision = resolve_from_address(prefecture, address, seed_key=str(name))
        rows.append({
            "name": str(name).strip(),
            "instagram_url": _clean(r.get("instagram_url")),
            "followers": _to_int(r.get("followers")),
            "category": _clean(r.get("category")),
            "age": _to_int(r.get("age")),
            "gender": _clean(r.get("gender")),
            "prefecture": prefecture or "不明",
            "address": address,
            "city": _clean(r.get("city")) or "",
            "latitude": lat,
            "longitude": lon,
            "location_precision": precision,
            "source": "csv_upload",
            "updated_at": datetime.now(timezone.utc),
        })
    return rows


def parse_salon_rows(content: bytes, filename: str) -> List[Dict[str, Any]]:
    df = _read_table(content, filename)
    rows = []
    for _, r in df.iterrows():
        name = _clean(r.get("name"))
        if not name:
            continue
        address = _clean(r.get("address"))
        lat, lon = _to_float(r.get("latitude")), _to_float(r.get("longitude"))
        if lat is None or lon is None:
            lat, lon, _precision = resolve_from_address(None, address, seed_key=str(name))
        is_premium_raw = _clean(r.get("is_premium"))
        model_recruit_raw = _clean(r.get("model_recruit_experience"))
        rows.append({
            "name": str(name).strip(),
            "address": address,
            "station": _clean(r.get("station")),
            "line": _clean(r.get("line")),
            "category": _clean(r.get("category")),
            "price_range": _clean(r.get("price_range")),
            "business_hours": _clean(r.get("business_hours")),
            "instagram": _clean(r.get("instagram")),
            "google_map_url": _clean(r.get("google_map_url")),
            "is_premium": str(is_premium_raw).strip().upper() in ("TRUE", "1", "YES") if is_premium_raw is not None else False,
            "model_recruit_experience": str(model_recruit_raw).strip().upper() in ("TRUE", "1", "YES") if model_recruit_raw is not None else False,
            "latitude": lat,
            "longitude": lon,
            "is_sample": False,
        })
    return rows
