import { useState } from "react";
import { api } from "../api/client";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_RADIUS_KM = 10;

/** 路線名バッジのクリックで、その路線の経路をオンデマンド取得して地図上に
 *  表示/非表示をトグルする（RouteInfo・AreaReportPanelで共通利用）。
 *  同時に、その路線沿い（駅ごとの半径円の合計・重複除去）の近隣インフルエンサー数も
 *  集計して取得する。 */
export function useLineToggle() {
  const [loadingLine, setLoadingLine] = useState<string | null>(null);
  const areaReportLines = useAppStore((s) => s.areaReportLines);
  const toggleLine = useAppStore((s) => s.toggleLine);
  const setLineStatLoading = useAppStore((s) => s.setLineStatLoading);
  const setLineStatResult = useAppStore((s) => s.setLineStatResult);
  const removeLineStat = useAppStore((s) => s.removeLineStat);

  const isActive = (lineName: string) => areaReportLines.some((l) => l.name === lineName);

  const handleLineClick = async (lineName: string) => {
    if (isActive(lineName)) {
      toggleLine({ name: lineName, points: [] });
      removeLineStat(lineName);
      return;
    }
    setLoadingLine(lineName);
    setLineStatLoading(lineName, DEFAULT_RADIUS_KM);
    try {
      const [routeResult, reportResult] = await Promise.allSettled([
        api.getLineRoute(lineName),
        api.getLineReport(lineName, DEFAULT_RADIUS_KM),
      ]);

      if (routeResult.status === "fulfilled" && routeResult.value.stations.length >= 2) {
        toggleLine({
          name: lineName,
          points: routeResult.value.stations.map((s) => [s.latitude, s.longitude] as [number, number]),
        });
      }

      if (reportResult.status === "fulfilled" && reportResult.value.stations.length > 0) {
        setLineStatResult(lineName, reportResult.value.total_nearby_influencer_count);
      } else {
        removeLineStat(lineName);
      }
    } catch {
      removeLineStat(lineName);
    } finally {
      setLoadingLine(null);
    }
  };

  return { isActive, loadingLine, handleLineClick };
}
