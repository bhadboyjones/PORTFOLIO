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

  await page.getByLabel("Network operator (DNO)").selectOption("NPG");
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
