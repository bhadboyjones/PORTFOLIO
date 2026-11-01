// One full appraisal, as a user would do it, with the checks that matter:
// the answer appears, the copy rules hold, and the URL keeps your place.
import { test, expect } from "@playwright/test";
import path from "node:path";

const CSV = path.resolve(import.meta.dirname, "../../outputs/test_data/small_office_hh.csv");

test("upload, run, read the answer, refresh and go back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Battery appraisal for C&I sites");

  await page.getByRole("button", { name: "Upload meter data" }).click();
  await expect(page).toHaveURL(/#\/upload$/);

  // Upload echo
  await page.locator('input[type="file"]').setInputFiles(CSV);
  await expect(page.getByText("What flexiq read from small_office_hh.csv")).toBeVisible();
  await expect(page.getByText("60.0 days, no gaps")).toBeVisible();

  await page.getByLabel("Network operator (DNO)").selectOption("NPGY");
  await page.getByLabel("Export limit 1, MW").fill("0");
  await page.getByRole("button", { name: /Run optimisation/ }).click();
  await expect(page).toHaveURL(/#\/run\//);

  // Results: the answer and its explanation
  await expect(page).toHaveURL(/#\/results\//, { timeout: 200_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site appraisal");
  await expect(page.getByText("Year-1 saving, best size")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why this result" })).toBeVisible();
  await expect(page.getByText(/breaks even if capex falls to about £[\d,]+/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Battery sizes compared" })).toBeVisible();

  // Copy rules: no em dashes, money with a true minus
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("—");
  expect(body).not.toMatch(/£-\d/);

  // Refresh keeps the results; Back returns to the form with the file kept
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Site appraisal");
  await page.goBack();
  await expect(page).toHaveURL(/#\/upload$/);
});

test("a real MIC gets breach pricing and a MIC suggestion", async ({ page }) => {
  await page.goto("/#/upload");
  await page.locator('input[type="file"]').setInputFiles(CSV);
  await expect(page.getByText("What flexiq read from small_office_hh.csv")).toBeVisible();
  await page.getByLabel("Network operator (DNO)").selectOption("NPGY");
  await page.getByLabel("Export limit 1, MW").fill("0");
  await page.getByLabel(/Agreed import capacity/).fill("1050");
  await expect(page.getByLabel("MIC safety margin")).toHaveValue("5");
  await page.getByRole("button", { name: /Run optimisation/ }).click();

  await expect(page).toHaveURL(/#\/results\//, { timeout: 200_000 });
  await expect(page.getByRole("heading", { name: "Months over the MIC" })).toBeVisible({ timeout: 30_000 });
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("—");
  expect(body).not.toMatch(/£-\d/);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
});

test("a flat all-inclusive tariff says the battery has nothing to trade", async ({ page }) => {
  await page.goto("/#/upload");
  await page.locator('input[type="file"]').setInputFiles(CSV);
  await expect(page.getByText("What flexiq read from small_office_hh.csv")).toBeVisible();
  await page.getByLabel("Network operator (DNO)").selectOption("NPGY");
  await page.getByLabel("Export limit 1, MW").fill("0");
  await page.getByLabel("How is your energy priced?").selectOption("flat");
  await page.getByLabel("Flat rate", { exact: true }).fill("15");
  await page.getByLabel("DUoS unit and fixed charges").check();
  await page.getByLabel("Policy and system charges").check();
  await expect(page.getByText(/leaves the battery nothing to trade/)).toBeVisible();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT.replace(".png", "-config.png"), fullPage: true });
  await page.getByRole("button", { name: /Run optimisation/ }).click();
  await expect(page).toHaveURL(/#\/results\//, { timeout: 200_000 });
  await page.getByRole("button", { name: /warning/i }).first().click({ timeout: 3000 }).catch(() => {});
  await expect(page.getByText(/charges one import rate all year/)).toBeVisible({ timeout: 30_000 });
});

test("landing shows the live price, and works without it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/GB market price £[\d,.]+\/MWh at \d\d:\d\d/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".live-line polyline")).toBeAttached();
  if (process.env.SHOT) { await page.waitForTimeout(2600); await page.screenshot({ path: process.env.SHOT.replace(".png", "-live.png") }); }

  await page.route("**/data.elexon.co.uk/**", (r) => r.abort());
  await page.reload();
  await expect(page.getByRole("button", { name: "Upload meter data" })).toBeVisible();
  await expect(page.locator(".live-line")).toHaveCount(0);
});
