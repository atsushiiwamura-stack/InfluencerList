import os
import math
import gzip as _gzip
import json as _json
from typing import Optional, List
from fastapi import FastAPI, Depends, Request, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .database import Base, engine, get_db, SessionLocal
from . import models, schemas
from .auth import (
    ensure_seed_admin, authenticate, create_access_token, get_current_admin,
)
from .scoring import haversine_m, walking_minutes, composite_score
from .uploads import parse_influencer_rows, parse_salon_rows, parse_campaign_rows
from .station import get_nearby_stations, find_stations_by_name, get_line_route
from .geocode import resolve_from_address, normalize_prefecture, _ALL_PREFECTURES

Base.metadata.create_all(bind=engine)
with SessionLocal() as _db:
    ensure_seed_admin(_db)

app = FastAPI(title="Lemon Map API", version="0.1.0")

# 本番では環境変数 LEMONMAP_CORS_ORIGINS に
# "https://your-app.vercel.app,https://your-custom-domain.com" のようにカンマ区切りで
# フロントエンドのオリジンを設定する。未設定時は開発用に全オリジン許可のまま。
_cors_env = os.environ.get("LEMONMAP_CORS_ORIGINS", "*")
_cors_origins = ["*"] if _cors_env == "*" else [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# インフルエンサー一覧など大きなJSONを返すエンドポイントの転送量を大幅に削減し、
# 読み込みの体感速度を上げる。
app.add_middleware(GZipMiddleware, minimum_size=500)

TOKYO23 = {
    "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
    "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
    "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区",
}

# 「交通アクセスが良い」の簡易判定用ヒューリスティック（駅距離の実測ではなく、
# 主要都市の中心区・中心市を良好アクセスの目安として扱う簡易版）。
GOOD_ACCESS_CITIES = TOKYO23 | {
    "横浜市西区", "横浜市中区", "大阪市北区", "大阪市中央区", "名古屋市中区",
    "名古屋市中村区", "福岡市中央区", "福岡市博多区", "札幌市中央区", "京都市下京区",
    "京都市中京区", "神戸市中央区", "仙台市青葉区", "広島市中区",
}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------- auth ----------
@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが正しくありません。")
    return schemas.TokenResponse(access_token=create_access_token(user.username))


# ---------- influencers ----------
# RenderのAPIサーバーとSupabase(東京リージョン)が地理的に離れており、
# 1万件超をDBから毎回取得・シリアライズすると数秒かかる。フィルタ無しの
# 全件取得（画面表示時の初回ロードで必ず発生する）は「完成済みのJSON文字列」を
# プロセス内メモリにキャッシュする。Pydanticオブジェクトのリストをキャッシュ
# するだけだとFastAPIがresponse_model経由で毎回JSONへ再シリアライズしてしまい
# （非力なCPUではこれ自体が1秒以上かかる）効果が薄いため、シリアライズ後の
# バイト列を直接返して丸ごとスキップする。書き込み（CSVアップロード等）が
# あった時だけ破棄する。gzip圧縮自体もCPU負荷が大きい（非力なCPUだと1秒以上
# かかることがある）ため、圧縮後のバイト列も一緒に事前計算してキャッシュし、
# GZipMiddlewareによる毎リクエストの再圧縮を回避する。
_influencer_cache: dict = {"json": None, "gzip": None}
_influencer_points_cache: dict = {"data": None}  # エリアレポートの近隣人数計算用（緯度経度のみ）


def _invalidate_influencer_cache():
    _influencer_cache["json"] = None
    _influencer_cache["gzip"] = None
    _influencer_points_cache["data"] = None


def _get_influencer_points(db: Session):
    if _influencer_points_cache["data"] is None:
        _influencer_points_cache["data"] = db.query(
            models.Influencer.id, models.Influencer.latitude, models.Influencer.longitude
        ).all()
    return _influencer_points_cache["data"]


@app.get("/api/influencers", response_model=List[schemas.InfluencerOut])
def list_influencers(
    request: Request,
    prefecture: Optional[str] = None,
    category: Optional[str] = None,
    gender: Optional[str] = None,
    min_followers: Optional[int] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    beauty_only: bool = False,
    tokyo23_only: bool = False,
    good_access_only: bool = False,
    q: Optional[str] = None,
    limit: int = Query(20000, le=20000),
    db: Session = Depends(get_db),
):
    is_unfiltered = not any([
        prefecture, category, gender, min_followers, min_age, max_age,
        beauty_only, tokyo23_only, good_access_only, q,
    ]) and limit >= 20000

    if is_unfiltered and _influencer_cache["json"] is not None:
        accepts_gzip = "gzip" in request.headers.get("accept-encoding", "")
        if accepts_gzip:
            return Response(
                content=_influencer_cache["gzip"],
                media_type="application/json",
                headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding"},
            )
        return Response(content=_influencer_cache["json"], media_type="application/json")

    query = db.query(models.Influencer)
    if prefecture:
        query = query.filter(models.Influencer.prefecture == prefecture)
    if category:
        query = query.filter(models.Influencer.category.ilike(f"%{category}%"))
    if gender:
        query = query.filter(models.Influencer.gender == gender)
    if min_followers is not None:
        query = query.filter(models.Influencer.followers >= min_followers)
    if min_age is not None:
        query = query.filter(models.Influencer.age >= min_age)
    if max_age is not None:
        query = query.filter(models.Influencer.age <= max_age)
    if beauty_only:
        query = query.filter(or_(
            models.Influencer.category.ilike("%美容%"),
            models.Influencer.category.ilike("%ヘア%"),
            models.Influencer.category.ilike("%コスメ%"),
            models.Influencer.category.ilike("%スキンケア%"),
        ))
    if q:
        query = query.filter(models.Influencer.name.ilike(f"%{q}%"))
    if tokyo23_only:
        query = query.filter(models.Influencer.prefecture == "東京都", models.Influencer.city.in_(TOKYO23))
    if good_access_only:
        query = query.filter(models.Influencer.city.in_(GOOD_ACCESS_CITIES))

    results = query.limit(limit).all()

    if is_unfiltered:
        payload = [schemas.InfluencerOut.model_validate(r).model_dump(mode="json") for r in results]
        json_bytes = _json.dumps(payload).encode("utf-8")
        _influencer_cache["json"] = json_bytes
        _influencer_cache["gzip"] = _gzip.compress(json_bytes, compresslevel=6)
        accepts_gzip = "gzip" in request.headers.get("accept-encoding", "")
        if accepts_gzip:
            return Response(
                content=_influencer_cache["gzip"],
                media_type="application/json",
                headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding"},
            )
        return Response(content=json_bytes, media_type="application/json")

    return results


@app.post("/api/influencers/upload", response_model=schemas.UploadResult)
async def upload_influencers(file: UploadFile = File(...), db: Session = Depends(get_db),
                              _admin: models.AdminUser = Depends(get_current_admin)):
    content = await file.read()
    try:
        rows = parse_influencer_rows(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ファイルの解析に失敗しました: {exc}")

    inserted, updated, skipped, errors = 0, 0, 0, []
    for row in rows:
        try:
            existing = db.query(models.Influencer).filter(
                models.Influencer.name == row["name"],
                models.Influencer.prefecture == row["prefecture"],
                models.Influencer.source == "csv_upload",
            ).first()
            if existing:
                for k, v in row.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(models.Influencer(**row))
                inserted += 1
        except Exception as exc:  # noqa: BLE001
            skipped += 1
            errors.append(f"{row.get('name', '?')}: {exc}")
    db.commit()
    _invalidate_influencer_cache()
    return schemas.UploadResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors)


@app.get("/api/influencers/{influencer_id}/nearby-salons", response_model=List[schemas.NearbySalon])
def nearby_salons(influencer_id: int, limit: int = 10, db: Session = Depends(get_db)):
    inf = db.get(models.Influencer, influencer_id)
    if not inf:
        raise HTTPException(status_code=404, detail="インフルエンサーが見つかりません。")
    salons = db.query(models.Salon).all()
    results = []
    for salon in salons:
        dist = haversine_m(inf.latitude, inf.longitude, salon.latitude, salon.longitude)
        results.append(schemas.NearbySalon(
            salon=schemas.SalonOut.model_validate(salon),
            distance_m=round(dist, 1),
            walking_minutes=walking_minutes(dist),
        ))
    results.sort(key=lambda r: r.distance_m)
    return results[:limit]


# ---------- salons ----------
@app.get("/api/salons", response_model=List[schemas.SalonOut])
def list_salons(
    prefecture: Optional[str] = None,
    station: Optional[str] = None,
    line: Optional[str] = None,
    category: Optional[str] = None,
    premium_only: bool = False,
    model_recruit_only: bool = False,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Salon)
    if prefecture:
        query = query.filter(models.Salon.address.ilike(f"%{prefecture}%"))
    if station:
        query = query.filter(models.Salon.station.ilike(f"%{station}%"))
    if line:
        query = query.filter(models.Salon.line.ilike(f"%{line}%"))
    if category:
        query = query.filter(models.Salon.category.ilike(f"%{category}%"))
    if premium_only:
        query = query.filter(models.Salon.is_premium == True)  # noqa: E712
    if model_recruit_only:
        query = query.filter(models.Salon.model_recruit_experience == True)  # noqa: E712
    if q:
        query = query.filter(models.Salon.name.ilike(f"%{q}%"))
    return query.all()


@app.post("/api/salons/upload", response_model=schemas.UploadResult)
async def upload_salons(file: UploadFile = File(...), db: Session = Depends(get_db),
                         _admin: models.AdminUser = Depends(get_current_admin)):
    content = await file.read()
    try:
        rows = parse_salon_rows(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ファイルの解析に失敗しました: {exc}")

    inserted, updated, skipped, errors = 0, 0, 0, []
    for row in rows:
        try:
            existing = db.query(models.Salon).filter(
                models.Salon.name == row["name"], models.Salon.is_sample == False,  # noqa: E712
            ).first()
            if existing:
                for k, v in row.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(models.Salon(**row))
                inserted += 1
        except Exception as exc:  # noqa: BLE001
            skipped += 1
            errors.append(f"{row.get('name', '?')}: {exc}")
    db.commit()
    return schemas.UploadResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors)


@app.post("/api/salons", response_model=schemas.SalonOut)
def create_salon(payload: schemas.SalonInput, db: Session = Depends(get_db),
                  _admin: models.AdminUser = Depends(get_current_admin)):
    lat, lon = payload.latitude, payload.longitude
    if lat is None or lon is None:
        lat, lon, _precision = resolve_from_address(None, payload.address, seed_key=payload.name)
    salon = models.Salon(**{**payload.model_dump(exclude={"latitude", "longitude"}), "latitude": lat, "longitude": lon})
    db.add(salon)
    db.commit()
    db.refresh(salon)
    return salon


@app.put("/api/salons/{salon_id}", response_model=schemas.SalonOut)
def update_salon(salon_id: int, payload: schemas.SalonInput, db: Session = Depends(get_db),
                  _admin: models.AdminUser = Depends(get_current_admin)):
    salon = db.get(models.Salon, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="美容室が見つかりません。")
    lat, lon = payload.latitude, payload.longitude
    if lat is None or lon is None:
        lat, lon, _precision = resolve_from_address(None, payload.address, seed_key=payload.name)
    for key, value in payload.model_dump(exclude={"latitude", "longitude"}).items():
        setattr(salon, key, value)
    salon.latitude = lat
    salon.longitude = lon
    db.commit()
    db.refresh(salon)
    return salon


@app.delete("/api/salons/{salon_id}")
def delete_salon(salon_id: int, db: Session = Depends(get_db),
                  _admin: models.AdminUser = Depends(get_current_admin)):
    salon = db.get(models.Salon, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="美容室が見つかりません。")
    db.delete(salon)
    db.commit()
    return {"ok": True}


@app.get("/api/salons/{salon_id}/ranking", response_model=List[schemas.NearbyInfluencer])
def salon_ranking(salon_id: int, limit: int = 10, max_distance_km: float = 5.0, db: Session = Depends(get_db)):
    salon = db.get(models.Salon, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="美容室が見つかりません。")
    influencers = db.query(models.Influencer).all()
    results = []
    for inf in influencers:
        dist = haversine_m(salon.latitude, salon.longitude, inf.latitude, inf.longitude)
        if dist > max_distance_km * 1000:
            continue
        breakdown = composite_score(dist, inf.followers, inf.category, salon.category, inf.past_projects)
        results.append(schemas.NearbyInfluencer(
            influencer=schemas.InfluencerOut.model_validate(inf),
            distance_m=round(dist, 1),
            walking_minutes=walking_minutes(dist),
            score=breakdown["total_score"],
            score_breakdown=breakdown,
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]


# ---------- 募集キャンペーン履歴 ----------
@app.post("/api/campaigns/upload", response_model=schemas.UploadResult)
async def upload_campaigns(file: UploadFile = File(...), db: Session = Depends(get_db),
                            _admin: models.AdminUser = Depends(get_current_admin)):
    content = await file.read()
    try:
        rows = parse_campaign_rows(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ファイルの解析に失敗しました: {exc}")

    # サロン名(前後空白除去・大文字小文字無視)でのマッチング用インデックス
    salons_by_name = {s.name.strip().lower(): s for s in db.query(models.Salon).all()}

    inserted, updated, skipped, errors = 0, 0, 0, []
    for row in rows:
        salon_name = row.pop("salon_name")
        salon = salons_by_name.get(salon_name.strip().lower())
        if not salon:
            skipped += 1
            errors.append(f"「{salon_name}」に一致する美容室が見つかりません（先に美容室を登録してください）")
            continue
        try:
            existing = None
            if row.get("campaign_no") is not None:
                existing = db.query(models.Campaign).filter(
                    models.Campaign.salon_id == salon.id,
                    models.Campaign.campaign_no == row["campaign_no"],
                ).first()
            if existing:
                for k, v in row.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                db.add(models.Campaign(salon_id=salon.id, **row))
                inserted += 1
        except Exception as exc:  # noqa: BLE001
            skipped += 1
            errors.append(f"{salon_name}: {exc}")
    db.commit()
    return schemas.UploadResult(inserted=inserted, updated=updated, skipped=skipped, errors=errors)


@app.get("/api/salons/{salon_id}/campaigns", response_model=List[schemas.CampaignOut])
def list_campaigns(salon_id: int, db: Session = Depends(get_db)):
    salon = db.get(models.Salon, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="美容室が見つかりません。")
    return (
        db.query(models.Campaign)
        .filter(models.Campaign.salon_id == salon_id)
        .order_by(models.Campaign.start_date.asc().nulls_last(), models.Campaign.campaign_no.asc().nulls_last())
        .all()
    )


@app.post("/api/salons/{salon_id}/campaigns", response_model=schemas.CampaignOut)
def create_campaign(salon_id: int, payload: schemas.CampaignInput, db: Session = Depends(get_db),
                     _admin: models.AdminUser = Depends(get_current_admin)):
    salon = db.get(models.Salon, salon_id)
    if not salon:
        raise HTTPException(status_code=404, detail="美容室が見つかりません。")
    campaign = models.Campaign(salon_id=salon_id, **payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@app.put("/api/campaigns/{campaign_id}", response_model=schemas.CampaignOut)
def update_campaign(campaign_id: int, payload: schemas.CampaignInput, db: Session = Depends(get_db),
                     _admin: models.AdminUser = Depends(get_current_admin)):
    campaign = db.get(models.Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="キャンペーンが見つかりません。")
    for key, value in payload.model_dump().items():
        setattr(campaign, key, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@app.delete("/api/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db),
                     _admin: models.AdminUser = Depends(get_current_admin)):
    campaign = db.get(models.Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="キャンペーンが見つかりません。")
    db.delete(campaign)
    db.commit()
    return {"ok": True}


# ---------- エリア別レポート（営業資料用：実績一覧・予想募集人数・周辺インフルエンサー数） ----------
@app.get("/api/areas/report", response_model=schemas.AreaReport)
async def area_report(
    q: str = Query(..., min_length=1),
    radius_km: float = Query(2.0, ge=0.1, le=20.0),
    db: Session = Depends(get_db),
):
    salons = db.query(models.Salon).filter(
        or_(models.Salon.address.ilike(f"%{q}%"), models.Salon.station.ilike(f"%{q}%"))
    ).all()

    # クエリが都道府県名そのもの（「東京都」「大阪府」等）の場合、店舗周辺の
    # 半径円だけでは対象エリア全体をカバーできない（店舗の近くの人しか
    # 数えられない）ため、その都道府県に住んでいる全インフルエンサー数を
    # 別途カウントして返す。
    matched_prefecture = normalize_prefecture(q.strip())
    if matched_prefecture not in _ALL_PREFECTURES:
        matched_prefecture = None
    prefecture_influencer_count = None
    if matched_prefecture:
        prefecture_influencer_count = db.query(models.Influencer).filter(
            models.Influencer.prefecture == matched_prefecture
        ).count()

    # 緯度経度のみの軽量データ（周辺インフルエンサー数の判定に使う）。
    # 検索のたびにDBへ問い合わせると遅いためキャッシュする。
    influencer_points = _get_influencer_points(db)

    salon_results = []
    all_applicant_counts: List[int] = []
    menu_buckets: dict[str, List[int]] = {}
    nearby_ids_union: set = set()

    for salon in salons:
        campaigns = sorted(
            salon.campaigns,
            key=lambda c: (c.start_date is None, c.start_date, c.campaign_no or 0),
        )
        applicant_counts = [c.applicant_count for c in campaigns if c.applicant_count is not None]
        avg = round(sum(applicant_counts) / len(applicant_counts), 1) if applicant_counts else None
        all_applicant_counts.extend(applicant_counts)

        for c in campaigns:
            if c.applicant_count is None or not c.menu:
                continue
            for tag in c.menu.split(","):
                tag = tag.strip()
                if tag:
                    menu_buckets.setdefault(tag, []).append(c.applicant_count)

        nearby_ids = {
            inf_id for inf_id, lat, lon in influencer_points
            if haversine_m(salon.latitude, salon.longitude, lat, lon) <= radius_km * 1000
        }
        nearby_ids_union |= nearby_ids

        salon_results.append(schemas.SalonWithCampaigns(
            salon=schemas.SalonOut.model_validate(salon),
            campaigns=[schemas.CampaignOut.model_validate(c) for c in campaigns],
            avg_applicants=avg,
            campaign_count=len(campaigns),
            nearby_influencer_count=len(nearby_ids),
        ))

    # 美容室がまだ無いエリアでも「駅名・地名」だけでインフルエンサー分布を
    # 調べられるように、駅名としても検索する（都道府県名の場合はスキップ）。
    station_results: List[schemas.StationAreaResult] = []
    if not matched_prefecture:
        for st in await find_stations_by_name(q.strip()):
            nearby_ids = {
                inf_id for inf_id, lat, lon in influencer_points
                if haversine_m(st["latitude"], st["longitude"], lat, lon) <= radius_km * 1000
            }
            nearby_ids_union |= nearby_ids
            station_results.append(schemas.StationAreaResult(
                name=st["name"],
                prefecture=st.get("prefecture"),
                lines=st.get("lines", []),
                latitude=st["latitude"],
                longitude=st["longitude"],
                nearby_influencer_count=len(nearby_ids),
            ))

    # 路線の描画は重いため area_report では行わず、フロント側で駅名選択時に
    # /api/lines/route を個別に呼び出してオンデマンドで表示する。

    def _median(values: List[int]) -> Optional[float]:
        if not values:
            return None
        s = sorted(values)
        n = len(s)
        mid = n // 2
        return float(s[mid]) if n % 2 else round((s[mid - 1] + s[mid]) / 2, 1)

    # --- このエリア自体に実績が無い場合の推定ロジック ---
    # 「地方でまだ募集をかけたことがないエリアでも、似た規模のエリアの実績から
    # 何人集まりそうか推定したい」という要望への対応。
    #
    # 考え方：
    #   都市の似ている/いないを人手で判断するのではなく、「そのエリアの半径〇km圏内に
    #   何人インフルエンサーがいるか」を"エリアの規模"の代理指標として使う。
    #   全国の実績があるキャンペーンについて、それぞれの開催店舗の周辺インフルエンサー数
    #   （同じ半径で計算）に対する応募人数の比率＝「応募率」を求め、その分布から
    #   ・下位25%の応募率     → 保守的な下限の推定に使う（「〇〇人以上」の根拠）
    #   ・中央値の応募率     → 参考としての「だいたいこれくらい」の推定に使う
    #   を求め、対象エリア自身の周辺インフルエンサー数に掛け合わせて算出する。
    #   実績の無いエリアでも、規模が近い（＝周辺インフルエンサー数が近い）エリアの
    #   実績から類推していることになる。
    #   下限は「全国で一番悪かった1件」だと、そのエリアと無関係などこか1件の
    #   極端な不振が全体の下限を過剰に押し下げてしまうため、下位25%タイル値を使う
    #   （1件の外れ値に引っ張られにくく、かつ十分保守的な水準）。
    is_estimated = False
    estimated_min = None
    estimated_typical = None
    regression_n = None

    def _percentile(sorted_values: List[float], pct: float) -> float:
        if len(sorted_values) == 1:
            return sorted_values[0]
        k = (len(sorted_values) - 1) * pct
        lo, hi = math.floor(k), math.ceil(k)
        if lo == hi:
            return sorted_values[int(k)]
        return sorted_values[lo] * (hi - k) + sorted_values[hi] * (k - lo)

    if not all_applicant_counts and len(nearby_ids_union) > 0:
        all_campaigns_with_data = (
            db.query(models.Campaign)
            .filter(models.Campaign.applicant_count.isnot(None))
            .all()
        )
        rates: List[float] = []
        for camp in all_campaigns_with_data:
            csalon = camp.salon
            if not csalon:
                continue
            cnt = sum(
                1 for _, lat, lon in influencer_points
                if haversine_m(csalon.latitude, csalon.longitude, lat, lon) <= radius_km * 1000
            )
            if cnt > 0:
                rates.append(camp.applicant_count / cnt)

        if rates:
            rates.sort()
            r_low = _percentile(rates, 0.25)  # 下位25%タイル＝保守的だが外れ値1件に引っ張られない下限
            r_med = _percentile(rates, 0.5)
            area_n = len(nearby_ids_union)
            is_estimated = True
            estimated_min = int(area_n * r_low)
            estimated_typical = round(area_n * r_med)
            regression_n = len(rates)

    prediction = schemas.AreaPrediction(
        sample_size=len(all_applicant_counts),
        avg_applicants=round(sum(all_applicant_counts) / len(all_applicant_counts), 1) if all_applicant_counts else None,
        median_applicants=_median(all_applicant_counts),
        min_applicants=min(all_applicant_counts) if all_applicant_counts else None,
        by_menu={tag: round(sum(vals) / len(vals), 1) for tag, vals in menu_buckets.items()},
        is_estimated=is_estimated,
        estimated_min_applicants=estimated_min,
        estimated_typical_applicants=estimated_typical,
        regression_sample_size=regression_n,
    )

    return schemas.AreaReport(
        query=q,
        radius_km=radius_km,
        salons=salon_results,
        prediction=prediction,
        total_nearby_influencer_count=len(nearby_ids_union),
        matched_prefecture=matched_prefecture,
        prefecture_influencer_count=prefecture_influencer_count,
        station_matches=station_results,
    )


# ---------- route / station ----------
@app.get("/api/route", response_model=dict)
async def route_info(lat: float, lon: float, limit: int = 5):
    return await get_nearby_stations(lat, lon, limit=limit)


@app.get("/api/lines/route", response_model=schemas.LineRoute)
async def line_route(name: str):
    stations = await get_line_route(name)
    return schemas.LineRoute(name=name, stations=[schemas.LineStation(**s) for s in stations])


@app.get("/api/lines/report", response_model=schemas.LineReport)
async def line_report(
    name: str = Query(..., min_length=1),
    radius_km: float = Query(10.0, ge=0.1, le=20.0),
    db: Session = Depends(get_db),
):
    """沿線（駅ごとの半径円の合計）で、重複を除いた近隣インフルエンサー数を算出する。
    エリアレポートの「駅単位の半径検索」に対し、こちらは1路線まるごとの合算値を返す。"""
    stations = await get_line_route(name)
    influencer_points = _get_influencer_points(db)

    nearby_ids_union: set = set()
    station_results: List[schemas.LineStationCount] = []
    for st in stations:
        nearby_ids = {
            inf_id for inf_id, lat, lon in influencer_points
            if haversine_m(st["latitude"], st["longitude"], lat, lon) <= radius_km * 1000
        }
        nearby_ids_union |= nearby_ids
        station_results.append(schemas.LineStationCount(
            name=st["name"],
            latitude=st["latitude"],
            longitude=st["longitude"],
            nearby_influencer_count=len(nearby_ids),
        ))

    return schemas.LineReport(
        name=name,
        radius_km=radius_km,
        stations=station_results,
        total_nearby_influencer_count=len(nearby_ids_union),
    )


# ---------- meta ----------
@app.get("/api/meta")
def meta(db: Session = Depends(get_db)):
    prefectures = [r[0] for r in db.query(models.Influencer.prefecture).distinct().order_by(models.Influencer.prefecture)]
    categories = set()
    for (cat,) in db.query(models.Influencer.category).filter(models.Influencer.category.isnot(None)):
        categories.update(t.strip() for t in cat.split(",") if t.strip())
    salon_categories = set()
    for (cat,) in db.query(models.Salon.category).filter(models.Salon.category.isnot(None)):
        salon_categories.update(t.strip() for t in cat.split(",") if t.strip())
    lines = [r[0] for r in db.query(models.Salon.line).filter(models.Salon.line.isnot(None)).distinct()]
    stations = [r[0] for r in db.query(models.Salon.station).filter(models.Salon.station.isnot(None)).distinct()]
    return {
        "prefectures": prefectures,
        "influencer_categories": sorted(categories),
        "salon_categories": sorted(salon_categories),
        "lines": lines,
        "stations": stations,
        "influencer_count": db.query(models.Influencer).count(),
        "salon_count": db.query(models.Salon).count(),
    }
