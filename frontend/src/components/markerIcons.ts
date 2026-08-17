import L from "leaflet";

// インフルエンサー = 丸い「顔アイコン」（Googleマップの人物レイヤー風）
export const influencerIcon = L.divIcon({
  className: "",
  html: '<div class="marker-face">🙂</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// 美容室 = ティアドロップ型のピン（Googleマップの場所ピン風）
export const salonIcon = L.divIcon({
  className: "",
  html: '<div class="marker-pin-wrap"><div class="marker-pin-drop"><span class="marker-pin-glyph">✂️</span></div></div>',
  iconSize: [34, 46],
  iconAnchor: [17, 44],
});

export const salonIconSelected = L.divIcon({
  className: "",
  html: '<div class="marker-pin-wrap marker-pin-wrap--selected"><div class="marker-pin-drop marker-pin-drop--selected"><span class="marker-pin-glyph">✂️</span></div></div>',
  iconSize: [40, 54],
  iconAnchor: [20, 52],
});

export function createClusterIcon(kind: "influencer" | "salon") {
  return (cluster: { getChildCount: () => number }) => {
    const count = cluster.getChildCount();
    const size = count < 20 ? 34 : count < 100 ? 42 : 52;
    const bg = kind === "influencer" ? "#ec4899" : "#0ea5e9";
    return L.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${bg};border:3px solid white;color:white;font-weight:700;font-size:13px;box-shadow:0 3px 10px rgba(0,0,0,0.35);">${count}</div>`,
      className: "",
      iconSize: [size, size],
    });
  };
}
