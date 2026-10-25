// End-to-end smoke test: the real app against the real API, in system Chrome.
// Run with `npm run test:e2e`. Starts the API (port 8000) and a production
// build of the UI (port 5173, the origin the API allows) unless already up.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.js$/,
  timeout: 240_000,
  use: { channel: "chrome", baseURL: "http://localhost:5173", viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      command: "python3 -m uvicorn api.main:app --port 8000",
      cwd: "..",
      url: "http://localhost:8000/docs",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "VITE_API_BASE_URL=http://localhost:8000 npx vite build && npx vite preview --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
