"""ローカルのSQLite(lemonmap.db)の全データをSupabase等のPostgresへ移行するスクリプト。

これまでにローカルで作った管理者アカウント・11,890件のインフルエンサー・
手動登録した実店舗を含む美容室19件などを、そのままクラウドDBへコピーする。

使い方:
    cd app/backend
    export DATABASE_URL="postgresql://postgres:xxxx@xxxx.supabase.co:5432/postgres"
    python3 scripts/migrate_to_postgres.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, DB_PATH
from app.models import AdminUser, Influencer, Salon


def main():
    target_url = os.environ.get("DATABASE_URL")
    if not target_url or target_url.startswith("sqlite"):
        print("エラー: 移行先の DATABASE_URL（Postgres接続文字列）を環境変数で指定してください。")
        print('例: export DATABASE_URL="postgresql://postgres:xxxx@xxxx.supabase.co:5432/postgres"')
        sys.exit(1)
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql+psycopg2://", 1)

    if not os.path.exists(DB_PATH):
        print(f"エラー: 移行元のSQLiteファイルが見つかりません: {DB_PATH}")
        sys.exit(1)

    source_engine = create_engine(f"sqlite:///{DB_PATH}")
    target_engine = create_engine(target_url)

    SourceSession = sessionmaker(bind=source_engine)
    TargetSession = sessionmaker(bind=target_engine)

    print("移行先にテーブルを作成しています...")
    Base.metadata.create_all(bind=target_engine)

    src = SourceSession()
    dst = TargetSession()
    try:
        for model, label in [(AdminUser, "管理者"), (Influencer, "インフルエンサー"), (Salon, "美容室")]:
            rows = src.query(model).all()
            count = 0
            for row in rows:
                data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
                dst.merge(model(**data))
                count += 1
            dst.commit()
            print(f"{label}: {count}件を移行しました。")
        print("移行完了。")
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
