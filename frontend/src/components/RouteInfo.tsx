import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLineToggle } from "../utils/useLineToggle";
import LineBadge from "./LineBadge";
import type { RouteResponse } from "../types";

interface Props {
  lat: number;
  lon: number;
}

export default function RouteInfo({ lat, lon }: Props) {
  const [data, setData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { isActive, loadingLine, handleLineClick } = useLineToggle();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRoute(lat, lon)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData({ stations: [], error: "取得に失敗しました" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  if (loading) {
    return <div className="text-sm text-slate-400 py-2">最寄駅情報を取得中...</div>;
  }
  if (!data || data.error) {
    return <div className="text-sm text-slate-400 py-2">{data?.error || "駅情報が取得できませんでした"}</div>;
  }
  if (data.stations.length === 0) {
    return <div className="text-sm text-slate-400 py-2">近隣の駅情報が見つかりませんでした</div>;
  }

  return (
    <div className="space-y-2">
      {data.stations.map((st, idx) => (
        <div
          key={st.station + idx}
          className={`rounded-xl border p-3 ${idx === 0 ? "border-brand-300 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700" : "border-slate-200 dark:border-slate-700"}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {idx === 0 && "🚉 "}
              {st.station}駅
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              徒歩{st.walking_minutes}分・{Math.round(st.distance_m)}m
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {st.lines.map((line) => (
              <span key={line} className="relative">
                <LineBadge lineName={line} active={isActive(line)} onClick={() => handleLineClick(line)} />
                {loadingLine === line && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-400 animate-ping" />
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400 pt-1">
        路線名をタップすると地図上にその路線を表示できます（データが無い路線は反応しません）。駅・路線情報は
        HeartRails Express API（公開データ）による実測値です。駅間の乗車時間データは提供されないため表示していません。
      </p>
    </div>
  );
}
