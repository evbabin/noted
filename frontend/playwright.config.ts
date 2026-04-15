import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = Number(process.env.PLAYWRIGHT_FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.PLAYWRIGHT_BACKEND_PORT ?? 8000);

const frontendBaseUrl =
  process.env.PLAYWRIGHT_FRONTEND_BASE_URL ??
  `http://localhost:${FRONTEND_PORT}`;

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_BASE_URL ?? `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },

  // Collaboration E2E requires both API and websocket availability. We start
  // the backend here so frontend tests exercise the same auth + realtime stack
  // the browser uses in development, rather than mocking either layer.
  webServer: [
    {
      command:
        "docker compose -f ../docker-compose.yml up -d --wait postgres redis && venv\\Scripts\\python -m alembic upgrade head && venv\\Scripts\\python -m uvicorn app.main:app --host localhost --port 8000",
      cwd: "../backend",
      url: `${backendBaseUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql+asyncpg://noted:noted@localhost:5432/noted",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379/0",
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "change-me-in-production",
        CORS_ORIGINS:
          process.env.CORS_ORIGINS ??
          '["http://localhost:5173","http://127.0.0.1:5173"]',
      },
    },
    {
      command: "pnpm build && pnpm preview --host localhost --port 5173",
      cwd: ".",
      url: frontendBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        VITE_API_BASE_URL:
          process.env.VITE_API_BASE_URL ?? `${backendBaseUrl}/api/v1`,
        VITE_WS_URL:
          process.env.VITE_WS_URL ?? `ws://localhost:${BACKEND_PORT}/api/v1/ws`,
      },
    },
  ],

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
