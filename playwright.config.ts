import { defineConfig } from '@playwright/test'
import process from 'node:process'

const candidateUrl = process.env.RELEASE_CANDIDATE_URL?.trim()
export const testSha = candidateUrl ? process.env.GITHUB_SHA?.trim() ?? '' : '0123456789abcdef0123456789abcdef01234567'
export const testImage = candidateUrl ? process.env.IMAGE_NAME?.trim() ?? '' : 'ghcr.io/example/gitops-learning-demo'

if (candidateUrl && (!/^[0-9a-f]{40}$/i.test(testSha) || !testImage)) {
  throw new Error('Container verification requires GITHUB_SHA and IMAGE_NAME.')
}

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: candidateUrl || 'http://127.0.0.1:4179',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: candidateUrl ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    env: { VITE_COMMIT_SHA: testSha, VITE_IMAGE_NAME: testImage },
  },
})