import { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import type { UploadResult } from "../types";

export default function CsvUploadModal() {
  const open = useAppStore((s) => s.uploadModalOpen);
  const setOpen = useAppStore((s) => s.setUploadModalOpen);
  const authToken = useAppStore((s) => s.authToken);
  const fetchAll = useAppStore((s) => s.fetchAll);

  const [kind, setKind] = useState<"influencer" | "salon" | "campaign">("influencer");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const submit = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file || !authToken) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res =
        kind === "influencer"
          ? await api.uploadInfluencers(file, authToken)
          : kind === "salon"
          ? await api.uploadSalons(file, authToken)
          : await api.uploadCampaigns(file, authToken);
      setResult(res);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[420px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">CSV / Excel アップロード</h2>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {!authToken && (
          <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mb-3">
            アップロードには管理者ログインが必要です。
          </p>
        )}

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setKind("influencer")}
            className={`flex-1 rounded-lg text-sm py-2 border ${kind === "influencer" ? "bg-pink-50 border-pink-300 text-pink-700" : "border-slate-200 text-slate-400"}`}
          >
            インフルエンサー
          </button>
          <button
            onClick={() => setKind("salon")}
            className={`flex-1 rounded-lg text-sm py-2 border ${kind === "salon" ? "bg-sky-50 border-sky-300 text-sky-700" : "border-slate-200 text-slate-400"}`}
          >
            美容室
          </button>
          <button
            onClick={() => setKind("campaign")}
            className={`flex-1 rounded-lg text-sm py-2 border ${kind === "campaign" ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-400"}`}
          >
            キャンペーン実績
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="w-full text-sm text-slate-600 dark:text-slate-300 mb-3"
        />

        <details className="text-xs text-slate-400 mb-3">
          <summary className="cursor-pointer">必要な列（カラム）を見る</summary>
          {kind === "influencer" && (
            <p className="mt-1">
              name, instagram_url, followers, category, age, gender, prefecture, address, latitude, longitude
              <br />
              （latitude/longitude が無い場合は address から市区町村を自動推定して概算配置します）
            </p>
          )}
          {kind === "salon" && (
            <p className="mt-1">
              name, address, station, line, category, instagram, latitude, longitude, price_range,
              business_hours, is_premium, model_recruit_experience, google_map_url
            </p>
          )}
          {kind === "campaign" && (
            <p className="mt-1">
              salon_name, campaign_no, title, menu, start_date, end_date, applicant_count, hired_count, notes
              <br />
              （salon_name は登録済みの美容室名と完全一致させてください。一致しない行はスキップされ、
              結果にエラーとして表示されます。campaign_no が既存レコードと一致する場合は上書き更新されます）
            </p>
          )}
        </details>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        {result && (
          <div className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg p-3 mb-2 space-y-0.5">
            <div>新規追加: {result.inserted}件</div>
            <div>更新: {result.updated}件</div>
            <div>スキップ: {result.skipped}件</div>
            {result.errors.length > 0 && <div>エラー: {result.errors.slice(0, 3).join(" / ")}</div>}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!authToken || loading}
          className="w-full rounded-lg bg-brand-600 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "アップロード中..." : "アップロードして地図に反映"}
        </button>
      </div>
    </div>
  );
}
