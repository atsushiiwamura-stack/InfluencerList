# Lemon Map — インフルエンサー×美容室 マッチング管理アプリ（MVP）

Instagramインフルエンサーと美容室を日本地図上でマッチングさせるための管理ツールです。
現状は **Phase 1（地図表示・CSVアップロード・マーカー表示・ホバー詳細）が完成**、
**Phase 2（検索フィルター・距離計算・おすすめランキング）も主要機能まで実装済み**です。
Phase 3（AIによる自動推薦）は未実装です。

---

## 0. まず読んでください（重要な前提）

### (1) 元Excelには「所在地」以外の情報が入っていません

`20260723_インフルエンサー所在地リスト (2).xlsx` の実際の列は以下の7列でした。

```
influencer_id, firebaseId, address_type, prefecture, city, updatedAt, is_shipping_fallback
```

名前・Instagram・フォロワー数・ジャンル・年齢・性別・緯度経度は **含まれていません**。
そのため、このExcelから取り込んだ11,888件のインフルエンサーは、現在「都道府県・市区町村」までの
概算位置のみが表示され、詳細項目は空欄になっています。

- 地図上の位置は、市区町村の中心座標＋見やすくするための微小なランダムオフセット（実際の番地ではない）です。
- 各マーカーの `location_precision` が `"city"` の場合はこの概算位置であることを示します。
- 詳細項目（名前・フォロワー数・ジャンルなど）は、管理画面の **CSVアップロード機能** で
  同じ列構成のCSV/Excelをアップロードすると、既存レコードを更新する形で補完できます
  （現状は「名前＋都道府県」で既存レコードとの突合を行っています）。

### (2) 美容室データは実在しません（サンプルのみ）

今回のファイルには美容室データが一切含まれていなかったため、動作確認用に
**架空の店舗名を持つサンプル美容室15件**（`【サンプル】` prefix付き）を投入しています。
実運用前に、管理画面のCSVアップロードから実際の美容室データに置き換えてください。

---

## 1. 技術構成（当初案からの変更点）

このマシンには Node.js / npm / Homebrew が入っていなかったため、下記の構成にしています。
ユーザー側でNode.jsをインストール後、フロントエンドはそのまま `npm install && npm run dev` で起動できます。

| レイヤー | 当初案 | 実装 |
|---|---|---|
| Frontend | React + TypeScript + Tailwind + Mapbox/Google Maps | React + TypeScript + Tailwind + **react-leaflet（Leaflet）**。地図タイルは **OpenStreetMap**（無料・APIキー不要）。Mapboxに切り替えたい場合は `MapView.tsx` の `TileLayer` を差し替えるだけで対応可能。 |
| Backend | FastAPI or Node.js | **FastAPI**（Python） |
| Database | Supabase PostgreSQL | **SQLite**（`app/backend/lemonmap.db`、ファイル1つで完結）。将来Supabase(Postgres)に載せ替える場合は `app/database.py` の接続文字列とモデル定義のみ流用可能。 |
| Auth | 管理者ログイン | 自前実装のJWTログイン（`/api/auth/login`）。Supabase Authは未使用。 |
| 駅・路線情報 | — | **HeartRails Express API**（無料・APIキー不要の公開API）を使用し、実データで最寄駅・利用可能路線を表示。駅間の乗車時間データは提供されないため、その項目は捏造せず非表示にしています。 |

---

## 2. 起動方法

### 2-1. バックエンド（Python / すぐ動きます）

```bash
cd app/backend
python3 -m pip install --user -r requirements.txt

# 初回のみ：Excelインポート & サンプル美容室投入
python3 scripts/import_excel_influencers.py "../../20260723_インフルエンサー所在地リスト (2).xlsx"
python3 scripts/seed_sample_salons.py

# サーバー起動
python3 -m uvicorn app.main:app --reload --port 8000
```

- APIドキュメント（Swagger UI）: http://localhost:8000/docs
- 管理者ログイン初期値: `admin` / `changeme123`
  （環境変数 `LEMONMAP_ADMIN_USER` / `LEMONMAP_ADMIN_PASSWORD` で変更可能。本番運用前に必ず変更してください）

### 2-2. フロントエンド（Node.jsのインストールが必要）

このマシンにはNode.js/npmが入っていません。Homebrewも未導入のため、以下のいずれかでインストールしてください。

**方法A：公式インストーラー（一番簡単）**
1. https://nodejs.org/ja にアクセスし、LTS版の macOS Installer（.pkg）をダウンロード
2. インストーラーを実行

**方法B：nvm（バージョン管理したい場合）**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# ターミナルを再起動してから
nvm install --lts
```

Node.jsインストール後：

```bash
cd app/frontend
cp .env.example .env   # 必要に応じてAPIのURLを編集
npm install
npm run dev
```

http://localhost:5173 で管理画面が開きます（バックエンドは `http://localhost:8000` で起動している前提）。

