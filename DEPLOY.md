# デプロイ手順（Vercel + Render + Supabase）

この構成なら、公開後も管理画面から美容室の追加・編集・削除がそのまま保存され続けます
（データはSupabaseの永続DBに保存され、Renderのサーバーが常にそこを参照するため）。

ローカルでの`git init`・コミットまでは済ませてあります（リモートへの push はまだしていません）。
以下はすべて**あなた自身のアカウントで**行っていただく必要がある作業です（私の方では
外部サービスのアカウント作成やpushは代行できません）。

---

## STEP 1. GitHubにリポジトリを作成してpush

1. https://github.com/new でリポジトリを新規作成（Private推奨、README等は追加しない）
2. ターミナルで以下を実行（`<YOUR_GITHUB_URL>` は作成したリポジトリのURLに置き換え）

```bash
cd "/Users/atsushi.iwamura/インフルエンサ所在地/app"
git remote add origin <YOUR_GITHUB_URL>
git branch -M main
git push -u origin main
```

---

## STEP 2. Supabaseでデータベースを作成

1. https://supabase.com でアカウント作成 → 「New Project」
2. プロジェクト作成後、左メニュー **Project Settings → Database** を開き、
   **Connection string**（URI形式、`postgresql://postgres:...`）をコピー
   - Renderのような常時起動サーバーからの接続には「Session pooler」ではなく
     直接接続（Direct connection）で問題ありません
3. コピーした接続文字列を控えておく（STEP 3, 4で使用）

### 既存データをSupabaseへ移行

ローカルでこれまで作った管理者アカウント・インフルエンサー11,890件・
手動登録した美容室（VIEWS omotesando、City、Dejave hair、BIGOUDIなど）を
そのままSupabaseにコピーします。

```bash
cd "/Users/atsushi.iwamura/インフルエンサ所在地/app/backend"
export DATABASE_URL="（Supabaseの接続文字列）"
python3 -m pip install --user -r requirements.txt
python3 scripts/migrate_to_postgres.py
```

「移行完了。」と出れば成功です。

---

## STEP 3. Renderでバックエンド(API)をデプロイ

1. https://render.com でアカウント作成
2. 「New +」→「Web Service」→ GitHubリポジトリを連携して選択
3. 設定：
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free でOK
4. 環境変数（Environment）に以下を設定：

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | SupabaseのPostgres接続文字列 |
   | `LEMONMAP_SECRET_KEY` | ランダムな文字列（下記コマンドで生成可） |
   | `LEMONMAP_ADMIN_USER` | 任意（既存の管理者を移行済みなら未設定でもOK） |
   | `LEMONMAP_ADMIN_PASSWORD` | 同上 |
   | `LEMONMAP_CORS_ORIGINS` | 一旦 `*` でOK（STEP 4完了後にVercelのURLに絞る） |

   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

5. デプロイ完了後に発行されるURL（例: `https://lemon-map-api.onrender.com`）を控える
6. 動作確認: `https://lemon-map-api.onrender.com/api/health` にアクセスして `{"status":"ok"}` が返ればOK

※ Render無料プランは15分アクセスが無いとスリープし、次回アクセス時に起動まで
数十秒かかります。常時起動させたい場合は有料プラン（$7/月〜）へのアップグレードが必要です。

---

## STEP 4. Vercelでフロントエンドをデプロイ

1. https://vercel.com でアカウント作成 → 「Add New Project」→ 同じGitHubリポジトリを選択
2. 設定：
   - **Root Directory**: `frontend`
   - Framework Preset: Vite（自動検出されるはず）
3. 環境変数に以下を追加：

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | STEP 3で控えたRenderのURL（例: `https://lemon-map-api.onrender.com`） |

4. Deploy を実行。発行されたURL（例: `https://lemon-map.vercel.app`）が本番のアプリURLです

---

## STEP 5. CORSをVercelのURLに絞る（推奨・任意）

RenderのEnvironment設定に戻り、`LEMONMAP_CORS_ORIGINS` を
`*` から実際のVercel URL（例: `https://lemon-map.vercel.app`）に変更して再デプロイすると、
そのフロントエンドからのみAPIを呼べるようになりセキュリティが上がります。

---

## デプロイ後の運用について

- **美容室の追加・編集・削除はそのまま永続的に保存されます**（Supabase Postgresに保存されるため）
- CSVアップロードによる一括登録も同様に反映されます
- コードを修正したい場合は、ローカルで変更 → `git push` するだけでVercel/Renderが自動的に再デプロイします
- 管理者パスワードは、移行前にローカルで変更しておくか、Supabaseの `admin_users` テーブルを直接編集して更新してください
