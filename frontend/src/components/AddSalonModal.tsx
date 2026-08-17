import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { SalonInput } from "../types";

const EMPTY: SalonInput = {
  name: "",
  address: "",
  station: "",
  line: "",
  category: "",
  price_range: "",
  business_hours: "",
  instagram: "",
  is_premium: false,
  model_recruit_experience: false,
  latitude: null,
  longitude: null,
};

export default function AddSalonModal() {
  const open = useAppStore((s) => s.salonModalOpen);
  const editingSalon = useAppStore((s) => s.editingSalon);
  const closeModal = useAppStore((s) => s.closeSalonModal);
  const createSalon = useAppStore((s) => s.createSalon);
  const updateSalon = useAppStore((s) => s.updateSalon);
  const deleteSalon = useAppStore((s) => s.deleteSalon);
  const setPendingPinDrop = useAppStore((s) => s.setPendingPinDrop);
  const pendingPinDrop = useAppStore((s) => s.pendingPinDrop);

  const [form, setForm] = useState<SalonInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingSalon) {
      setForm({
        name: editingSalon.name,
        address: editingSalon.address || "",
        station: editingSalon.station || "",
        line: editingSalon.line || "",
        category: editingSalon.category || "",
        price_range: editingSalon.price_range || "",
        business_hours: editingSalon.business_hours || "",
        instagram: editingSalon.instagram || "",
        is_premium: editingSalon.is_premium,
        model_recruit_experience: editingSalon.model_recruit_experience,
        latitude: editingSalon.latitude,
        longitude: editingSalon.longitude,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [editingSalon, open]);

  if (!open) return null;

  const set = <K extends keyof SalonInput>(key: K, value: SalonInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const startPinDrop = () => {
    setPendingPinDrop((lat, lon) => {
      set("latitude", lat);
      set("longitude", lon);
    });
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("店舗名は必須です");
      return;
    }
    if (!form.address?.trim() && (form.latitude == null || form.longitude == null)) {
      setError("住所、または地図クリックによる位置指定のいずれかが必要です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingSalon) {
        await updateSalon(editingSalon.id, form);
      } else {
        await createSalon(form);
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingSalon) return;
    if (!window.confirm(`「${editingSalon.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await deleteSalon(editingSalon.id);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute top-16 left-4 z-[600] w-[340px] max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
          {editingSalon ? "美容室を編集" : "美容室を追加"}
        </h2>
        <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 text-sm">
          ✕
        </button>
      </div>

      <div className="space-y-2.5">
        <Field label="店舗名 *" value={form.name} onChange={(v) => set("name", v)} placeholder="Lemon Hair 渋谷店" />
        <Field label="住所" value={form.address} onChange={(v) => set("address", v)} placeholder="東京都渋谷区..." />

        <div>
          <button
            onClick={startPinDrop}
            className={`w-full text-xs rounded-lg border px-3 py-2 ${
              pendingPinDrop
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {pendingPinDrop
              ? "📍 地図をクリックして位置を指定してください..."
              : "📍 地図をクリックして正確な位置を指定（任意・精度UP）"}
          </button>
          {form.latitude != null && form.longitude != null && (
            <p className="text-[11px] text-emerald-600 mt-1">
              指定済み: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Field label="最寄駅" value={form.station} onChange={(v) => set("station", v)} placeholder="渋谷" />
          <Field label="路線" value={form.line} onChange={(v) => set("line", v)} placeholder="JR山手線" />
        </div>
        <Field label="得意ジャンル" value={form.category} onChange={(v) => set("category", v)} placeholder="ヘア,カラー" />
        <div className="flex gap-2">
          <Field label="価格帯" value={form.price_range} onChange={(v) => set("price_range", v)} placeholder="¥¥¥" />
          <Field label="営業時間" value={form.business_hours} onChange={(v) => set("business_hours", v)} placeholder="10:00-20:00" />
        </div>
        <Field label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} placeholder="@your_salon" />

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!form.is_premium} onChange={(e) => set("is_premium", e.target.checked)} />
          高級店
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={!!form.model_recruit_experience}
            onChange={(e) => set("model_recruit_experience", e.target.checked)}
          />
          カットモデル募集経験あり
        </label>
      </div>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      <div className="flex gap-2 mt-4">
        {editingSalon && (
          <button
            onClick={remove}
            disabled={saving}
            className="text-xs rounded-lg border border-red-200 text-red-600 px-3 py-2 hover:bg-red-50 disabled:opacity-50"
          >
            削除
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-lg bg-brand-600 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "保存中..." : editingSalon ? "更新する" : "追加する"}
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        住所のみの場合は市区町村レベルの概算位置になります。地図クリックで指定するとその位置が優先されます。
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block flex-1">
      <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
      />
    </label>
  );
}
