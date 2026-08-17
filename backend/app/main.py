import os
from typing import Optional, List
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .database import Base, engine, get_db, SessionLocal
from . import models, schemas
from .auth import (
    ensure_seed_admin, authenticate, create_access_token, get_current_admin,
)
from .scoring import haversine_m, walking_minutes, composite_score
from .uploads import parse_influencer_rows, parse_salon_rows
from .station import get_nearby_stations
from .geocode import resolve_from_address

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
@app.get("/api/influencers", response_model=List[schemas.InfluencerOut])
def list_influencers(
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

    return query.limit(limit).all()


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


# ---------- route / station ----------
@app.get("/api/route", response_model=dict)
async def route_info(lat: float, lon: float, limit: int = 5):
    return await get_nearby_stations(lat, lon, limit=limit)


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
