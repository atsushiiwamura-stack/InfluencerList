export interface Influencer {
  id: number;
  name: string | null;
  instagram_url: string | null;
  followers: number | null;
  category: string | null;
  age: number | null;
  gender: string | null;
  prefecture: string;
  city: string;
  address: string | null;
  coverage_areas: string | null;
  past_projects: number | null;
  latitude: number;
  longitude: number;
  location_precision: "exact" | "city" | "prefecture" | "unknown";
  profile_image_url: string | null;
  source: "excel_import" | "csv_upload";
  updated_at: string | null;
}

export interface Salon {
  id: number;
  name: string;
  address: string | null;
  station: string | null;
  line: string | null;
  category: string | null;
  price_range: string | null;
  business_hours: string | null;
  instagram: string | null;
  google_map_url: string | null;
  is_premium: boolean;
  model_recruit_experience: boolean;
  latitude: number;
  longitude: number;
  is_sample: boolean;
}

export interface ScoreBreakdown {
  distance_score: number;
  beauty_fit_score: number;
  follower_score: number;
  experience_score: number;
  total_score: number;
}

export interface NearbyInfluencer {
  influencer: Influencer;
  distance_m: number;
  walking_minutes: number;
  score: number;
  score_breakdown: ScoreBreakdown;
}

export interface NearbySalon {
  salon: Salon;
  distance_m: number;
  walking_minutes: number;
}

export interface StationEntry {
  station: string;
  prefecture: string | null;
  lines: string[];
  distance_m: number;
  walking_minutes: number;
}

export interface RouteResponse {
  stations: StationEntry[];
  error: string | null;
}

export interface MetaResponse {
  prefectures: string[];
  influencer_categories: string[];
  salon_categories: string[];
  lines: string[];
  stations: string[];
  influencer_count: number;
  salon_count: number;
}

export interface UploadResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface InfluencerFilters {
  prefecture: string;
  category: string;
  gender: string;
  minFollowers: number | null;
  minAge: number | null;
  maxAge: number | null;
  beautyOnly: boolean;
  tokyo23Only: boolean;
  goodAccessOnly: boolean;
  q: string;
}

export interface SalonInput {
  name: string;
  address: string;
  station?: string;
  line?: string;
  category?: string;
  price_range?: string;
  business_hours?: string;
  instagram?: string;
  google_map_url?: string;
  is_premium?: boolean;
  model_recruit_experience?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}
