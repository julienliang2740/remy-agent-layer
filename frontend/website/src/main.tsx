import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

// Lazy so the MediaPipe/WASM-heavy live demo is code-split out of the landing bundle.
const LivePage = lazy(() => import("./live/LivePage"));

const isLive =
  window.location.pathname === "/live" || window.location.hash === "#/live";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isLive ? (
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <LivePage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
