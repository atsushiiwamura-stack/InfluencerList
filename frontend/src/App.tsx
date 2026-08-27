import { useEffect } from "react";
import { useAppStore } from "./store/useAppStore";
import MapView from "./components/MapView";
import SearchBar from "./components/SearchBar";
import FloatingControls from "./components/FloatingControls";
import FilterPopover from "./components/FilterPopover";
import DetailCard from "./components/DetailCard";
import AddSalonModal from "./components/AddSalonModal";
import LoginModal from "./components/LoginModal";
import CsvUploadModal from "./components/CsvUploadModal";
import AreaReportPanel from "./components/AreaReportPanel";
import LineStatsPanel from "./components/LineStatsPanel";

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);
  const fetchAll = useAppStore((s) => s.fetchAll);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="h-screen w-screen relative bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <MapView />

      <SearchBar />
      <FloatingControls />
      <FilterPopover />
      <DetailCard />
      <AddSalonModal />
      <AreaReportPanel />
      <LineStatsPanel />

      {loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[600] bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-1.5 text-xs text-slate-500 dark:text-slate-300">
          読み込み中...
        </div>
      )}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[600] bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 shadow-lg rounded-full px-4 py-1.5 text-xs">
          {error}
        </div>
      )}

      <LoginModal />
      <CsvUploadModal />
    </div>
  );
}
