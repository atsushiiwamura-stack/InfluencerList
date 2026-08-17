"""動作確認用のサンプル（ダミー）美容室データを投入するスクリプト。

【重要】ここで作成する店舗名・Instagramアカウント名はすべて架空のもので、
実在する店舗とは無関係です。is_sample=True を必ず立てており、フロント
エンドでも「サンプルデータ」であることが分かるバッジを表示する想定。
本番運用では管理画面のCSVアップロード機能で実データに置き換えること。

使い方:
    cd app/backend
    python3 scripts/seed_sample_salons.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine, SessionLocal
from app.models import Salon

SAMPLE_SALONS = [
    dict(name="【サンプル】Lemon Hair 渋谷店", address="東京都渋谷区渋谷1-1-1", station="渋谷", line="JR山手線",
         category="ヘア,カラー", price_range="¥¥¥", business_hours="10:00-20:00", instagram="@sample_lemonhair_shibuya",
         is_premium=True, model_recruit_experience=True, latitude=35.6595, longitude=139.7005),
    dict(name="【サンプル】Lemon Hair 表参道店", address="東京都渋谷区神宮前4-2-2", station="表参道", line="東京メトロ千代田線",
         category="ヘア,ブライダル", price_range="¥¥¥¥", business_hours="10:00-19:30", instagram="@sample_lemonhair_omotesando",
         is_premium=True, model_recruit_experience=True, latitude=35.6659, longitude=139.7128),
    dict(name="【サンプル】Beauty Salon SUN 新宿店", address="東京都新宿区新宿3-3-3", station="新宿", line="JR中央線",
         category="ヘア,ネイル", price_range="¥¥", business_hours="10:00-21:00", instagram="@sample_sun_shinjuku",
         is_premium=False, model_recruit_experience=True, latitude=35.6909, longitude=139.7003),
    dict(name="【サンプル】Beauty Salon SUN 池袋店", address="東京都豊島区東池袋1-4-4", station="池袋", line="JR埼京線",
         category="ヘア,エステ", price_range="¥¥", business_hours="10:00-20:30", instagram="@sample_sun_ikebukuro",
         is_premium=False, model_recruit_experience=False, latitude=35.7295, longitude=139.7109),
    dict(name="【サンプル】GLOW Hair 銀座店", address="東京都中央区銀座5-5-5", station="銀座", line="東京メトロ丸ノ内線",
         category="ヘア,美容", price_range="¥¥¥¥", business_hours="11:00-20:00", instagram="@sample_glow_ginza",
         is_premium=True, model_recruit_experience=True, latitude=35.6716, longitude=139.7660),
    dict(name="【サンプル】GLOW Hair 六本木店", address="東京都港区六本木6-6-6", station="六本木", line="東京メトロ日比谷線",
         category="ヘア,ネイル", price_range="¥¥¥", business_hours="11:00-21:00", instagram="@sample_glow_roppongi",
         is_premium=True, model_recruit_experience=False, latitude=35.6627, longitude=139.7318),
    dict(name="【サンプル】Petit Salon 吉祥寺店", address="東京都武蔵野市吉祥寺本町1-7-7", station="吉祥寺", line="JR中央線",
         category="ヘア", price_range="¥¥", business_hours="10:00-19:00", instagram="@sample_petit_kichijoji",
         is_premium=False, model_recruit_experience=True, latitude=35.7032, longitude=139.5799),
    dict(name="【サンプル】Petit Salon 中目黒店", address="東京都目黒区中目黒2-8-8", station="中目黒", line="東京メトロ日比谷線",
         category="ヘア,ファッション", price_range="¥¥¥", business_hours="10:00-19:00", instagram="@sample_petit_nakameguro",
         is_premium=False, model_recruit_experience=True, latitude=35.6443, longitude=139.6989),
    dict(name="【サンプル】YOKOHAMA Hair Works", address="神奈川県横浜市西区みなとみらい2-9-9", station="みなとみらい", line="みなとみらい線",
         category="ヘア,ブライダル", price_range="¥¥¥", business_hours="10:00-20:00", instagram="@sample_yokohama_hairworks",
         is_premium=True, model_recruit_experience=True, latitude=35.4595, longitude=139.6317),
    dict(name="【サンプル】YOKOHAMA Hair Works 川崎店", address="神奈川県川崎市幸区堤根1-10-10", station="川崎", line="JR東海道線",
         category="ヘア", price_range="¥¥", business_hours="10:00-20:00", instagram="@sample_kawasaki_hairworks",
         is_premium=False, model_recruit_experience=False, latitude=35.5308, longitude=139.6980),
    dict(name="【サンプル】OSAKA Beauty Base 梅田店", address="大阪府大阪市北区梅田1-11-11", station="梅田", line="大阪メトロ御堂筋線",
         category="ヘア,美容", price_range="¥¥¥", business_hours="10:00-21:00", instagram="@sample_osaka_umeda",
         is_premium=True, model_recruit_experience=True, latitude=34.7024, longitude=135.4959),
    dict(name="【サンプル】OSAKA Beauty Base 心斎橋店", address="大阪府大阪市中央区心斎橋2-12-12", station="心斎橋", line="大阪メトロ御堂筋線",
         category="ヘア,ネイル", price_range="¥¥", business_hours="10:00-20:00", instagram="@sample_osaka_shinsaibashi",
         is_premium=False, model_recruit_experience=True, latitude=34.6730, longitude=135.5010),
    dict(name="【サンプル】NAGOYA Hair Lab 栄店", address="愛知県名古屋市中区栄3-13-13", station="栄", line="名古屋市営地下鉄東山線",
         category="ヘア", price_range="¥¥", business_hours="10:00-20:00", instagram="@sample_nagoya_sakae",
         is_premium=False, model_recruit_experience=True, latitude=35.1707, longitude=136.9082),
    dict(name="【サンプル】FUKUOKA Hair Studio 天神店", address="福岡県福岡市中央区天神1-14-14", station="天神", line="福岡市地下鉄空港線",
         category="ヘア,ファッション", price_range="¥¥¥", business_hours="10:00-20:00", instagram="@sample_fukuoka_tenjin",
         is_premium=True, model_recruit_experience=True, latitude=33.5904, longitude=130.4017),
    dict(name="【サンプル】SAPPORO Beauty Room 大通店", address="北海道札幌市中央区大通西4-15-15", station="大通", line="札幌市営地下鉄南北線",
         category="ヘア,エステ", price_range="¥¥", business_hours="10:00-19:00", instagram="@sample_sapporo_odori",
         is_premium=False, model_recruit_experience=False, latitude=43.0603, longitude=141.3535),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Salon).filter(Salon.is_sample == True).delete()  # noqa: E712
        db.commit()
        print(f"既存サンプル美容室を削除: {existing}件")

        for data in SAMPLE_SALONS:
            db.add(Salon(is_sample=True, **data))
        db.commit()
        print(f"サンプル美容室を投入: {len(SAMPLE_SALONS)}件")
    finally:
        db.close()


if __name__ == "__main__":
    main()
