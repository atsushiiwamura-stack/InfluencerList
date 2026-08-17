// 1万件超のマーカーに対してReactコンポーネントを1つずつマウントすると
// メインスレッドが固まり地図タイルの再計算が阻害される（表示が断片化する原因）。
// そのためインフルエンサーのツールチップはReactを介さず、文字列HTMLを直接
// Leafletのバインドツールチップに渡す。className はTailwindの静的スキャンで
// 認識されるよう、既存コンポーネントと同じユーティリティクラス文字列を使う。
import type { Influencer, Salon } from "../types";
import { haversineMeters, formatDistance, influencerLabel } from "../utils/geo";

function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function influencerTooltipHtml(influencer: Influencer, salons: Salon[]): string {
  const nearby = salons
    .map((s) => ({ s, dist: haversineMeters(influencer.latitude, influencer.longitude, s.latitude, s.longitude) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  const precisionBadge =
    influencer.location_precision !== "exact"
      ? '<span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">位置は概算</span>'
      : "";

  const nearbyHtml = nearby.length
    ? `<ul class="space-y-0.5">${nearby
        .map(({ s, dist }) => `<li class="text-slate-600">・${esc(s.name)} ${formatDistance(dist)}</li>`)
        .join("")}</ul>`
    : '<div class="text-slate-400">周辺データなし</div>';

  return `
    <div class="hover-card">
      <div class="flex items-center gap-1.5 mb-1">
        <span class="text-influencer">📷</span>
        <span class="font-bold text-slate-800">${esc(influencerLabel(influencer.name, influencer.id))}</span>
        ${precisionBadge}
      </div>
      <div class="text-slate-600 space-y-0.5">
        <div>Instagram：${esc(influencer.instagram_url) || "未登録"}</div>
        <div>フォロワー：${influencer.followers ? `${influencer.followers.toLocaleString()}人` : "未登録"}</div>
        <div>ジャンル：${esc(influencer.category) || "未登録"}</div>
        <div>所在地：${esc(influencer.prefecture)}${esc(influencer.city)}</div>
      </div>
      <div class="border-t border-slate-200 my-1.5"></div>
      <div class="font-semibold text-slate-700 mb-0.5">近くの美容室</div>
      ${nearbyHtml}
    </div>
  `;
}
