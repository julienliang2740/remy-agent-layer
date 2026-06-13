# Screen states audit (D5)

Every screen has explicit loading / error / empty handling; nothing renders
blank on failure. File references are to `frontend/app/src/App.tsx` unless noted.

| Screen | Loading | Error | Empty | Recovery path |
|--------|---------|-------|-------|---------------|
| **App root** | font-load returns a canvas `loading` view, not blank | `ErrorBoundary` class catches any render crash → "Something went sideways" card | — | "Try again" button resets the boundary |
| **Onboarding** | (instant) | — | — | "Let's cook" → Home |
| **Home** | — | — | No saved recipes → "Nothing saved yet" tile; no resume → "Cook something new" tile | tiles route to Setup |
| **Setup / scan** | scan shows "🔎 Looking for ingredients…" + animated bar | scan failure → labeled **"Offline sample scan"** + **Retry live** button | review step handles **0 spotted** ("Nothing recognizable… add by hand") | Retry live / Dismiss / manual add |
| **Matches** | featured recipe → "Remy is writing you a recipe…" card | featured failure → "Live recipe generation unreachable — showing cookbook matches" | empty basket → "Your basket is empty" warning card (no 0% noise) | Back to Setup |
| **Recipe** | — | falls back to a default recipe if none picked | "You have" shows "Nothing yet — see below" when nothing owned | — |
| **Live** | "Warming up the on-device model…" / "Allow camera access…" | camera error → "Camera's off — you can still follow the steps" (steps stay usable) | — | flip camera / follow steps without camera |
| **Feedback** | — | — | no session record → falls back to recipe-derived copy ("Good stopping point") | Back to home |
| **Savings** | — | Maps `openURL` failures are swallowed (no crash) | no missing items → shopping-list card simply hidden | Continue cooking / browse flyers |
| **Profile** | — | — | no skill data → "Finish a cook… shows up here"; no saved → "Nothing saved yet" | "Clear what Remy remembers" reset |

Verified by the Playwright happy-path E2E (`e2e/happy.spec.ts`), which asserts
the live screen mounts into one of its loading/permission/tracking states
rather than a blank view.
