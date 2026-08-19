import { useAppStore } from "../store/useAppStore";
import { influencerLabel } from "../utils/geo";
import RouteInfo from "./RouteInfo";
import CampaignSection from "./CampaignSection";

export default function DetailCard() {
  const selectedSalonId = useAppStore((s) => s.selectedSalonId);
  const selectedInfluencerId = useAppStore((s) => s.selectedInfluencerId);
  const salons = useAppStore((s) => s.salons);
  const influencers = useAppStore((s) => s.influencers);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const currentRanking = useAppStore((s) => s.currentRanking);
  const currentNearbySalons = useAppStore((s) => s.currentNearbySalons);
  const detailLoading = useAppStore((s) => s.detailLoading);
  const authToken = useAppStore((s) => s.authToken);
  const openEditSalonModal = useAppStore((s) => s.openEditSalonModal);

  const salon = selectedSalonId != null ? salons.find((s) => s.id === selectedSalonId) : null;
  const influencer = selectedInfluencerId != null ? influencers.find((i) => i.id === selectedInfluencerId) : null;

  if (!salon && !influencer) return null;

  return (
    <div className="absolute top-4 right-4 sm:right-4 bottom-4 w-full sm:w-[380px] max-w-[calc(100%-2rem)] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200/70 dark:border-slate-700 overflow-y-auto z-[550] sm:top-16"
    >
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between rounded-t-2xl">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
          {salon ? "🏠 美容室詳細" : "📷 インフルエンサー詳細"}
        </h2>
        <div className="flex items-center gap-2">
          {salon && authToken && (
            <button
              onClick={() => openEditSalonModal(salon)}
              className="text-xs text-brand-600 hover:underline"
            >
              編集
            </button>
          )}
          <button onClick={clearSelection} className="text-slate-400 hover:text-slate-700 text-lg leading-none">
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {salon && (
          <>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{salon.name}</h3>
                {salon.is_sample && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">サンプルデータ</span>
                )}
                {salon.is_premium && (
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">高級店</span>
                )}
              </div>
              <dl className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <Row label="住所" value={salon.address} />
                <Row label="価格帯" value={salon.price_range} />
                <Row label="営業時間" value={salon.business_hours} />
                <Row label="得意ジャンル" value={salon.category} />
                <Row label="Instagram" value={salon.instagram} />
                <Row label="カットモデル募集経験" value={salon.model_recruit_experience ? "あり" : "なし"} />
              </dl>
            </div>

            <section>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">🚉 最寄駅・アクセス</h4>
              <RouteInfo lat={salon.latitude} lon={salon.longitude} />
            </section>

            <CampaignSection salonId={salon.id} />

            <section>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                🏆 近くのインフルエンサーランキング
              </h4>
              {detailLoading && <div className="text-sm text-slate-400">計算中...</div>}
              <div className="space-y-2">
                {currentRanking.map((r, idx) => (
                  <div key={r.influencer.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {idx + 1}位　{influencerLabel(r.influencer.name, r.influencer.id)}
                      </span>
                      <span className="text-brand-600 font-bold">{r.score.toFixed(0)}点</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3">
                      <span>距離 {Math.round(r.distance_m)}m（徒歩{r.walking_minutes}分）</span>
                      <span>フォロワー {r.influencer.followers ? r.influencer.followers.toLocaleString() : "未登録"}</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <ScoreBadge label="距離" value={r.score_breakdown.distance_score} />
                      <ScoreBadge label="美容適性" value={r.score_breakdown.beauty_fit_score} />
                      <ScoreBadge label="フォロワー" value={r.score_breakdown.follower_score} />
                      <ScoreBadge label="案件経験" value={r.score_breakdown.experience_score} />
                    </div>
                  </div>
                ))}
                {!detailLoading && currentRanking.length === 0 && (
                  <div className="text-sm text-slate-400">半径5km以内に該当データがありません。</div>
                )}
              </div>
            </section>
          </>
        )}

        {influencer && (
          <>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {influencerLabel(influencer.name, influencer.id)}
              </h3>
              <dl className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <Row label="Instagram" value={influencer.instagram_url || "未登録"} />
                <Row label="フォロワー" value={influencer.followers ? `${influencer.followers.toLocaleString()}人` : "未登録"} />
                <Row label="ジャンル" value={influencer.category || "未登録"} />
                <Row
                  label="年齢／性別"
                  value={`${influencer.age ? `${influencer.age}歳` : "未登録"} / ${influencer.gender || "未登録"}`}
                />
                <Row
                  label="所在地"
                  value={`${influencer.prefecture}${influencer.city}${
                    influencer.location_precision !== "exact" ? "（市区町村単位の概算位置）" : ""
                  }`}
                />
                <Row label="対応可能エリア" value={influencer.coverage_areas || "未登録"} />
              </dl>
            </div>

            <section>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">🚉 最寄駅・アクセス</h4>
              <RouteInfo lat={influencer.latitude} lon={influencer.longitude} />
            </section>

            <section>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">🏠 近くの美容室</h4>
              {detailLoading && <div className="text-sm text-slate-400">計算中...</div>}
              <div className="space-y-2">
                {currentNearbySalons.map((r) => (
                  <div key={r.salon.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{r.salon.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {Math.round(r.distance_m)}m・徒歩{r.walking_minutes}分
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {r.salon.station ? `${r.salon.station}駅` : ""} {r.salon.category || ""}
                    </div>
                  </div>
                ))}
                {!detailLoading && currentNearbySalons.length === 0 && (
                  <div className="text-sm text-slate-400">周辺の美容室データがありません。</div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="inline font-medium text-slate-500 dark:text-slate-400">{label}：</dt>
      <dd className="inline">{value || "-"}</dd>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
      {label} {value.toFixed(0)}
    </span>
  );
}
