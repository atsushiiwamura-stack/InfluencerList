import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { AreaCircle, AreaLine } from "../store/useAppStore";
import { api } from "../api/client";
import type { AreaReport, AreaPrediction } from "../types";
import CampaignChart from "./CampaignChart";
import { useDebouncedCallback } from "../utils/useDebouncedCallback";

// dataviz skillで検証済みのカテゴリカル配色。複数エリアを同時比較する時に
// どの円がどの行のものか色で見分けられるよう、行ごとに固定の色を割り当てる。
const ROW_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7", "#e34948"];

interface AreaRow {
  id: string;
  query: string;
  radiusKm: number;
  report: AreaReport | null;
  loading: boolean;
  error: string | null;
}

let rowSeq = 0;
function newRow(query = ""): AreaRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, query, radiusKm: 2, report: null, loading: false, error: null };
}

export default function AreaReportPanel() {
  const open = useAppStore((s) => s.areaReportOpen);
  const setOpen = useAppStore((s) => s.setAreaReportOpen);
  const focusSalon = useAppStore((s) => s.focusSalon);
  const focusBounds = useAppStore((s) => s.focusBounds);
  const setAreaReportCircles = useAppStore((s) => s.setAreaReportCircles);
  const setAreaReportLines = useAppStore((s) => s.setAreaReportLines);

  const [rows, setRows] = useState<AreaRow[]>([newRow()]);

  // 全行の結果が変わるたびに、地図上の円・路線をまとめて再計算する。
  useEffect(() => {
    const circles: AreaCircle[] = [];
    const lines: AreaLine[] = [];
    const seenLines = new Set<string>();
    rows.forEach((row, i) => {
      if (!row.report) return;
      const color = ROW_COLORS[i % ROW_COLORS.length];
      const radiusM = row.report.radius_km * 1000;
      row.report.salons.forEach((s) => circles.push({ center: [s.salon.latitude, s.salon.longitude], radiusM, color }));
      row.report.station_matches.forEach((s) => circles.push({ center: [s.latitude, s.longitude], radiusM, color }));
      row.report.line_routes.forEach((r) => {
        if (seenLines.has(r.name)) return;
        seenLines.add(r.name);
        lines.push({ name: r.name, points: r.stations.map((s) => [s.latitude, s.longitude]) });
      });
    });
    setAreaReportCircles(circles);
    setAreaReportLines(lines);
  }, [rows, setAreaReportCircles, setAreaReportLines]);

  const search = async (id: string, overrideRadius?: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row || !row.query.trim()) return;
    updateRow(id, { loading: true, error: null });
    try {
      const res = await api.getAreaReport(row.query.trim(), overrideRadius ?? row.radiusKm);
      updateRow(id, { report: res, loading: false });
      const centers: [number, number][] = [
        ...res.salons.map((s) => [s.salon.latitude, s.salon.longitude] as [number, number]),
        ...res.station_matches.map((s) => [s.latitude, s.longitude] as [number, number]),
      ];
      if (centers.length > 0) {
        const pad = res.radius_km / 111;
        const bounds = centers.flatMap(([lat, lon]) => [
          [lat + pad, lon + pad],
          [lat - pad, lon - pad],
        ] as [number, number][]);
        focusBounds(bounds);
      }
    } catch (err) {
      updateRow(id, { error: err instanceof Error ? err.message : "取得に失敗しました", loading: false });
    }
  };

  // Reactのフックは早期return（下のif(!open))より前で、かつ毎回同じ順序で
  // 呼び出す必要がある。以前はこれがreturnの後にあり、パネルを開いた瞬間に
  // フック呼び出し数が変わってReactがクラッシュ（画面が真っ白になる）していた。
  const debouncedRadiusSearch = useDebouncedCallback((id: string, r: number) => search(id, r), 500);

  if (!open) return null;

  const updateRow = (id: string, partial: Partial<AreaRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const changeRadius = (id: string, r: number) => {
    updateRow(id, { radiusKm: r });
    if (rows.find((row) => row.id === id)?.report) debouncedRadiusSearch(id, r);
  };

  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  return (
    <div className="absolute top-20 left-4 bottom-4 w-full sm:w-[400px] max-w-[calc(100%-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-slate-700 z-[550] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">📊 エリアレポート</h2>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          エリア（駅名・地名・都道府県名）ごとに行を追加して、それぞれ違う半径で同時に比較できます。
          地図上には行ごとに色分けした円が表示されます。
        </p>

        {rows.map((row, i) => (
          <AreaRowCard
            key={row.id}
            row={row}
            color={ROW_COLORS[i % ROW_COLORS.length]}
            onQueryChange={(v) => updateRow(row.id, { query: v })}
            onRadiusChange={(v) => changeRadius(row.id, v)}
            onSearch={() => search(row.id)}
            onFocusSalon={focusSalon}
            onRemove={rows.length > 1 ? () => removeRow(row.id) : undefined}
          />
        ))}

        <button
          onClick={addRow}
          className="w-full text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          ＋ 別のエリアを追加して比較
        </button>
      </div>
    </div>
  );
}

