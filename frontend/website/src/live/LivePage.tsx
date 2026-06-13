import { ArrowLeft, Camera, Hand, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandTracking } from "./useHandTracking";

export default function LivePage() {
  const t = useHandTracking();
  const live = t.status === "tracking";

  const chip = !t.present
    ? { label: "Show me your hands", cls: "bg-white/15 text-canvas ring-white/20" }
    : t.steady
      ? { label: "Tracking locked", cls: "bg-leaf-soft text-leaf ring-leaf/30" }
      : { label: "Hold steady…", cls: "bg-warm-soft text-warm ring-warm/30" };

  const coach = !t.present
    ? "Bring your hands into frame to begin."
    : t.steady
      ? "Nice and steady — I can see your hands clearly."
      : "Hold steady for a moment so I can lock on.";

  return (
    <div className="min-h-dvh bg-canvas font-sans text-earth-950 antialiased">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-earth-700 hover:text-earth-950">
          <ArrowLeft className="size-4" /> Back
        </a>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-warm">
          <Sparkles className="size-3" /> Live coach · on-device
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="font-serif text-3xl leading-tight md:text-4xl">Hand-tracking, on your device.</h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-earth-600">
          Your camera never leaves the browser. Remy tracks 21 hand landmarks per hand at ~30fps and
          waits for a steady shot before it coaches — the foundation for live grip &amp; technique tips.
        </p>

        {/* Camera viewport */}
        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-[28px] bg-earth-950 shadow-2xl shadow-earth-950/20 ring-1 ring-black/10">
          {/* Mirrored layer: feed + landmark overlay move together */}
          <div className="absolute inset-0 -scale-x-100">
            <video
              ref={t.videoRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />
            <canvas ref={t.canvasRef} className="absolute inset-0 h-full w-full" />
          </div>

          {/* Live overlays (not mirrored) */}
          {live && (
            <>
              <div className="absolute left-1/2 top-5 -translate-x-1/2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ring-1 backdrop-blur",
                    chip.cls,
                  )}
                >
                  <span className="relative flex size-2">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full rounded-full opacity-70",
                        t.present && !t.steady && "animate-ping bg-warm",
                        t.steady && "bg-leaf",
                        !t.present && "bg-white/60",
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex size-2 rounded-full",
                        t.steady ? "bg-leaf" : t.present ? "bg-warm" : "bg-white/70",
                      )}
                    />
                  </span>
                  {chip.label}
                </span>
              </div>

              {/* Coach bubble */}
              <div className="absolute inset-x-4 bottom-4 flex gap-2.5 rounded-[20px] bg-white/95 p-3.5 shadow-xl ring-1 ring-black/5 backdrop-blur">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-warm-soft">
                  <Hand className="size-4 text-warm" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-earth-600">
                    Coach · live
                  </p>
                  <p className="text-[13px] leading-snug text-earth-950">{coach}</p>
                </div>
              </div>

              {/* Debug HUD */}
              <div className="absolute right-4 top-5 rounded-xl bg-black/30 px-2.5 py-1.5 text-right font-mono text-[10px] leading-tight text-white/90 ring-1 ring-white/10 backdrop-blur">
                <div>{t.handCount} hand{t.handCount === 1 ? "" : "s"}</div>
                <div>motion {t.motion.toFixed(3)}</div>
                <div>{t.fps} fps</div>
              </div>
            </>
          )}

          {/* Non-tracking states */}
          {!live && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              {t.status === "error" ? (
                <div className="max-w-xs space-y-3">
                  <div className="mx-auto grid size-12 place-items-center rounded-full bg-warm-soft">
                    <ShieldAlert className="size-6 text-warm" />
                  </div>
                  <p className="font-serif text-xl text-canvas">Camera unavailable</p>
                  <p className="text-[13px] leading-relaxed text-canvas/70">{t.error}</p>
                  <button
                    onClick={t.start}
                    className="inline-flex items-center gap-2 rounded-2xl bg-warm px-5 py-3 text-sm font-semibold text-white ring-4 ring-warm/10"
                  >
                    <Camera className="size-4" /> Try again
                  </button>
                </div>
              ) : t.status === "idle" ? (
                <div className="max-w-xs space-y-3">
                  <div className="mx-auto grid size-12 place-items-center rounded-full bg-warm-soft">
                    <Camera className="size-6 text-warm" />
                  </div>
                  <p className="font-serif text-xl text-canvas">Show Remy your hands</p>
                  <p className="text-[13px] leading-relaxed text-canvas/70">
                    We&apos;ll ask for camera access. Frames are processed on-device and never leave
                    your browser.
                  </p>
                  <button
                    onClick={t.start}
                    className="inline-flex items-center gap-2 rounded-2xl bg-canvas px-5 py-3 text-sm font-semibold text-earth-950 active:scale-[0.98]"
                  >
                    <Camera className="size-4" /> Start camera
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-canvas/80">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                  <p className="text-[13px]">
                    {t.status === "loading-model"
                      ? "Warming up the on-device model…"
                      : "Waiting for camera permission…"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-earth-600">
          Powered by MediaPipe Hand Landmarker (WASM) — no server, no upload.
        </p>
      </main>
    </div>
  );
}
