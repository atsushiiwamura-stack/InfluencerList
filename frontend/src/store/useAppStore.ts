import { create } from "zustand";
import { api } from "../api/client";
import type {
  Influencer,
  Salon,
  MetaResponse,
  InfluencerFilters,
  NearbyInfluencer,
  NearbySalon,
  SalonInput,
} from "../types";

const DEFAULT_INFLUENCER_FILTERS: InfluencerFilters = {
  prefecture: "",
  category: "",
  gender: "",
  minFollowers: null,
  minAge: null,
  maxAge: null,
  beautyOnly: false,
  tokyo23Only: false,
  goodAccessOnly: false,
  q: "",
};

export interface FocusRequest {
  lat: number;
  lon: number;
  bounds?: [number, number][];
  key: number; // 同じ地点でも再フォーカスできるようにするための識別子
}

export interface AreaCircle {
  center: [number, number];
  radiusM: number;
  color: string;
}

interface AppState {
  influencers: Influencer[];
  salons: Salon[];
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;

  influencerFilters: InfluencerFilters;
  showInfluencers: boolean;

  darkMode: boolean;
  authToken: string | null;

  selectedSalonId: number | null;
  selectedInfluencerId: number | null;
  currentRanking: NearbyInfluencer[];
  currentNearbySalons: NearbySalon[];
  detailLoading: boolean;

  focusRequest: FocusRequest | null;
  pendingPinDrop: ((lat: number, lon: number) => void) | null;

  filterPopoverOpen: boolean;
  loginModalOpen: boolean;
  uploadModalOpen: boolean;
  salonModalOpen: boolean;
  editingSalon: Salon | null;
  areaReportOpen: boolean;
  areaReportCircles: AreaCircle[];

  fetchMeta: () => Promise<void>;
  fetchInfluencers: () => Promise<void>;
  fetchSalons: () => Promise<void>;
  fetchAll: () => Promise<void>;

  setInfluencerFilters: (partial: Partial<InfluencerFilters>) => void;
  resetFilters: () => void;
  toggleShowInfluencers: () => void;

  toggleDarkMode: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;

  focusSalon: (id: number) => Promise<void>;
  focusBounds: (points: [number, number][]) => void;
  focusInfluencer: (id: number) => Promise<void>;
  clearSelection: () => void;

  setPendingPinDrop: (fn: ((lat: number, lon: number) => void) | null) => void;
  consumeMapClick: (lat: number, lon: number) => void;

  setFilterPopoverOpen: (open: boolean) => void;
  setLoginModalOpen: (open: boolean) => void;
  setUploadModalOpen: (open: boolean) => void;
  setAreaReportOpen: (open: boolean) => void;
  setAreaReportCircles: (circles: AreaCircle[]) => void;
  clearAreaReportCircles: () => void;
  openAddSalonModal: () => void;
  openEditSalonModal: (salon: Salon) => void;
  closeSalonModal: () => void;

  createSalon: (payload: SalonInput) => Promise<void>;
  updateSalon: (id: number, payload: SalonInput) => Promise<void>;
  deleteSalon: (id: number) => Promise<void>;
}

const initialDarkMode =
  typeof window !== "undefined" &&
  (localStorage.getItem("lemonmap.darkMode") === "1" ||
    (localStorage.getItem("lemonmap.darkMode") === null &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches));

