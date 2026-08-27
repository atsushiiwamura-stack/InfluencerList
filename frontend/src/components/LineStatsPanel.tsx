import { useAppStore } from "../store/useAppStore";

/** 選択中の路線ごとに「沿線（駅ごとの半径円の合計・重複除去）」の
 *  近隣インフルエンサー数を表示する、地図左下の小さなフローティングパネル。 */
export default function LineStatsPanel() {
  const lineStats = useAppStore((s) => s.lineStats);

  if (lineStats.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-[500] flex flex-col gap-2 max-w-[220px]">
      {lineStats.map((stat) => (
        <div
          key={stat.name}
          className="bg-white/95 dark:bg-slate-900/95 shadow-lg rounded-xl border border-slate-200/70 dark:border-slate-700 px-3 py-2"
        >
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">🚃 {stat.name} 沿線</div>
          {stat.loading ? (
            <div className="text-[11px] text-slate-400 mt-0.5">集計中...</div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              半径{stat.radiusKm}km以内 合計{" "}
              <span className="font-bold text-brand-600 dark:text-brand-400">{stat.total.toLocaleString()}人</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
