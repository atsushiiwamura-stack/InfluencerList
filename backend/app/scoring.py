import math
from typing import Optional

EARTH_RADIUS_M = 6371000
WALK_SPEED_M_PER_MIN = 80  # 標準的な徒歩速度の目安（≒時速4.8km）


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def walking_minutes(distance_m: float) -> int:
    return max(1, round(distance_m / WALK_SPEED_M_PER_MIN))


def distance_score(distance_m: float) -> float:
    """距離が近いほど高スコア。2km以遠は急速に減衰。"""
    km = distance_m / 1000
    if km <= 0.3:
        return 100.0
    if km >= 5:
        return 0.0
    # 0.3km→100, 5km→0 の線形減衰（緩やかにするため平方根を利用）
    ratio = (km - 0.3) / (5 - 0.3)
    return round(max(0.0, 100.0 * (1 - math.sqrt(ratio))), 1)


def follower_score(followers: Optional[int]) -> float:
    if not followers or followers <= 0:
        return 20.0  # データ未登録時は中立的な低めの基準値
    # 1,000〜100,000+ を対数スケールで 0-100 に正規化
    score = 40 * math.log10(max(followers, 100) / 100)
    return round(min(100.0, max(0.0, score)), 1)


def category_fit_score(influencer_category: Optional[str], salon_category: Optional[str]) -> float:
    if not influencer_category or not salon_category:
        return 50.0  # どちらかの情報が無い場合は中立スコア
    inf_tags = {t.strip() for t in influencer_category.split(",") if t.strip()}
    salon_tags = {t.strip() for t in salon_category.split(",") if t.strip()}
    if not inf_tags or not salon_tags:
        return 50.0
    overlap = inf_tags & salon_tags
    if overlap:
        return 100.0
    beauty_like = {"美容", "ヘア", "コスメ", "スキンケア", "ネイル", "エステ"}
    if inf_tags & beauty_like:
        return 60.0
    return 20.0


def experience_score(past_projects: Optional[int]) -> float:
    if not past_projects or past_projects <= 0:
        return 0.0
    return round(min(100.0, 25 * math.log2(past_projects + 1)), 1)


def composite_score(distance_m: float, followers: Optional[int], influencer_category: Optional[str],
                     salon_category: Optional[str], past_projects: Optional[int]) -> dict:
    d = distance_score(distance_m)
    f = follower_score(followers)
    c = category_fit_score(influencer_category, salon_category)
    e = experience_score(past_projects)
    total = round(d * 0.35 + c * 0.30 + f * 0.20 + e * 0.15, 1)
    return {
        "distance_score": d,
        "beauty_fit_score": c,
        "follower_score": f,
        "experience_score": e,
        "total_score": total,
    }
