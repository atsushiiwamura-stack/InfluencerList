import { useState, type FormEvent } from "react";
import { useAppStore } from "../store/useAppStore";

export default function LoginModal() {
  const open = useAppStore((s) => s.loginModalOpen);
  const setOpen = useAppStore((s) => s.setLoginModalOpen);
  const login = useAppStore((s) => s.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[320px] p-6">
        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">管理者ログイン</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ユーザー名"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-sm text-slate-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-brand-600 text-white py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </div>
        </form>
        <p className="text-[11px] text-slate-400 mt-3">
          初期値: admin / changeme123（環境変数 LEMONMAP_ADMIN_USER / LEMONMAP_ADMIN_PASSWORD で変更可能）
        </p>
      </div>
    </div>
  );
}
