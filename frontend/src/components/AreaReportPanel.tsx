import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import type { AreaReport } from "../types";
import CampaignChart from "./CampaignChart";

const RADIUS_OPTIONS = [0.5, 1, 2, 3, 5];

export default function AreaReportPanel() {
  const open = useAppStore((s) => s.areaReportOpen);
  const setOpen = useAppStore((s) => s.setAreaReportOpen);
  const focusSalon = useAppStore((s) => s.focusSalon);
  const focusBounds = useAppStore((s) => s.focusBounds);
  const setAreaReportCircles = useAppStore((s) => s.setAreaReportCircles);

  const [q, setQ] = useState("");
  const [radiusKm, setRadiusKm] = useState(2);
  const [report, setReport] = useState<AreaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const search = async (overrideRadius?: number) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAreaReport(q.trim(), overrideRadius ?? radiusKm);
      setReport(res);
      const centers: [number, number][] = res.salons.map((s) => [s.salon.latitude, s.salon.longitude]);
      if (centers.length > 0) {
        // 円が選んだ半径の分だけ画面に収まるよう、地図を自動でその範囲にフォーカスする。
        setAreaReportCircles(centers, res.radius_km * 1000);
        const pad = res.radius_km / 111; // 緯度1度 ≈ 111km の概算でbounds用の余白を作る
        const bounds = centers.flatMap(([lat, lon]) => [
          [lat + pad, lon + pad],
          [lat - pad, lon - pad],
        ] as [number, number][]);
        focusBounds(bounds);
      } else {
        setAreaReportCircles([], res.radius_km * 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const changeRadius = (r: number) => {
    setRadiusKm(r);
    if (report) search(r);
  };

  return (
    <div className="absolute top-20 left-4 bottom-4 w-full sm:w-[380px] max-w-[calc(100%-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-slate-700 z-[550] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">📊 エリアレポート</h2>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">
          ✕
        </button>
      </div>

      <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="エリア名（例: 銀座、渋谷）"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-slate-700 dark:text-slate-200"
          />
          <button
            onClick={() => search()}
            disabled={loading}
            className="rounded-lg bg-brand-600 text-white text-sm px-4 font-medium disabled:opacity-50 flex-shrink-0"
          >
            {loading ? "検索中" : "検索"}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
          <span>半径（地図に円で表示）：</span>
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => changeRadius(r)}
              className={`px-2 py-0.5 rounded-full border text-[11px] ${
                radiusKm === r
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300"
              }`}
            >
              {r}km
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!report && !loading && (
          <p className="text-xs text-slate-400 leading-relaxed">
            エリア名を入力すると、該当する美容室・過去のキャンペーン実績から算出した「予想応募人数」、
            そして選んだ半径内の<strong>インフルエンサー数</strong>が表示されます。地図上にはピンクの円で
            半径が表示されるので、範囲を目視で確認できます。
          </p>
        )}

        {report && (
          <>
            {report.matched_prefecture && (
              <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3">
                <div className="text-[10px] text-violet-700 dark:text-violet-300 font-semibold mb-1">
                  「{report.matched_prefecture}」全体のインフルエンサー在籍数
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {report.prefecture_influencer_count?.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  都道府県名で検索されたため、半径円ではなく{report.matched_prefecture}在住の全人数を集計しています
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-3">
                <div className="text-[10px] text-brand-700 dark:text-brand-300 font-semibold mb-1">
                  予想応募人数
                </div>
                {report.prediction.sample_size > 0 ? (
                  <>
                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {report.prediction.avg_applicants}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      中央値{report.prediction.median_applicants}人・{report.prediction.sample_size}件
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">実績データなし</div>
                )}
              </div>

              <div className="rounded-xl bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 p-3">
                <div className="text-[10px] text-pink-700 dark:text-pink-300 font-semibold mb-1">
                  該当店舗の半径{report.radius_km}km内
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {report.total_nearby_influencer_count.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  店舗{report.salons.length}件周辺（重複除く）
                </div>
              </div>
            </div>

            {Object.keys(report.prediction.by_menu).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(report.prediction.by_menu).map(([menu, avg]) => (
                  <span
                    key={menu}
                    className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-slate-600 dark:text-slate-300"
                  >
                    {menu} 平均{avg}人
                  </span>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                該当する美容室（{report.salons.length}件）
              </h3>
              <div className="space-y-2">
                {report.salons.map((sc) => (
                  <div key={sc.salon.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <button
                        onClick={() => focusSalon(sc.salon.id)}
                        className="font-semibold text-xs text-slate-800 dark:text-slate-100 hover:text-brand-600 text-left"
                      >
                        {sc.salon.name}
                      </button>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {sc.avg_applicants != null && <span>平均{sc.avg_applicants}人/{sc.campaign_count}回</span>}
                        <span className="bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full px-1.5 py-0.5">
                          📷{sc.nearby_influencer_count}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sc.salon.address}</div>
                    {sc.campaigns.length > 0 ? (
                      <div className="mt-1.5">
                        <CampaignChart campaigns={sc.campaigns} />
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 mt-1.5">キャンペーン記録なし</div>
                    )}
                  </div>
                ))}
                {report.salons.length === 0 && (
                  <p className="text-xs text-slate-400">該当する美容室が見つかりませんでした。</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
