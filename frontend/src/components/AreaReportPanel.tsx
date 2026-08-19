import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import type { AreaReport } from "../types";
import CampaignChart from "./CampaignChart";

export default function AreaReportPanel() {
  const open = useAppStore((s) => s.areaReportOpen);
  const setOpen = useAppStore((s) => s.setAreaReportOpen);
  const focusSalon = useAppStore((s) => s.focusSalon);

  const [q, setQ] = useState("");
  const [report, setReport] = useState<AreaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAreaReport(q.trim());
      setReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-16 sm:bottom-16 sm:w-[560px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-slate-700 z-[700] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">📊 エリアレポート（営業資料用）</h2>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm">
          ✕
        </button>
      </div>

      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="エリア名で検索（例: 銀座、渋谷、南青山）"
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 py-2 text-slate-700 dark:text-slate-200"
        />
        <button
          onClick={search}
          disabled={loading}
          className="rounded-lg bg-brand-600 text-white text-sm px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!report && !loading && (
          <p className="text-sm text-slate-400">
            住所または最寄駅にヒットするエリア名を入力してください。該当する美容室と、
            過去のキャンペーン実績から算出した「予想応募人数」がまとめて表示されます。
          </p>
        )}

        {report && (
          <>
            <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-4">
              <div className="text-xs text-brand-700 dark:text-brand-300 font-semibold mb-1">
                「{report.query}」エリアの予想応募人数（過去実績の平均）
              </div>
              {report.prediction.sample_size > 0 ? (
                <>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    平均 {report.prediction.avg_applicants}人
                    <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                      （中央値 {report.prediction.median_applicants}人・キャンペーン{report.prediction.sample_size}件のデータ）
                    </span>
                  </div>
                  {Object.keys(report.prediction.by_menu).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(report.prediction.by_menu).map(([menu, avg]) => (
                        <span
                          key={menu}
                          className="text-[11px] bg-white dark:bg-slate-800 border border-brand-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-slate-600 dark:text-slate-300"
                        >
                          {menu} 平均{avg}人
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  このエリアにはまだキャンペーン実績データがありません（該当店舗 {report.salons.length}件）。
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                該当する美容室（{report.salons.length}件）
              </h3>
              <div className="space-y-3">
                {report.salons.map((sc) => (
                  <div key={sc.salon.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          focusSalon(sc.salon.id);
                          setOpen(false);
                        }}
                        className="font-semibold text-sm text-slate-800 dark:text-slate-100 hover:text-brand-600 text-left"
                      >
                        {sc.salon.name}
                      </button>
                      {sc.avg_applicants != null && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          平均{sc.avg_applicants}人 / {sc.campaign_count}回
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{sc.salon.address}</div>
                    {sc.campaigns.length > 0 ? (
                      <div className="mt-2">
                        <CampaignChart campaigns={sc.campaigns} />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mt-2">キャンペーン記録なし</div>
                    )}
                  </div>
                ))}
                {report.salons.length === 0 && (
                  <p className="text-sm text-slate-400">該当する美容室が見つかりませんでした。</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
