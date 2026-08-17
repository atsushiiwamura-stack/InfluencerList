from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from .database import Base


class Influencer(Base):
    __tablename__ = "influencers"

    id = Column(Integer, primary_key=True, index=True)
    source_influencer_id = Column(Integer, nullable=True, index=True)
    name = Column(String, nullable=True)
    instagram_url = Column(String, nullable=True)
    followers = Column(Integer, nullable=True)
    category = Column(String, nullable=True)  # comma-separated: 美容,ファッション,ライフスタイル...
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # 女性 / 男性 / その他 / 未回答
    prefecture = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False, index=True)
    address = Column(String, nullable=True)
    coverage_areas = Column(String, nullable=True)  # comma-separated 対応可能エリア
    past_projects = Column(Integer, nullable=True, default=0)  # 過去案件経験数
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_precision = Column(String, nullable=False, default="city")  # "exact" | "city"
    profile_image_url = Column(String, nullable=True)
    source = Column(String, nullable=False, default="excel_import")  # excel_import | csv_upload
    updated_at = Column(DateTime, nullable=True)


class Salon(Base):
    __tablename__ = "salons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    station = Column(String, nullable=True)
    line = Column(String, nullable=True)
    category = Column(String, nullable=True)  # 得意ジャンル
    price_range = Column(String, nullable=True)  # 価格帯
    business_hours = Column(String, nullable=True)
    instagram = Column(String, nullable=True)
    google_map_url = Column(String, nullable=True)
    is_premium = Column(Boolean, default=False)  # 高級店
    model_recruit_experience = Column(Boolean, default=False)  # カットモデル募集経験あり
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_sample = Column(Boolean, default=False)  # サンプル(ダミー)データフラグ


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
