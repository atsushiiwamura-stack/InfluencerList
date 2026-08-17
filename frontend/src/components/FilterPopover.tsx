import { useAppStore } from "../store/useAppStore";

export default function FilterPopover() {
  const open = useAppStore((s) => s.filterPopoverOpen);
  const setOpen = useAppStore((s) => s.setFilterPopoverOpen);
  const meta = useAppStore((s) => s.meta);
  const filters = useAppStore((s) => s.influencerFilters);
  const setFilters = useAppStore((s) => s.setInfluencerFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const showInfluencers = useAppStore((s) => s.showInfluencers);
  const toggleShowInfluencers = useAppStore((s) => s.toggleShowInfluencers);
  const influencerCount = useAppStore((s) => s.influencers.length);
  const setUploadModalOpen = useAppStore((s) => s.setUploadModalOpen);

  if (!open) return null;

  return (
    <div className="absolute top-16 right-4 z-[500] w-[300px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-slate-700 p-4 max-h-[75vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
          インフルエンサー フィルター
        </h2>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm">
          ✕
        </button>
      </div>

      <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
        <span>📷 マーカー表示（{influencerCount.toLocaleString()}件）</span>
        <input type="checkbox" checked={showInfluencers} onChange={toggleShowInfluencers} />
      </label>

      <div className="space-y-3">
        <SelectField
          label="地域（都道府県）"
          value={filters.prefecture}
          onChange={(v) => setFilters({ prefecture: v })}
          options={meta?.prefectures ?? []}
        />
        <SelectField
          label="ジャンル"
          value={filters.category}
          onChange={(v) => setFilters({ category: v })}
          options={meta?.influencer_categories ?? []}
        />
        <SelectField
          label="性別"
          value={filters.gender}
          onChange={(v) => setFilters({ gender: v })}
          options={["女性", "男性", "その他"]}
        />
        <NumberField
          label="フォロワー数（下限）"
          value={filters.minFollowers}
          onChange={(v) => setFilters({ minFollowers: v })}
          placeholder="例: 10000"
        />
        <div className="flex gap-2">
          <NumberField label="年齢（下限）" value={filters.minAge} onChange={(v) => setFilters({ minAge: v })} placeholder="18" />
          <NumberField label="年齢（上限）" value={filters.maxAge} onChange={(v) => setFilters({ maxAge: v })} placeholder="45" />
        </div>
        <CheckboxField label="美容系のみ" checked={filters.beautyOnly} onChange={(v) => setFilters({ beautyOnly: v })} />
        <CheckboxField label="東京23区のみ" checked={filters.tokyo23Only} onChange={(v) => setFilters({ tokyo23Only: v })} />
        <CheckboxField
          label="交通アクセスが良い人（主要都市中心部）"
          checked={filters.goodAccessOnly}
          onChange={(v) => setFilters({ goodAccessOnly: v })}
        />
        <TextField label="名前で検索" value={filters.q} onChange={(v) => setFilters({ q: v })} placeholder="名前の一部を入力" />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onClick={resetFilters} className="text-xs text-brand-600 hover:underline">
          リセット
        </button>
        <button onClick={() => setUploadModalOpen(true)} className="text-xs text-slate-400 hover:text-slate-600">
          CSVで一括インポート
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
      >
        <option value="">すべて</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="block flex-1">
      <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}
