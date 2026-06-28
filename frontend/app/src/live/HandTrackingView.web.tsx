import { useEffect } from "react";
import { useHandTracking } from "./useHandTracking";
import type { GestureCommandEvent } from "./gestureCommands";
import type { GripResult } from "./grip";

/**
 * Web (Expo web / react-native-web) live camera background for the cooking
 * screen. Renders a real `getUserMedia` feed with the on-device MediaPipe hand
 * skeleton drawn over it, plus a friendly status chip and polished
 * loading/permission/error states. The screen's React Native overlays (step
 * pill, coach bubble) paint on top of the feed; the blocking states below lift
 * above them (z-index) so a failed/loading camera never looks broken.
 *
 * Auto-starts on mount, prefers the rear camera, and reports tracking state up
 * via `onStatus` so the Live screen's coach line reflects what the camera
 * actually sees (hands present/steady) instead of scripted claims.
 */

export type HandTrackingStatus = {
  present: boolean;
  steady: boolean;
  handCount: number;
  status: string;
  grip: GripResult | null;
  action: string | null;
  cameraMoving: boolean;
  gesture: GestureCommandEvent | null;
};

const C = {
  canvas: "#f7faf9",
  earth950: "#0f172a",
  earth600: "#64748b",
  warm: "#d97706",
  warmSoft: "#fdecd2",
  leaf: "#059669",
  leafSoft: "#d6f3e4",
};

const SANS = "DMSans_500Medium, system-ui, sans-serif";

export default function HandTrackingView({
  onStatus,
}: {
  onStatus?: (s: HandTrackingStatus) => void;
}) {
  const t = useHandTracking();

  useEffect(() => {
    t.start();
    // start() is idempotent; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lift tracking state up to the Live screen.
  useEffect(() => {
    onStatus?.({
      present: t.present,
      steady: t.steady,
      handCount: t.handCount,
      status: t.status,
      grip: t.grip,
      action: t.action?.action ?? null,
      cameraMoving: t.cameraMoving,
      gesture: t.gesture,
    });
  }, [t.present, t.steady, t.handCount, t.status, t.grip, t.action, t.cameraMoving, t.gesture, onStatus]);

  // Mirror only the front camera; a rear ("environment") feed must not be flipped.
  const mirror = t.facing !== "environment";

  const chip = !t.present
    ? { label: "Show me your hands", fg: C.canvas, bg: "rgba(0,0,0,0.35)", dot: "rgba(255,255,255,0.8)", pulse: false }
    : t.steady
      ? { label: "Tracking locked", fg: C.leaf, bg: C.leafSoft, dot: C.leaf, pulse: false }
      : { label: "Hold steady…", fg: C.warm, bg: C.warmSoft, dot: C.warm, pulse: true };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#241a12" }}>
      <style>{KEYFRAMES}</style>

      {/* feed + landmark overlay, mirrored together (front cam only) */}
      <div style={{ position: "absolute", inset: 0, transform: mirror ? "scaleX(-1)" : "none" }}>
        <video
          ref={t.videoRef}
          muted
          playsInline
          autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas
          ref={t.canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>

      {/* legibility scrims for the overlays that sit on top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(20,12,6,0.45) 0%, transparent 22%, transparent 60%, rgba(20,12,6,0.55) 100%)",
        }}
      />

      {/* flip camera (front/rear) — placed under the back button, clear of other controls */}
      {t.status === "tracking" && (
        <button
          onClick={t.flip}
          aria-label="Switch camera"
          style={{
            position: "absolute",
            top: 76,
            left: 16,
            zIndex: 20,
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.35)",
            color: C.canvas,
            fontSize: 17,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          ⟲
        </button>
      )}

      {/* live tracking status chip */}
      {t.status === "tracking" && (
        <div
          style={{
            position: "absolute",
            bottom: "23%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            borderRadius: 999,
            background: chip.bg,
            color: chip.fg,
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            backdropFilter: "blur(8px)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            transition: "background 200ms ease, color 200ms ease",
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
            {chip.pulse && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  background: chip.dot,
                  opacity: 0.7,
                  animation: "remyPing 1.2s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
            )}
            <span style={{ position: "relative", width: 8, height: 8, borderRadius: 999, background: chip.dot }} />
          </span>
          {chip.label}
        </div>
      )}

      {/* blocking states: loading / permission / error — lifted above RN overlays */}
      {t.status !== "tracking" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(20,12,6,0.55)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 12,
              padding: 24,
              borderRadius: 24,
              background: "rgba(252,250,247,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {t.status === "error" ? (
              <>
                <IconCircle>⚠️</IconCircle>
                <Title>Camera unavailable</Title>
                <Body>{t.error ?? "Permission was denied."}</Body>
                <Button onClick={t.start}>Try again</Button>
              </>
            ) : t.status === "idle" ? (
              <>
                <IconCircle>📷</IconCircle>
                <Title>Show Remy your hands</Title>
                <Body>Frames are processed on-device and never leave your browser.</Body>
                <Button onClick={t.start}>Start camera</Button>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    border: "3px solid rgba(252,250,247,0.25)",
                    borderTopColor: C.canvas,
                    animation: "remySpin 0.8s linear infinite",
                  }}
                />
                <Body>
                  {t.status === "loading-model"
                    ? "Warming up the on-device model…"
                    : "Allow camera access to start tracking…"}
                </Body>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes remySpin { to { transform: rotate(360deg); } }
@keyframes remyPing { 75%, 100% { transform: scale(2.2); opacity: 0; } }
`;

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        display: "grid",
        placeItems: "center",
        borderRadius: 999,
        background: C.warmSoft,
        fontSize: 22,
      }}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, color: C.canvas, fontFamily: "SpaceGrotesk_600SemiBold, system-ui, sans-serif", fontSize: 21, fontWeight: 600 }}>
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, color: "rgba(252,250,247,0.72)", fontFamily: SANS, fontSize: 13, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 4,
        padding: "11px 20px",
        borderRadius: 16,
        border: "none",
        cursor: "pointer",
        background: C.canvas,
        color: C.earth950,
        fontFamily: SANS,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