export const useAppStore = create<AppState>((set, get) => ({
  influencers: [],
  salons: [],
  meta: null,
  loading: false,
  error: null,

  influencerFilters: DEFAULT_INFLUENCER_FILTERS,
  showInfluencers: true,

  darkMode: initialDarkMode,
  authToken: typeof window !== "undefined" ? localStorage.getItem("lemonmap.token") : null,

  selectedSalonId: null,
  selectedInfluencerId: null,
  currentRanking: [],
  currentNearbySalons: [],
  detailLoading: false,

  focusRequest: null,
  pendingPinDrop: null,

  filterPopoverOpen: false,
  loginModalOpen: false,
  uploadModalOpen: false,
  salonModalOpen: false,
  editingSalon: null,
  areaReportOpen: false,
  areaReportCircles: [],

  fetchMeta: async () => {
    try {
      const meta = await api.getMeta();
      set({ meta });
    } catch (e) {
      console.error(e);
    }
  },

  fetchInfluencers: async () => {
    const data = await api.getInfluencers(get().influencerFilters);
    set({ influencers: data });
  },

  fetchSalons: async () => {
    const data = await api.getSalons();
    set({ salons: data });
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([get().fetchInfluencers(), get().fetchSalons(), get().fetchMeta()]);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "データの取得に失敗しました" });
    } finally {
      set({ loading: false });
    }
  },

  setInfluencerFilters: (partial) => {
    set((s) => ({ influencerFilters: { ...s.influencerFilters, ...partial } }));
    get().fetchInfluencers().catch((e) => set({ error: e.message }));
  },

  resetFilters: () => {
    set({ influencerFilters: DEFAULT_INFLUENCER_FILTERS });
    get().fetchInfluencers();
  },

  toggleShowInfluencers: () => set((s) => ({ showInfluencers: !s.showInfluencers })),

  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      localStorage.setItem("lemonmap.darkMode", next ? "1" : "0");
      return { darkMode: next };
    }),

  login: async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem("lemonmap.token", res.access_token);
    set({ authToken: res.access_token, loginModalOpen: false });
  },

  logout: () => {
    localStorage.removeItem("lemonmap.token");
    set({ authToken: null });
  },

  focusSalon: async (id) => {
    const salon = get().salons.find((s) => s.id === id);
    if (!salon) return;
    set({
      selectedSalonId: id,
      selectedInfluencerId: null,
      detailLoading: true,
      currentRanking: [],
    });
    try {
      const ranking = await api.getSalonRanking(id, 15);
      set({ currentRanking: ranking });
      const bounds: [number, number][] = [
        [salon.latitude, salon.longitude],
        ...ranking.slice(0, 12).map((r) => [r.influencer.latitude, r.influencer.longitude] as [number, number]),
      ];
      set({ focusRequest: { lat: salon.latitude, lon: salon.longitude, bounds, key: Date.now() } });
    } finally {
      set({ detailLoading: false });
    }
  },

  focusBounds: (points) => {
    if (points.length === 0) return;
    const [firstLat, firstLon] = points[0];
    set({ focusRequest: { lat: firstLat, lon: firstLon, bounds: points, key: Date.now() } });
  },

  focusInfluencer: async (id) => {
    const influencer = get().influencers.find((i) => i.id === id);
    if (!influencer) return;
    set({
      selectedInfluencerId: id,
      selectedSalonId: null,
      detailLoading: true,
      currentNearbySalons: [],
    });
    try {
      const nearby = await api.getNearbySalonsForInfluencer(id, 10);
      set({ currentNearbySalons: nearby });
      set({
        focusRequest: { lat: influencer.latitude, lon: influencer.longitude, key: Date.now() },
      });
    } finally {
      set({ detailLoading: false });
    }
  },

  clearSelection: () => set({ selectedSalonId: null, selectedInfluencerId: null }),

  setPendingPinDrop: (fn) => set({ pendingPinDrop: fn }),
  consumeMapClick: (lat, lon) => {
    const fn = get().pendingPinDrop;
    if (fn) {
      fn(lat, lon);
      set({ pendingPinDrop: null });
    }
  },

  setFilterPopoverOpen: (open) => set({ filterPopoverOpen: open }),
  setUploadModalOpen: (open) => set({ uploadModalOpen: open }),
  setAreaReportOpen: (open) => {
    set({ areaReportOpen: open });
    if (!open) set({ areaReportCircles: [] });
  },
  setAreaReportCircles: (circles) => set({ areaReportCircles: circles }),
  clearAreaReportCircles: () => set({ areaReportCircles: [] }),
  setLoginModalOpen: (open) => set({ loginModalOpen: open }),
  openAddSalonModal: () => set({ salonModalOpen: true, editingSalon: null }),
  openEditSalonModal: (salon) => set({ salonModalOpen: true, editingSalon: salon }),
  closeSalonModal: () => set({ salonModalOpen: false, editingSalon: null, pendingPinDrop: null }),

  createSalon: async (payload) => {
    const token = get().authToken;
    if (!token) throw new Error("管理者ログインが必要です");
    await api.createSalon(payload, token);
    await get().fetchSalons();
  },

  updateSalon: async (id, payload) => {
    const token = get().authToken;
    if (!token) throw new Error("管理者ログインが必要です");
    await api.updateSalon(id, payload, token);
    await get().fetchSalons();
  },

  deleteSalon: async (id) => {
    const token = get().authToken;
    if (!token) throw new Error("管理者ログインが必要です");
    await api.deleteSalon(id, token);
    await get().fetchSalons();
    get().clearSelection();
  },
}));
