import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { Campaign } from "../types";

// dataviz skillの検証済みカテゴリカル配色（スロット1=青, スロット2=橙）を採用。
// ライト/ダークとも隣接ペアのCVD分離・コントラストとも検証済み。
const SERIES = {
  applicant: { light: "#2a78d6", dark: "#3987e5", label: "応募" },
  hired: { light: "#eb6834", dark: "#d95926", label: "採用" },
};

const BAR_W = 12;
const GAP_IN_GROUP = 2;
const GROUP_GAP = 18;
const CHART_H = 120;

function niceMax(v: number): number {
  if (v <= 0) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function CampaignChart({ campaigns }: { campaigns: Campaign[] }) {
  const darkMode = useAppStore((s) => s.darkMode);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  const withData = campaigns.filter((c) => c.applicant_count != null || c.hired_count != null);
  if (withData.length === 0) return null;

  const maxVal = niceMax(Math.max(...withData.map((c) => Math.max(c.applicant_count ?? 0, c.hired_count ?? 0))));
  const groupW = BAR_W * 2 + GAP_IN_GROUP;
  const chartW = withData.length * (groupW + GROUP_GAP) - GROUP_GAP + 8;
  const applicantColor = darkMode ? SERIES.applicant.dark : SERIES.applicant.light;
  const hiredColor = darkMode ? SERIES.hired.dark : SERIES.hired.light;
  const axisColor = darkMode ? "#c3c2b7" : "#898781";
  const gridColor = darkMode ? "#2c2c2a" : "#e1e0d9";

  const yTicks = [0, maxVal / 2, maxVal];

  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-2 text-xs text-slate-500 dark:text-slate-400">
        <Legend color={applicantColor} label="応募" />
        <Legend color={hiredColor} label="採用" />
      </div>
      <svg width="100%" height={CHART_H + 24} viewBox={`0 0 ${chartW + 30} ${CHART_H + 24}`} className="overflow-visible">
        {yTicks.map((t, i) => {
          const y = CHART_H - (t / maxVal) * CHART_H;
          return (
            <g key={i}>
              <line x1={26} x2={chartW + 30} y1={y} y2={y} stroke={gridColor} strokeWidth={1} />
              <text x={0} y={y + 3} fontSize={9} fill={axisColor}>
                {Math.round(t)}
              </text>
            </g>
          );
        })}
        <line x1={26} x2={26} y1={0} y2={CHART_H} stroke={axisColor} strokeWidth={1} />

        {withData.map((c, i) => {
          const gx = 30 + i * (groupW + GROUP_GAP);
          const aH = ((c.applicant_count ?? 0) / maxVal) * CHART_H;
          const hH = ((c.hired_count ?? 0) / maxVal) * CHART_H;
          const label = c.title || (c.campaign_no ? `${c.campaign_no}回目` : `#${c.id}`);
          return (
            <g key={c.id}>
              {c.applicant_count != null && (
                <rect
                  x={gx}
                  y={CHART_H - aH}
                  width={BAR_W}
                  height={Math.max(aH, 1)}
                  rx={4}
                  fill={applicantColor}
                  onMouseEnter={() => setHover({ x: gx, y: CHART_H - aH, label: `${label}・応募`, value: c.applicant_count! })}
                  onMouseLeave={() => setHover(null)}
                />
              )}
              {c.hired_count != null && (
                <rect
                  x={gx + BAR_W + GAP_IN_GROUP}
                  y={CHART_H - hH}
                  width={BAR_W}
                  height={Math.max(hH, 1)}
                  rx={4}
                  fill={hiredColor}
                  onMouseEnter={() =>
                    setHover({ x: gx + BAR_W + GAP_IN_GROUP, y: CHART_H - hH, label: `${label}・採用`, value: c.hired_count! })
                  }
                  onMouseLeave={() => setHover(null)}
                />
              )}
              <text x={gx + groupW / 2 - GAP_IN_GROUP} y={CHART_H + 14} fontSize={9} fill={axisColor} textAnchor="middle">
                {c.campaign_no ? `${c.campaign_no}回目` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="absolute pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg px-2 py-1 shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: hover.x + BAR_W / 2, top: hover.y - 6 }}
        >
          {hover.label}: {hover.value}人
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
