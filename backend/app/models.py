from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Date, ForeignKey, func
from sqlalchemy.orm import relationship
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

    campaigns = relationship("Campaign", back_populates="salon", cascade="all, delete-orphan")


class Campaign(Base):
    """サロンごとのモデル募集キャンペーン履歴（営業資料・応募人数予測に使用）。"""
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False, index=True)
    campaign_no = Column(Integer, nullable=True)  # 何回目のキャンペーンか
    title = Column(String, nullable=True)
    menu = Column(String, nullable=True)  # 例: "カット,パーマ,眉カット"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    applicant_count = Column(Integer, nullable=True)  # 応募・集まった人数
    hired_count = Column(Integer, nullable=True)  # 実際に採用/来店した人数
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    salon = relationship("Salon", back_populates="campaigns")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
