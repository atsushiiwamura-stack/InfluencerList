"""最寄駅・路線情報の取得（HeartRails Express API を利用）

HeartRails Express は無料・APIキー不要で日本全国の駅情報を提供している公開API。
https://express.heartrails.com/api.html
実際の駅間の乗車時間データは提供されないため、本MVPでは
「最寄駅」「利用可能な路線」「駅までの距離・徒歩分数」のみを実データとして表示し、
主要駅までの所要時間は捏造せずに非表示とする。
"""
from typing import Optional
import httpx

from .scoring import haversine_m, walking_minutes

HEARTRAILS_URL = "https://express.heartrails.com/api/json"


async def get_nearby_stations(lat: float, lon: float, limit: int = 5) -> dict:
    params = {"method": "getStations", "x": lon, "y": lat}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(HEARTRAILS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # ネットワーク不可時はグレースフルにフォールバック
        return {"stations": [], "error": f"駅情報の取得に失敗しました: {exc}"}

    raw_stations = data.get("response", {}).get("station") or []
    if isinstance(raw_stations, dict):
        raw_stations = [raw_stations]

    grouped: dict[str, dict] = {}
    for st in raw_stations:
        name = st.get("name")
        if not name:
            continue
        sx, sy = st.get("x"), st.get("y")
        if sx is None or sy is None:
            continue
        dist_m = haversine_m(lat, lon, float(sy), float(sx))
        entry = grouped.setdefault(name, {
            "station": name,
            "prefecture": st.get("prefecture"),
            "lines": [],
            "distance_m": round(dist_m, 1),
            "walking_minutes": walking_minutes(dist_m),
        })
        line = st.get("line")
        if line and line not in entry["lines"]:
            entry["lines"].append(line)

    stations = sorted(grouped.values(), key=lambda s: s["distance_m"])[:limit]
    return {"stations": stations, "error": None}
