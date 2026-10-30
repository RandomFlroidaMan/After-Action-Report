import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: {
    baseURL: process.env.AAR_TEST_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.AAR_CHROMIUM_PATH
      ? { executablePath: process.env.AAR_CHROMIUM_PATH }
      : {},
  },
  reporter: 'list',
  webServer: process.env.AAR_TEST_URL
    ? undefined
    : [
        {
          command: 'pnpm --filter @aar/web start',
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter @aar/web start --port 3001',
          url: 'http://127.0.0.1:3001',
          reuseExistingServer: false,
          timeout: 120000,
          env: {
            AAR_DEPLOYMENT: 'hosted',
            DATABASE_URL: '',
            POSTGRES_URL: '',
            BLOB_READ_WRITE_TOKEN: '',
            AAR_REGISTRATION_CODE: '',
          },
        },
      ],
});
