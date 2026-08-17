"""ローカルのSQLite(lemonmap.db)の全データをSupabase等のPostgresへ移行するスクリプト。

これまでにローカルで作った管理者アカウント・11,890件のインフルエンサー・
手動登録した実店舗を含む美容室19件などを、そのままクラウドDBへコピーする。

行ごとに merge() すると1行あたり複数回の通信が発生し、
1万件超では非常に遅くなる（Connection poolerだとさらに顕著）ため、
まとめてバルクINSERTする方式にしている。

使い方:
    cd app/backend
    export DATABASE_URL="postgresql://postgres.xxxx:xxxx@xxxx.pooler.supabase.com:6543/postgres"
    python3 scripts/migrate_to_postgres.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import Base, DB_PATH
from app.models import AdminUser, Influencer, Salon

BATCH_SIZE = 2000


def main():
    target_url = os.environ.get("DATABASE_URL")
    if not target_url or target_url.startswith("sqlite"):
        print("エラー: 移行先の DATABASE_URL（Postgres接続文字列）を環境変数で指定してください。")
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

    print("移行先にテーブルを作成しています...", flush=True)
    Base.metadata.create_all(bind=target_engine)

    src = SourceSession()
    dst = TargetSession()
    try:
        for model, label in [(AdminUser, "管理者"), (Salon, "美容室"), (Influencer, "インフルエンサー")]:
            t0 = time.time()
            table = model.__table__
            # 既存データを消してから入れる（再実行しても重複しないように）
            dst.execute(table.delete())
            dst.commit()

            rows = src.query(model).all()
            mappings = [{c.name: getattr(row, c.name) for c in table.columns} for row in rows]

            for i in range(0, len(mappings), BATCH_SIZE):
                batch = mappings[i : i + BATCH_SIZE]
                dst.execute(table.insert(), batch)
                dst.commit()
                print(f"  {label}: {min(i + BATCH_SIZE, len(mappings))}/{len(mappings)} 件", flush=True)

            # 明示的にidを指定してINSERTしたので、auto increment用のシーケンスを
            # 最大id+1まで進めておく（次回のINSERTでid重複エラーになるのを防ぐ）
            if "id" in table.columns.keys() and mappings:
                dst.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM {table.name}), 1))"
                ))
                dst.commit()

            print(f"{label}: {len(mappings)}件を移行しました。（{time.time() - t0:.1f}秒）", flush=True)
        print("移行完了。", flush=True)
    finally:
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