---

## 3. 実装済み機能（Google Maps風UIに刷新）

- 全画面地図＋フローティングUI（検索バー・フィルターパネル・詳細カードはすべて地図に浮かせて表示、
  常設の大きいサイドバーは廃止）
- インフルエンサー＝丸い「顔アイコン」、美容室＝ティアドロップ型ピン（Googleマップ風）
- 美容室は**管理者ログイン後、地図上のUIから手動で追加・編集・削除**できる
  （店舗名・住所・最寄駅・路線・ジャンル・価格帯・営業時間・Instagram・高級店/募集経験フラグ）。
  「📍地図をクリックして位置を指定」で番地レベルの正確な位置を打てる（住所のみの場合は市区町村単位の概算）
- CSVアップロードによる一括登録も可能（フィルターパネル内からアクセス）
- 検索バーで美容室名を検索→選択すると地図がその場所にスムーズにフォーカス（フライトゥー）し、
  周辺の近いインフルエンサーが視界に入るよう自動でズーム・フレーミングされる
- 美容室ピンをクリックすると「近くのインフルエンサーランキング」
  （距離・フォロワー数・美容ジャンル適性・過去案件経験からスコアリング）が右側カードに表示
- インフルエンサーの顔アイコンをクリックすると「近くの美容室」一覧を表示
- 最寄駅・利用可能路線の実データ表示（HeartRails Express API）
- インフルエンサーの検索・フィルター（フォロワー数・年齢・性別・地域・ジャンル・美容系のみ・
  東京23区のみ・交通アクセスが良い人）は右上の🎛️ボタンから開くフローティングパネルに集約。
  **美容室側の条件フィルターは、手動登録が前提のため廃止**（店舗数が少なく検索バーで十分なため）
- 大量マーカー（11,888件）でも重くならないよう、Leaflet本来のクラスタリングAPIを
  直接使用（Reactコンポーネントを1件ずつ生成しない設計）
- ダークモード切替

### 未実装（Phase 3相当）
- AIによる美容室×インフルエンサーの自動レコメンド
  （現状のスコアリングはルールベース。LLM/ML化する場合は `app/backend/app/scoring.py` を拡張してください）

---

## 3-1. 地図タイルが断片的にしか表示されなかった問題（修正済み）

開発中、地図タイルが一部しか表示されない不具合が発生した。原因は2つ：

1. `index.css` で Leaflet 本体CSSを `@tailwind` ディレクティブより**後**に `@import` していた。
   CSS仕様上、`@import` は他のルールより前に書かないと無効化される（ブラウザに無視される）ため、
   Leafletのタイル配置に必須のCSSが読み込まれていなかった。→ Leaflet系CSSは `main.tsx` でJSとして
   importする形に変更（CSSの@importの位置問題を回避）。
2. `React.StrictMode` が開発時にreact-leafletの `MapContainer` を二重マウントさせ、
   同一DOMに2つの地図インスタンスが初期化される既知の問題があった。→ StrictModeを外した。

もし将来また地図が崩れる場合は、まずこの2点（CSSの@import順序／StrictModeの有無）を疑ってください。

---

## 4. 「交通アクセスが良い人」フィルターの精度について

このフィルターは、駅までの実測距離ではなく、**主要都市の中心区・中心市に該当するかどうか**の
簡易ヒューリスティックです（`app/backend/app/main.py` の `GOOD_ACCESS_CITIES`）。
元データが市区町村単位までしかないため、番地レベルの駅距離判定はできません。
CSVアップロードで緯度経度付きの詳細データを補完すれば、より正確な判定に切り替えられます。

---

## 5. CSVアップロードのフォーマット

サンプルは `app/backend/samples/` にあります。

**influencer_template.csv**
```
name,instagram_url,followers,category,age,gender,prefecture,address,latitude,longitude
```
`latitude`/`longitude` が空の場合、`address` 文字列から市区町村を推定して概算配置します。

**salon_template.csv**
```
name,address,station,line,category,instagram,latitude,longitude,price_range,business_hours,is_premium,model_recruit_experience
```

---

## 6. ディレクトリ構成

```
app/
  backend/
    app/            FastAPI本体（models, schemas, main, scoring, geocode, station, auth）
    app/data/       市区町村センター座標（geolonia/japanese-addresses由来）
    scripts/        Excel取り込み・サンプル美容室投入スクリプト
    samples/        CSVテンプレート
    lemonmap.db     SQLiteデータベース（実行後に生成）
  frontend/
    src/
      components/   MapView, Sidebar, DetailDrawer, HoverCard, Login, CsvUpload など
      store/        zustandによる状態管理
      api/          バックエンドAPIクライアント
```
