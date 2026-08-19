import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { api } from "../api/client";
import type { Campaign, CampaignInput } from "../types";
import CampaignChart from "./CampaignChart";

const EMPTY: CampaignInput = {
  campaign_no: null,
  title: "",
  menu: "",
  start_date: "",
  end_date: "",
  applicant_count: null,
  hired_count: null,
  notes: "",
};

const MENU_TAGS = ["カット", "カラー", "パーマ", "縮毛矯正", "眉カット", "トリートメント", "ヘッドスパ"];

export default function CampaignSection({ salonId }: { salonId: number }) {
  const authToken = useAppStore((s) => s.authToken);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    api
      .getCampaigns(salonId)
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [salonId]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, campaign_no: campaigns.length + 1 });
    setFormOpen(true);
    setError(null);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      campaign_no: c.campaign_no,
      title: c.title || "",
      menu: c.menu || "",
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      applicant_count: c.applicant_count,
      hired_count: c.hired_count,
      notes: c.notes || "",
    });
    setFormOpen(true);
    setError(null);
  };

  const toggleMenuTag = (tag: string) => {
    const current = (form.menu || "").split(",").map((t) => t.trim()).filter(Boolean);
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setForm((f) => ({ ...f, menu: next.join(",") }));
  };

  const submit = async () => {
    if (!authToken) return;
    setSaving(true);
    setError(null);
    try {
      const payload: CampaignInput = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (editing) {
        await api.updateCampaign(editing.id, payload, authToken);
      } else {
        await api.createCampaign(salonId, payload, authToken);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Campaign) => {
    if (!authToken) return;
    if (!window.confirm(`「${c.title || `${c.campaign_no}回目`}」を削除しますか？`)) return;
    await api.deleteCampaign(c.id, authToken);
    reload();
  };

  const avg =
    campaigns.filter((c) => c.applicant_count != null).length > 0
      ? Math.round(
          (campaigns.reduce((sum, c) => sum + (c.applicant_count ?? 0), 0) /
            campaigns.filter((c) => c.applicant_count != null).length) *
            10
        ) / 10
      : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">📊 募集キャンペーン履歴</h4>
        {authToken && (
          <button onClick={openAdd} className="text-xs text-brand-600 hover:underline">
            + 記録を追加
          </button>
        )}
      </div>

      {loading && <div className="text-sm text-slate-400">読み込み中...</div>}

      {!loading && campaigns.length === 0 && (
        <p className="text-sm text-slate-400">まだキャンペーン記録がありません。</p>
      )}

      {!loading && campaigns.length > 0 && (
        <>
          {avg != null && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              平均応募人数：<span className="font-bold text-slate-700 dark:text-slate-200">{avg}人</span>
              （過去{campaigns.length}回の実績）
            </div>
          )}
          <CampaignChart campaigns={campaigns} />
          <div className="space-y-1.5 mt-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {c.campaign_no ? `${c.campaign_no}回目　` : ""}
                    {c.title || ""}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {c.start_date || "時期未登録"}
                    {c.end_date ? `〜${c.end_date}` : ""}
                    {c.menu ? `・${c.menu}` : ""}
                    {c.applicant_count != null ? `・応募${c.applicant_count}人` : ""}
                    {c.hired_count != null ? `・採用${c.hired_count}人` : ""}
                  </div>
                </div>
                {authToken && (
                  <div className="flex gap-2 flex-shrink-0 ml-2">
                    <button onClick={() => openEdit(c)} className="text-brand-600 hover:underline">
                      編集
                    </button>
                    <button onClick={() => remove(c)} className="text-red-500 hover:underline">
                      削除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-2">
            <MiniField label="何回目" type="number" value={form.campaign_no ?? ""} onChange={(v) => setForm((f) => ({ ...f, campaign_no: v === "" ? null : Number(v) }))} />
            <MiniField label="キャンペーン名" value={form.title ?? ""} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="秋の新メニューPR" />
          </div>
          <div className="flex gap-2">
            <MiniField label="開始日" type="date" value={form.start_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} />
            <MiniField label="終了日" type="date" value={form.end_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, end_date: v }))} />
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">内容（複数選択可）</span>
            <div className="flex flex-wrap gap-1.5">
              {MENU_TAGS.map((tag) => {
                const active = (form.menu || "").split(",").map((t) => t.trim()).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleMenuTag(tag)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${
                      active
                        ? "bg-brand-600 text-white border-brand-600"
                        : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <MiniField label="応募人数" type="number" value={form.applicant_count ?? ""} onChange={(v) => setForm((f) => ({ ...f, applicant_count: v === "" ? null : Number(v) }))} />
            <MiniField label="採用人数" type="number" value={form.hired_count ?? ""} onChange={(v) => setForm((f) => ({ ...f, hired_count: v === "" ? null : Number(v) }))} />
          </div>
          <MiniField label="メモ" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="任意" />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setFormOpen(false)}
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 py-1.5 text-slate-500"
            >
              キャンセル
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 text-xs rounded-lg bg-brand-600 text-white py-1.5 font-medium disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MiniField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block flex-1">
      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 py-1.5 text-slate-700 dark:text-slate-200"
      />
    </label>
  );
}