function AreaRowCard({
  row,
  color,
  onQueryChange,
  onRadiusChange,
  onSearch,
  onFocusSalon,
  onRemove,
}: {
  row: AreaRow;
  color: string;
  onQueryChange: (v: string) => void;
  onRadiusChange: (v: number) => void;
  onSearch: () => void;
  onFocusSalon: (id: number) => void;
  onRemove?: () => void;
}) {
  const { report, loading, error } = row;

  // 読み込みが長引いた時に「固まっている？」という不安を与えないよう、
  // 一定時間が経ったら「もう少しお待ちください」の案内を出す。
  const [slowLoading, setSlowLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 2500);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: color + "55" }}>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <input
          value={row.query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="エリア名（例: 福岡、博多、渋谷）"
          className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
        />
        <button
          onClick={onSearch}
          disabled={loading}
          className="rounded-lg bg-brand-600 text-white text-xs px-3 py-1.5 font-medium disabled:opacity-50 flex-shrink-0 flex items-center gap-1"
        >
          {loading && <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {loading ? "検索中" : "検索"}
        </button>
        {onRemove && (
          <button onClick={onRemove} className="text-slate-400 hover:text-red-500 text-sm flex-shrink-0 px-1">
            ✕
          </button>
        )}
      </div>

      {slowLoading && (
        <p className="text-[10px] text-slate-400 flex items-center gap-1">
          ⏳ もう少しお待ちください（駅・路線データを取得しています）
        </p>
      )}

      <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>半径</span>
        <input
          type="number"
          min={1}
          max={20}
          step={1}
          value={row.radiusKm}
          onChange={(e) => onRadiusChange(Math.round(Number(e.target.value)) || 1)}
          className="w-14 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 py-1 text-slate-700 dark:text-slate-200"
        />
        <span>km（数字入力または▲▼、地図に円で表示）</span>
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {report && (
        <div className="space-y-2 pt-1">
          {report.matched_prefecture && (
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-2">
              <div className="text-[10px] text-violet-700 dark:text-violet-300 font-semibold">
                「{report.matched_prefecture}」全体の在籍数
              </div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {report.prefecture_influencer_count?.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人</span>
              </div>
            </div>
          )}

          <PredictionCard prediction={report.prediction} />

          <div className="rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 p-2">
            <div className="text-[10px] text-pink-700 dark:text-pink-300 font-semibold">半径{report.radius_km}km内のインフルエンサー</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {report.total_nearby_influencer_count.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人</span>
            </div>
          </div>

          {report.station_matches.map((st, i) => (
            <div key={i} className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-700 dark:text-slate-200">🚉 {st.name}駅</span>
                <span className="text-[10px] bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full px-1.5 py-0.5">
                  📷{st.nearby_influencer_count}人
                </span>
              </div>
              {st.lines.length > 0 && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  🔴 {st.lines.join("・")}
                  {report.line_routes.length === 0 && "（この駅の路線データは地図に線として表示できませんでした）"}
                </div>
              )}
            </div>
          ))}

          {report.salons.map((sc) => (
            <div key={sc.salon.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onFocusSalon(sc.salon.id)}
                  className="font-semibold text-xs text-slate-800 dark:text-slate-100 hover:text-brand-600 text-left"
                >
                  {sc.salon.name}
                </button>
                <span className="text-[10px] bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full px-1.5 py-0.5">
                  📷{sc.nearby_influencer_count}
                </span>
              </div>
              {sc.campaigns.length > 0 && (
                <div className="mt-1.5">
                  <CampaignChart campaigns={sc.campaigns} />
                </div>
              )}
            </div>
          ))}

          {report.salons.length === 0 && report.station_matches.length === 0 && !report.matched_prefecture && (
            <p className="text-xs text-slate-400">該当するエリアが見つかりませんでした。</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 「33人」と断定するのではなく「〇〇人以上」という下限で示す。
 * ・このエリア自体に実績がある場合：過去に実際にあった最少応募人数を下限とする
 *   （＝これまで一度も下回ったことがない、という事実ベースの最低保証）
 * ・実績が無い場合：全国のキャンペーン実績から「近隣インフルエンサー数あたりの
 *   応募率」を算出し、そのうち最も低かった率をこのエリアの近隣インフルエンサー数に
 *   掛けた推定値を下限とする（＝規模が近い＝周辺インフルエンサー数が近いエリアの
 *   実績から類推する考え方）
 */
function PredictionCard({ prediction }: { prediction: AreaPrediction }) {
  const hasRealData = prediction.sample_size > 0;
  const hasEstimate = prediction.is_estimated && prediction.estimated_min_applicants != null;

  return (
    <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-brand-700 dark:text-brand-300 font-semibold">予想応募人数</div>
        {hasEstimate && (
          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full px-1.5 py-0.5">
            推定（実績なし）
          </span>
        )}
      </div>

      {hasRealData && (
        <>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {prediction.min_applicants}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人以上</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            過去{prediction.sample_size}件の実績（平均{prediction.avg_applicants}人）に基づく最低ライン
          </div>
        </>
      )}

      {!hasRealData && hasEstimate && (
        <>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {prediction.estimated_min_applicants}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">人以上</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            このエリアの実績はまだありません。全国{prediction.regression_sample_size}件の実績から、
            近隣インフルエンサー数が近いエリアの傾向をもとに推定（参考: 平均的には{prediction.estimated_typical_applicants}人程度）
          </div>
        </>
      )}

      {!hasRealData && !hasEstimate && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">推定に必要なデータがまだありません</div>
      )}
    </div>
  );
}
