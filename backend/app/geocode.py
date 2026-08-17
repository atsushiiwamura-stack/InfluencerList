"""市区町村名からおおよその緯度経度を求めるユーティリティ。

このアプリの元データ（Excelインポート分）は「都道府県・市区町村」までしか
分からず、正確な番地情報が無い。そのため国土交通省系オープンデータ
（geolonia/japanese-addresses）から作成した市区町村センター座標
（city_centroids.json）を用いて近似位置を割り当てる。

同じ市区町村に多数のインフルエンサーが存在する場合に地図上で完全に重なって
しまうのを避けるため、influencer_id を種にした決定的な小さいジッター
（±800m 程度）を加える。ジッターはあくまで視覚的な分散であり、実際の
番地情報ではないことを location_precision="city" で明示する。
"""
import hashlib
import json
import math
import os
from typing import Optional, Tuple

_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "city_centroids.json")

_CITY_CENTROIDS: Optional[dict] = None
_PREFECTURE_CENTROIDS: Optional[dict] = None

# Excel データに含まれる表記ゆれの簡易補正
_PREFECTURE_ALIASES = {
    "東京": "東京都",
    "Tokyo": "東京都",
    "大阪": "大阪府",
    "京都": "京都府",
    "神奈川": "神奈川県",
    "福岡": "福岡県",
    "新潟": "新潟県",
    "和歌山": "和歌山県",
    "富山": "富山県",
    "鹿児島": "鹿児島県",
    "沖縄県中頭郡": "沖縄県",
}


def _load():
    global _CITY_CENTROIDS, _PREFECTURE_CENTROIDS
    if _CITY_CENTROIDS is not None:
        return
    with open(_DATA_PATH, encoding="utf-8") as f:
        _CITY_CENTROIDS = json.load(f)

    pref_sums: dict[str, list] = {}
    for key, (lat, lon) in _CITY_CENTROIDS.items():
        pref = key.split("|", 1)[0]
        s = pref_sums.setdefault(pref, [0.0, 0.0, 0])
        s[0] += lat
        s[1] += lon
        s[2] += 1
    _PREFECTURE_CENTROIDS = {
        pref: (round(latsum / n, 6), round(lonsum / n, 6))
        for pref, (latsum, lonsum, n) in pref_sums.items() if n
    }


def normalize_prefecture(pref: Optional[str]) -> Optional[str]:
    if not pref:
        return pref
    pref = pref.strip()
    return _PREFECTURE_ALIASES.get(pref, pref)


def _jitter(seed_key: str, radius_m: float) -> Tuple[float, float]:
    h = hashlib.md5(seed_key.encode("utf-8")).hexdigest()
    angle = (int(h[:8], 16) % 3600) / 3600 * 2 * math.pi
    frac = (int(h[8:16], 16) % 1000) / 1000
    dist_m = radius_m * math.sqrt(frac)
    dlat = (dist_m * math.cos(angle)) / 111_320
    dlon = (dist_m * math.sin(angle)) / (111_320 * math.cos(math.radians(35)))
    return dlat, dlon


def resolve_latlng(prefecture: str, city: str, seed_key: str) -> Tuple[float, float, str]:
    """(緯度, 経度, precision) を返す。precision: 'city' | 'prefecture' | 'unknown'"""
    _load()
    pref = normalize_prefecture(prefecture) or ""
    city = (city or "").strip()

    key = f"{pref}|{city}"
    if key in _CITY_CENTROIDS:
        lat, lon = _CITY_CENTROIDS[key]
        dlat, dlon = _jitter(seed_key, radius_m=700)
        return lat + dlat, lon + dlon, "city"

    if pref in _PREFECTURE_CENTROIDS:
        lat, lon = _PREFECTURE_CENTROIDS[pref]
        dlat, dlon = _jitter(seed_key, radius_m=6000)
        return lat + dlat, lon + dlon, "prefecture"

    # 東京都庁を最終フォールバックにする（都道府県名も不明な異常データ用）
    dlat, dlon = _jitter(seed_key, radius_m=6000)
    return 35.6895 + dlat, 139.6917 + dlon, "unknown"


_ALL_PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]


def extract_prefecture_from_address(address: Optional[str]) -> Optional[str]:
    if not address:
        return None
    for pref in _ALL_PREFECTURES:
        if address.startswith(pref) or pref in address[:6]:
            return pref
    return None


def resolve_from_address(prefecture: Optional[str], address: Optional[str], seed_key: str) -> Tuple[float, float, str]:
    """address文字列から市区町村名を推測してジオコーディングする（緯度経度が無いCSV用）。"""
    _load()
    pref = normalize_prefecture(prefecture) or extract_prefecture_from_address(address) or ""
    if pref and address:
        rest = address.replace(pref, "", 1) if address.startswith(pref) else address
        candidates = [k for k in _CITY_CENTROIDS if k.startswith(f"{pref}|")]
        # 市区町村名が長いものから順に一致確認（「横浜市」より「横浜市都筑区」を優先）
        candidates.sort(key=lambda k: -len(k.split("|", 1)[1]))
        for key in candidates:
            city = key.split("|", 1)[1]
            if city and city in rest:
                lat, lon = _CITY_CENTROIDS[key]
                dlat, dlon = _jitter(seed_key, radius_m=300)
                return lat + dlat, lon + dlon, "city"
    return resolve_latlng(pref, "", seed_key)
