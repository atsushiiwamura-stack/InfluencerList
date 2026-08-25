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


async def find_stations_by_name(name: str) -> list[dict]:
    """駅名（「天神」「博多」等）から、その駅の座標・路線を検索する（登録済み美容室が
    無いエリアでも、地名だけでインフルエンサー分布を調べられるようにするための機能）。
    同じ駅名が複数路線にまたがる場合は1つにまとめ、同名の別駅（全国に複数ある駅名）が
    存在する場合はそれぞれ別の地点として返す。"""
    params = {"method": "getStations", "name": name}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(HEARTRAILS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    raw_stations = data.get("response", {}).get("station") or []
    if isinstance(raw_stations, dict):
        raw_stations = [raw_stations]

    grouped: dict[tuple, dict] = {}
    for st in raw_stations:
        st_name = st.get("name")
        sx, sy = st.get("x"), st.get("y")
        if not st_name or sx is None or sy is None:
            continue
        key = (st_name, round(float(sx), 4), round(float(sy), 4))
        entry = grouped.setdefault(key, {
            "name": st_name,
            "prefecture": st.get("prefecture"),
            "latitude": float(sy),
            "longitude": float(sx),
            "lines": [],
        })
        line = st.get("line")
        if line and line not in entry["lines"]:
            entry["lines"].append(line)

    # JR/地下鉄など同じ駅でも運営会社ごとに座標が数百m単位でズレて別レコード
    # 扱いになることがあるため、同名かつ近接（300m以内）の地点は1つにまとめる。
    merged: list[dict] = []
    for entry in grouped.values():
        target = None
        for m in merged:
            if m["name"] == entry["name"] and haversine_m(
                m["latitude"], m["longitude"], entry["latitude"], entry["longitude"]
            ) <= 300:
                target = m
                break
        if target:
            for line in entry["lines"]:
                if line not in target["lines"]:
                    target["lines"].append(line)
        else:
            merged.append(entry)

    return merged
