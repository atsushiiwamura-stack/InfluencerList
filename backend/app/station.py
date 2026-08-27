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


# 路線の形状（駅の並び）はほぼ変化しないため、プロセス内メモリに無期限キャッシュする。
# エリアレポートを検索するたびに毎回HeartRailsへ問い合わせると読み込みが遅くなるため。
_line_route_cache: dict[str, list[dict]] = {}


async def get_line_route(line_name: str) -> list[dict]:
    """路線名から、その路線に属する駅を順番に並べた座標列を返す（地図に線を引くため）。
    HeartRails Express は「湘南新宿ライン」のような直通運転の愛称路線をそのままの名前
    では持っていないことが多く（例：藤沢駅は「JR東海道本線」として登録されている）、
    その場合はここでは何も返さない＝実データが無いものを推測で描画しない。"""
    if line_name in _line_route_cache:
        return _line_route_cache[line_name]

    params = {"method": "getStations", "line": line_name}
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

    route = []
    for st in raw_stations:
        name = st.get("name")
        sx, sy = st.get("x"), st.get("y")
        if not name or sx is None or sy is None:
            continue
        route.append({"name": name, "latitude": float(sy), "longitude": float(sx)})

    _line_route_cache[line_name] = route
    return route


async def get_line_routes(line_names: list[str]) -> dict[str, list[dict]]:
    """複数路線をまとめて並列取得する（読み込み時間を抑えるため）。"""
    import asyncio
    uncached = [n for n in line_names if n not in _line_route_cache]
    if uncached:
        results = await asyncio.gather(*(get_line_route(n) for n in uncached))
        for n, r in zip(uncached, results):
            _line_route_cache[n] = r
    return {n: _line_route_cache.get(n, []) for n in line_names}
