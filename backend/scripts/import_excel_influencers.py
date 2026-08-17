"""既存Excel（所在地リスト）を初期データとして取り込むワンオフスクリプト。

このExcelには「都道府県・市区町村」レベルの所在地しか含まれておらず、
名前・Instagram・フォロワー数・ジャンル・年齢・性別・正確な緯度経度は
含まれていない。そのためこれらのフィールドは None のまま登録し、
location_precision="city"（一部 "prefecture"）として、後から
管理画面のCSVアップロード機能で詳細情報を補完する前提とする。

使い方:
    cd app/backend
    python3 scripts/import_excel_influencers.py "/path/to/xlsx"
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import openpyxl
from app.database import Base, engine, SessionLocal
from app.models import Influencer
from app.geocode import normalize_prefecture, resolve_latlng


def parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def main(xlsx_path: str):
    Base.metadata.create_all(bind=engine)
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["result"]

    db = SessionLocal()
    try:
        deleted = db.query(Influencer).filter(Influencer.source == "excel_import").delete()
        db.commit()
        print(f"既存の excel_import レコードを削除: {deleted}件")

        inserted, skipped, unknown_pref = 0, 0, 0
        batch = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            (influencer_id, firebase_id, address_type, prefecture, city, updated_at, is_shipping_fallback) = row
            if influencer_id is None or not prefecture or not city:
                skipped += 1
                continue

            pref_norm = normalize_prefecture(prefecture)
            lat, lon, precision = resolve_latlng(pref_norm, city, seed_key=str(influencer_id))
            if precision == "unknown":
                unknown_pref += 1

            batch.append(Influencer(
                source_influencer_id=int(influencer_id),
                name=None,
                instagram_url=None,
                followers=None,
                category=None,
                age=None,
                gender=None,
                prefecture=pref_norm,
                city=str(city).strip(),
                address=None,
                coverage_areas=None,
                past_projects=0,
                latitude=lat,
                longitude=lon,
                location_precision=precision,
                profile_image_url=None,
                source="excel_import",
                updated_at=parse_dt(updated_at),
            ))
            inserted += 1

            if len(batch) >= 1000:
                db.bulk_save_objects(batch)
                db.commit()
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()

        print(f"取り込み完了: inserted={inserted}, skipped={skipped}, prefecture不明={unknown_pref}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使い方: python3 scripts/import_excel_influencers.py <xlsxファイルパス>")
        sys.exit(1)
    main(sys.argv[1])
