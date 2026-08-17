import type { ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";

export default function FloatingControls() {
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const authToken = useAppStore((s) => s.authToken);
  const logout = useAppStore((s) => s.logout);
  const setLoginModalOpen = useAppStore((s) => s.setLoginModalOpen);
  const openAddSalonModal = useAppStore((s) => s.openAddSalonModal);
  const filterPopoverOpen = useAppStore((s) => s.filterPopoverOpen);
  const setFilterPopoverOpen = useAppStore((s) => s.setFilterPopoverOpen);
  const meta = useAppStore((s) => s.meta);

  return (
    <div className="absolute top-4 right-4 z-[500] flex items-center gap-2">
      {meta && (
        <div className="hidden md:flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 rounded-full shadow-lg border border-slate-200/70 dark:border-slate-700 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>📷 {meta.influencer_count.toLocaleString()}</span>
          <span className="mx-1">・</span>
          <span>✂️ {meta.salon_count.toLocaleString()}</span>
        </div>
      )}

      <IconButton
        active={filterPopoverOpen}
        label="フィルター"
        onClick={() => setFilterPopoverOpen(!filterPopoverOpen)}
      >
        🎛️
      </IconButton>

      {authToken && (
        <IconButton label="美容室を追加" onClick={openAddSalonModal} accent>
          ＋
        </IconButton>
      )}

      {authToken ? (
        <button
          onClick={logout}
          className="text-xs rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200/70 dark:border-slate-700 px-3.5 h-9 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          ログアウト
        </button>
      ) : (
        <button
          onClick={() => setLoginModalOpen(true)}
          className="text-xs rounded-full bg-brand-600 text-white px-3.5 h-9 font-medium shadow-lg"
        >
          管理者ログイン
        </button>
      )}

      <IconButton label="ダークモード切替" onClick={toggleDarkMode}>
        {darkMode ? "☀️" : "🌙"}
      </IconButton>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  active,
  accent,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-full shadow-lg border flex items-center justify-center text-sm transition ${
        accent
          ? "bg-brand-600 border-brand-600 text-white"
          : active
          ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30"
          : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
