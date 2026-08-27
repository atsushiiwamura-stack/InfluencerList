import { findLineSymbol } from "../utils/lineSymbols";

interface Props {
  lineName: string;
  active?: boolean;
  onClick?: () => void;
}

/** Googleマップの駅ナンバリング風、路線ごとの色付きアイコンバッジ。
 *  主要路線として登録が無い場合は、路線名テキストのバッジにフォールバックする。 */
export default function LineBadge({ lineName, active, onClick }: Props) {
  const symbol = findLineSymbol(lineName);
  const clickable = !!onClick;

  if (symbol) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        title={lineName}
        className={`inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[11px] font-medium transition ${
          clickable ? "cursor-pointer hover:brightness-95" : "cursor-default"
        } ${active ? "ring-2 ring-offset-1 ring-brand-400 dark:ring-offset-slate-900" : ""}`}
        style={{ backgroundColor: active ? symbol.color : `${symbol.color}1a`, color: active ? "#fff" : symbol.color }}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-[4px] text-[9px] font-bold text-white leading-none"
          style={{ backgroundColor: symbol.color }}
        >
          {symbol.code}
        </span>
        {lineName}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={lineName}
      className={`text-[11px] px-2 py-0.5 rounded-full transition ${clickable ? "cursor-pointer" : "cursor-default"} ${
        active
          ? "bg-brand-500 text-white"
          : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 hover:brightness-95"
      }`}
    >
      {lineName}
    </button>
  );
}
