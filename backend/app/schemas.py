from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


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
    address: Optional[str] = None
    coverage_areas: Optional[str] = None
    past_projects: Optional[int] = None
    latitude: float
    longitude: float
    location_precision: str
    profile_image_url: Optional[str] = None
    source: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
