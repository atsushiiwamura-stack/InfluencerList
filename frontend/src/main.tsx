import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./index.css";
import App from "./App";

// React.StrictModeはreact-leafletのMapContainerを開発時に二重マウントさせ、
// 同一DOMに2つのLeafletマップが初期化されて表示が壊れる既知の問題があるため使用しない。
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
