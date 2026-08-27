from datetime import date
from typing import Optional, List
from pydantic import BaseModel, field_serializer


class InfluencerOut(BaseModel):
    id: int
    name: Optional[str] = None
    instagram_url: Optional[str] = None
    followers: Optional[int] = None
    category: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    prefecture: str
    city: str
    coverage_areas: Optional[str] = None
    latitude: float
    longitude: float
    location_precision: str

    class Config:
        from_attributes = True

    @field_serializer("latitude", "longitude")
    def _round_coord(self, v: float) -> float:
        # 11cm精度で十分なため小数点以下6桁に丸め、一覧APIのペイロードを軽くする
        return round(v, 6)


class SalonOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    station: Optional[str] = None
    line: Optional[str] = None
    category: Optional[str] = None
    price_range: Optional[str] = None
    business_hours: Optional[str] = None
    instagram: Optional[str] = None
    google_map_url: Optional[str] = None
    is_premium: bool
    model_recruit_experience: bool
    latitude: float
    longitude: float
    is_sample: bool

    class Config:
        from_attributes = True

    @field_serializer("latitude", "longitude")
    def _round_coord(self, v: float) -> float:
        return round(v, 6)


class SalonInput(BaseModel):
    name: str
    address: Optional[str] = None
    station: Optional[str] = None
    line: Optional[str] = None
    category: Optional[str] = None
    price_range: Optional[str] = None
    business_hours: Optional[str] = None
    instagram: Optional[str] = None
    google_map_url: Optional[str] = None
    is_premium: bool = False
    model_recruit_experience: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UploadResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str] = []


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NearbyInfluencer(BaseModel):
    influencer: InfluencerOut
    distance_m: float
    walking_minutes: int
    score: float
    score_breakdown: dict


class NearbySalon(BaseModel):
    salon: SalonOut
    distance_m: float
    walking_minutes: int


class StationInfo(BaseModel):
    station: Optional[str] = None
    prefecture: Optional[str] = None
    lines: List[str] = []
    distance_m: Optional[float] = None
    walking_minutes: Optional[int] = None
    source: str = "heartrails"


# ---------- 募集キャンペーン履歴 ----------
class CampaignInput(BaseModel):
    campaign_no: Optional[int] = None
    title: Optional[str] = None
    menu: Optional[str] = None  # 例: "カット,パーマ"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    applicant_count: Optional[int] = None
    hired_count: Optional[int] = None
    notes: Optional[str] = None


class CampaignOut(CampaignInput):
    id: int
    salon_id: int

    class Config:
        from_attributes = True


class SalonWithCampaigns(BaseModel):
    salon: SalonOut
    campaigns: List[CampaignOut]
    avg_applicants: Optional[float] = None
    campaign_count: int
    nearby_influencer_count: int = 0


class AreaPrediction(BaseModel):
    sample_size: int
    avg_applicants: Optional[float] = None
    median_applicants: Optional[float] = None
    min_applicants: Optional[int] = None  # このエリアの実績の中で最も少なかった人数（「〇〇人以上」の根拠）
    by_menu: dict = {}
    # このエリア自体に実績が無い場合、全国の実績から算出した推定値
    is_estimated: bool = False
    estimated_min_applicants: Optional[int] = None
    estimated_typical_applicants: Optional[int] = None
    regression_sample_size: Optional[int] = None  # 推定の元になった全国のキャンペーン件数


class StationAreaResult(BaseModel):
    name: str
    prefecture: Optional[str] = None
    lines: List[str] = []
    latitude: float
    longitude: float
    nearby_influencer_count: int = 0


class LineStation(BaseModel):
    name: str
    latitude: float
    longitude: float


class LineRoute(BaseModel):
    name: str
    stations: List[LineStation]


class AreaReport(BaseModel):
    query: str
    radius_km: float
    salons: List[SalonWithCampaigns]
    prediction: AreaPrediction
    total_nearby_influencer_count: int = 0
    matched_prefecture: Optional[str] = None  # 都道府県名で検索した場合にセットされる
    prefecture_influencer_count: Optional[int] = None  # その都道府県全体の在籍数
    station_matches: List[StationAreaResult] = []  # 駅名・地名一致（美容室未登録でも使える）
    line_routes: List[LineRoute] = []  # 該当駅を通る実在路線の経路（地図に線を引く用）
