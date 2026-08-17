import type {
  Influencer,
  Salon,
  NearbyInfluencer,
  NearbySalon,
  RouteResponse,
  MetaResponse,
  UploadResult,
  InfluencerFilters,
  SalonInput,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "" || value === false) return;
    usp.set(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export function influencerFiltersToQuery(f: Partial<InfluencerFilters>) {
  return buildQuery({
    prefecture: f.prefecture,
    category: f.category,
    gender: f.gender,
    min_followers: f.minFollowers,
    min_age: f.minAge,
    max_age: f.maxAge,
    beauty_only: f.beautyOnly,
    tokyo23_only: f.tokyo23Only,
    good_access_only: f.goodAccessOnly,
    q: f.q,
  });
}

export const api = {
  getInfluencers: (filters: Partial<InfluencerFilters> = {}) =>
    request<Influencer[]>(`/api/influencers${influencerFiltersToQuery(filters)}`),

  getSalons: () => request<Salon[]>("/api/salons"),

  getMeta: () => request<MetaResponse>("/api/meta"),

  getSalonRanking: (salonId: number, limit = 10) =>
    request<NearbyInfluencer[]>(`/api/salons/${salonId}/ranking?limit=${limit}`),

  getNearbySalonsForInfluencer: (influencerId: number, limit = 10) =>
    request<NearbySalon[]>(`/api/influencers/${influencerId}/nearby-salons?limit=${limit}`),

  getRoute: (lat: number, lon: number) => request<RouteResponse>(`/api/route?lat=${lat}&lon=${lon}`),

  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  uploadInfluencers: (file: File, token: string) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>("/api/influencers/upload", {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  uploadSalons: (file: File, token: string) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>("/api/salons/upload", {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  createSalon: (payload: SalonInput, token: string) =>
    request<Salon>("/api/salons", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateSalon: (id: number, payload: SalonInput, token: string) =>
    request<Salon>(`/api/salons/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteSalon: (id: number, token: string) =>
    request<{ ok: boolean }>(`/api/salons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
};
