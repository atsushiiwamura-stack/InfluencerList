import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { useAppStore } from "../store/useAppStore";
import { influencerIcon, salonIcon, salonIconSelected, createClusterIcon } from "./markerIcons";
import { influencerTooltipHtml } from "./tooltipHtml";
import type { Influencer, Salon } from "../types";

// 沖縄・小笠原まで含む日本全体がちょうど収まる範囲。この外にはパンできない。
const JAPAN_BOUNDS: [[number, number], [number, number]] = [
  [20.0, 122.0],
  [46.5, 150.5],
];

/**
 * インフルエンサーは1万件超になるため、react-leafletのMarker/Tooltipを
 * 1件ずつReactコンポーネントとして生成すると（旧実装）メインスレッドが
 * 長時間ブロックされ、地図タイルの表示が壊れる不具合が発生した。
 * そのためLeaflet本来のimperative APIで直接マーカー・クラスタを構築する。
 */
function InfluencerClusterLayer({ influencers, salons }: { influencers: Influencer[]; salons: Salon[] }) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 30,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      animate: true,
      iconCreateFunction: createClusterIcon("influencer") as any,
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    const markers = influencers.map((inf) => {
      const marker = L.marker([inf.latitude, inf.longitude], { icon: influencerIcon });
      marker.bindTooltip(influencerTooltipHtml(inf, salons), {
        direction: "top",
        offset: [0, -10],
        opacity: 1,
        sticky: true,
      });
      marker.on("click", () => useAppStore.getState().focusInfluencer(inf.id));
      return marker;
    });
    group.addLayers(markers);
  }, [influencers, salons]);

  return null;
}

/** 検索や一覧クリックでフォーカスされた地点に、地図をスムーズに移動させる
 *  （Googleマップの「検索して該当地点にフォーカス」体験を再現） */
function FocusHandler() {
  const map = useMap();
  const focusRequest = useAppStore((s) => s.focusRequest);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.bounds && focusRequest.bounds.length > 1) {
      map.flyToBounds(focusRequest.bounds, { padding: [90, 90], maxZoom: 16, duration: 0.6 });
    } else {
      map.flyTo([focusRequest.lat, focusRequest.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [focusRequest, map]);

  return null;
}

/** 美容室を手動追加するとき「地図をクリックして位置を指定」できるようにする */
function MapClickHandler() {
  useMapEvents({
    click: (e) => {
      useAppStore.getState().consumeMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** flexレイアウト内でのマウント直後はLeafletが実サイズを取得できず、
 *  タイルが一部しか読み込まれないまま固定されることがあるための保険。 */
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timers = [50, 300, 800].map((ms) => setTimeout(invalidate, ms));
    window.addEventListener("resize", invalidate);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

export default function MapView() {
  const influencers = useAppStore((s) => s.influencers);
  const salons = useAppStore((s) => s.salons);
  const showInfluencers = useAppStore((s) => s.showInfluencers);
  const selectedSalonId = useAppStore((s) => s.selectedSalonId);
  const focusSalon = useAppStore((s) => s.focusSalon);
  const darkMode = useAppStore((s) => s.darkMode);
  const areaReportCircles = useAppStore((s) => s.areaReportCircles);

  // CARTOの無料ベースマップ（APIキー不要）。OSM標準タイルより配色がフラットで
  // 上に重ねるピンク/青/オレンジのピンが際立つため、SaaSダッシュボード的な
  // 見やすさになる。ダークモード時は専用のダークタイルに切り替える
  // （CSSフィルターでの疑似ダーク化はにじんで汚くなるため使わない）。
  const tileUrl = darkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      bounds={JAPAN_BOUNDS}
      maxBounds={JAPAN_BOUNDS}
      maxBoundsViscosity={1.0}
      minZoom={5}
      maxZoom={18}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={true}
      preferCanvas
    >
      <TileLayer
        key={darkMode ? "dark" : "light"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
        subdomains="abcd"
        noWrap
        bounds={JAPAN_BOUNDS}
        detectRetina
      />
      <MapResizeHandler />
      <FocusHandler />
      <MapClickHandler />

      {showInfluencers && <InfluencerClusterLayer influencers={influencers} salons={salons} />}

      {areaReportCircles.map((circle, i) => (
        <Circle
          key={`area-circle-${i}-${circle.center[0]}-${circle.center[1]}`}
          center={circle.center}
          radius={circle.radiusM}
          pathOptions={{ color: circle.color, weight: 2, fillColor: circle.color, fillOpacity: 0.08 }}
        />
      ))}

      {salons.map((salon) => (
        <Marker
          key={`salon-${salon.id}`}
          position={[salon.latitude, salon.longitude]}
          icon={salon.id === selectedSalonId ? salonIconSelected : salonIcon}
          eventHandlers={{ click: () => focusSalon(salon.id) }}
        >
          <Tooltip direction="top" offset={[0, -42]} opacity={1}>
            {salon.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
