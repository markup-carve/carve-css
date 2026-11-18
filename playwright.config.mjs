import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  // The retained 0.1 specs describe renderer shapes absent from next2.
  testMatch: "v2.spec.mjs",
  reporter: "line",
  use: { headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
