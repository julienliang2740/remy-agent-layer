import { expect, test } from "@playwright/test";

/**
 * Happy path: onboarding → scan (fixture image, offline mock fallback is fine)
 * → confirm ingredients → matches → recipe → live mode mounts.
 * Also measures the real client-side downscale (D4 cost control).
 */

// 1×1 red PNG — enough for the picker + (offline) scan path.
const PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("onboarding → scan → confirm → matches → recipe → live mounts", async ({ page }) => {
  await page.goto("/");

  // Onboarding
  await expect(page.getByText("Cook with")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Let's cook").click();

  // Home → new session
  await expect(page.getByText("The kitchen")).toBeVisible();
  await page.getByText("Start a new session").click();

  // Setup → upload fixture image via the file chooser
  await expect(page.getByText("What do you")).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Upload photos").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "fridge.png", mimeType: "image/png", buffer: PX_PNG });

  // Scan runs (live backend or labeled offline fallback) → editable review
  await expect(page.getByText(/confirm before adding/)).toBeVisible({ timeout: 30_000 });
  await page.getByText(/Add \d+ to basket/).click();
  await expect(page.getByText("Added to your basket")).toBeVisible();

  // Suggest (PrimaryButton → role=button, reliably clickable in the sticky footer)
  await page.getByRole("button", { name: /Suggest recipes/ }).click();

  // Matches → pick a cookbook match
  await expect(page.getByText(/Recipes for/)).toBeVisible({ timeout: 15_000 });
  const card = page.getByText("Garlic butter pasta").first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  // Recipe → has the teaching layer and the live CTA
  await expect(page.getByText(/You have ·/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Enter live mode/ }).click();

  // Live mode mounts: camera permission gate or tracking UI renders
  await expect(
    page
      .getByText(/Allow camera access|Show Remy your hands|Warming up the on-device model|Step 1 of/)
      .first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("D4: client-side downscale shrinks a large image before upload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Cook with|The kitchen/).first()).toBeVisible({ timeout: 20_000 });

  const result = await page.evaluate(async () => {
    // Build a noisy 2400×1600 image (noise defeats PNG/JPEG compression).
    const src = document.createElement("canvas");
    src.width = 2400;
    src.height = 1600;
    const ctx = src.getContext("2d")!;
    const img = ctx.createImageData(2400, 1600);
    for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 2654435761) % 255;
    ctx.putImageData(img, 0, 0);
    const original: Blob = await new Promise((r) => src.toBlob((b) => r(b!), "image/jpeg", 0.95));
    const uri = URL.createObjectURL(original);
    const downscale = (window as any).__remyDownscale as (u: string) => Promise<Blob | null>;
    const small = await downscale(uri);
    return {
      originalBytes: original.size,
      downscaledBytes: small?.size ?? -1,
      hookPresent: typeof downscale === "function",
    };
  });

  expect(result.hookPresent).toBe(true);
  expect(result.downscaledBytes).toBeGreaterThan(0);
  expect(result.downscaledBytes).toBeLessThan(result.originalBytes / 2);
  console.log(
    `downscale: ${result.originalBytes} bytes → ${result.downscaledBytes} bytes ` +
      `(${((result.downscaledBytes / result.originalBytes) * 100).toFixed(1)}%)`,
  );
});
