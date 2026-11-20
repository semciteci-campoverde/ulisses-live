import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-output/results.json' }], ['html', { outputFolder: 'test-output/html', open: 'never' }]],
  use: {
    baseURL: process.env.SITE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Cuiaba',
  },
  outputDir: 'test-output/artifacts',
})
