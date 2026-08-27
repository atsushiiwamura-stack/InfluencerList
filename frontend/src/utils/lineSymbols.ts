/**
 * 主要路線の「駅ナンバリング」記号（Googleマップ等で使われる、路線ごとの色付き
 * アルファベットのアイコン）。JR東日本・東京メトロ・都営地下鉄・主要私鉄が
 * 公式に採用している記号・色を参考にしている。
 *
 * 全国の路線を網羅すると誤った記号を「公式であるかのように」表示してしまう
 * リスクがあるため、確度の高い主要路線のみを収録し、それ以外はバッジなし
 * （路線名テキストのみ）にフォールバックする。
 */
export interface LineSymbol {
  code: string;
  color: string;
}

const LINE_SYMBOLS: Record<string, LineSymbol> = {
  // 東京メトロ
  "東京メトロ銀座線": { code: "G", color: "#f39700" },
  "東京メトロ丸ノ内線": { code: "M", color: "#e60012" },
  "東京メトロ日比谷線": { code: "H", color: "#9caeb7" },
  "東京メトロ東西線": { code: "T", color: "#00a7db" },
  "東京メトロ千代田線": { code: "C", color: "#00a650" },
  "東京メトロ有楽町線": { code: "Y", color: "#c1a470" },
  "東京メトロ半蔵門線": { code: "Z", color: "#8f76d6" },
  "東京メトロ南北線": { code: "N", color: "#00ac9b" },
  "東京メトロ副都心線": { code: "F", color: "#b5764e" },

  // 都営地下鉄
  "都営浅草線": { code: "A", color: "#ee82a9" },
  "都営三田線": { code: "I", color: "#0079c2" },
  "都営新宿線": { code: "S", color: "#9cbe45" },
  "都営大江戸線": { code: "E", color: "#b6007a" },

  // JR東日本 主要路線
  "JR山手線": { code: "JY", color: "#80c241" },
  "JR中央線快速": { code: "JC", color: "#f15a22" },
  "JR中央・総武線各駅停車": { code: "JB", color: "#ffd400" },
  "JR京浜東北線": { code: "JK", color: "#00b2e5" },
  "JR東海道本線": { code: "JT", color: "#f68b1e" },
  "JR横須賀線": { code: "JO", color: "#003f8e" },
  "JR埼京線": { code: "JA", color: "#009944" },
  "JR京葉線": { code: "JE", color: "#c9252b" },
  "JR湘南新宿ライン": { code: "JS", color: "#e2148a" },

  // 主要私鉄
  "小田急小田原線": { code: "OH", color: "#1e50a2" },
  "小田急江ノ島線": { code: "OE", color: "#1e50a2" },
  "京王線": { code: "KO", color: "#dd0077" },
  "東急東横線": { code: "TY", color: "#e60012" },
  "東急田園都市線": { code: "DT", color: "#199a93" },
  "京急本線": { code: "KK", color: "#00639b" },
  "西武池袋線": { code: "SI", color: "#00a0e9" },
  "東武伊勢崎線": { code: "TS", color: "#004098" },
};

/** 前方一致・部分一致でも探す（HeartRailsの表記揺れ「JR山手線」「山手線」等を吸収するため） */
export function findLineSymbol(lineName: string): LineSymbol | null {
  if (LINE_SYMBOLS[lineName]) return LINE_SYMBOLS[lineName];
  const stripped = lineName.replace(/^JR/, "").trim();
  for (const [key, symbol] of Object.entries(LINE_SYMBOLS)) {
    const keyStripped = key.replace(/^JR/, "").trim();
    if (keyStripped === stripped) return symbol;
  }
  return null;
}
