import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export default function SearchBar() {
  const salons = useAppStore((s) => s.salons);
  const focusSalon = useAppStore((s) => s.focusSalon);
  const areaReportOpen = useAppStore((s) => s.areaReportOpen);
  const setAreaReportOpen = useAppStore((s) => s.setAreaReportOpen);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return salons.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, salons]);

  const select = (id: number, name: string) => {
    focusSalon(id);
    setQuery(name);
    setOpen(false);
  };

  return (
    <div className="absolute top-4 left-4 z-[500] flex items-start gap-2">
      <div className="w-[320px] sm:w-[360px]">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200/70 dark:border-slate-700 px-4 h-11">
          <span className="text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="美容室を検索（店舗名）"
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {open && results.length > 0 && (
          <div className="mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200/70 dark:border-slate-700 overflow-hidden">
            {results.map((s) => (
              <button
                key={s.id}
                onMouseDown={() => select(s.id, s.name)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              >
                <span className="text-sky-500">✂️</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                  <div className="text-xs text-slate-400 truncate">{s.address || s.station || ""}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setAreaReportOpen(!areaReportOpen)}
        className={`flex items-center gap-1.5 h-11 px-4 rounded-full shadow-lg border text-sm font-medium whitespace-nowrap transition ${
          areaReportOpen
            ? "bg-brand-600 border-brand-600 text-white"
            : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
      >
        📊 エリアレポート
      </button>
    </div>
  );
}
