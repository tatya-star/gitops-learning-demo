import { expect, test, type Page, type Request } from '@playwright/test'
import { testImage, testSha } from '../playwright.config'

const initialFeedback = 'A simulated incident is ready for the exercise.'
const degradedFeedback = '2 of 3 simulated checks passed. Try the recovery control.'
const recoveryFeedback = 'Simulated recovery complete. No Kubernetes resources were changed.'
const healthyFeedback = 'All 3 simulated checks passed. The service is operational.'
const observations = new WeakMap<Page, { requests: string[]; errors: string[]; listener: (request: Request) => void }>()

function healthPanel(page: Page) {
  return page.getByRole('region', { name: 'Service health', exact: true })
}

function lastCheck(page: Page) {
  return page.getByRole('region', { name: 'Current release' }).getByText('Last health check', { exact: true }).locator('..').locator('.detail-value')
}

async function expectRelease(page: Page) {
  await expect(page.getByRole('heading', { name: 'GitOps release dashboard', exact: true })).toBeVisible()
  const release = page.getByRole('region', { name: 'Current release' })
  await expect(release.getByText(testSha.slice(0, 7), { exact: true })).toBeVisible()
  await expect(release.getByText(`${testImage}:${testSha}`, { exact: true })).toHaveText(`${testImage}:${testSha}`)
}

async function expectHealth(page: Page, recovered: boolean) {
  const panel = healthPanel(page)
  await expect(panel.getByText(recovered ? 'Operational' : 'Attention needed', { exact: true })).toBeVisible()
  await expect(panel.getByText(recovered ? 'HEALTHY' : 'DEGRADED', { exact: true })).toBeVisible()
  await expect(panel.getByText('Simulated exercise state', { exact: true })).toBeVisible()
  await expect(panel.getByText('OK', { exact: true })).toHaveCount(recovered ? 3 : 2)
  await expect(panel.getByText('SIMULATED', { exact: true })).toHaveCount(recovered ? 0 : 1)
}

async function expectFits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  for (const element of [
    page.getByRole('button', { name: 'Run health check', exact: true }),
    page.getByRole('button', { name: 'Simulate recovery', exact: true }),
    page.getByRole('status'),
    page.locator('.image-reference'),
  ]) {
    await expect(element).toBeVisible()
    await expect.poll(() => element.evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(node)
      const content = range.getBoundingClientRect()
      return node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight
        && bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth
        && content.left >= bounds.left && content.right <= bounds.right
        && content.top >= bounds.top && content.bottom <= bounds.bottom
    })).toBe(true)
  }
}

async function expectTimestamp(page: Page) {
  await expect(lastCheck(page)).not.toHaveText('Not run yet')
  await expect(lastCheck(page)).not.toBeEmpty()
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect.poll(async () => {
    try {
      return (await page.request.get('/', { timeout: 2000 })).status()
    } catch {
      return 0
    }
  }, { timeout: 15000 }).toBe(200)
  const response = await page.goto('/', { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  await page.evaluate(() => document.fonts.ready)
  const requests: string[] = []
  const listener = (request: Request) => requests.push(`${request.method()} ${request.url()}`)
  observations.set(page, { requests, errors, listener })
  page.on('request', listener)
  await expectRelease(page)
  await expectHealth(page, false)
  await expect(page.getByRole('status')).toHaveText(initialFeedback)
  await expect(lastCheck(page)).toHaveText('Not run yet')
  await expectFits(page)
})

test.afterEach(async ({ page }) => {
  await expectRelease(page)
  await expectFits(page)
  const observation = observations.get(page)!
  expect(observation.errors, 'Dashboard must not crash').toEqual([])
  expect(observation.requests, 'Buttons must not issue requests or deployment actions').toEqual([])
})

test('initial render has degraded simulation and the embedded release identity', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  await expect(page.getByText('Versioned build', { exact: true })).toBeVisible()
  await expect(page.getByText('Build metadata', { exact: true })).toBeVisible()
  await expect(page.getByText(/^(Synced|Cluster connected|Deployed from main|GHCR · public|Argo CD · synced|Ready|1 node)$/)).toHaveCount(0)
})

test('health check before recovery reports two passing checks and stays degraded', async ({ page }) => {
  await page.getByRole('button', { name: 'Run health check', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(degradedFeedback)
  await expectHealth(page, false)
  await expectTimestamp(page)
})

test('recovery reports healthy simulation with three passing checks', async ({ page }) => {
  await page.getByRole('button', { name: 'Simulate recovery', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(recoveryFeedback)
  await expectHealth(page, true)
  await expectTimestamp(page)
})

test('checks and repeated recovery preserve operational state and release identity', async ({ page }) => {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    await page.getByRole('button', { name: 'Simulate recovery', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(recoveryFeedback)
    await expectHealth(page, true)
    await expectFits(page)
    await page.getByRole('button', { name: 'Run health check', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(healthyFeedback)
    await expectHealth(page, true)
    await expectTimestamp(page)
    await expectRelease(page)
    await expectFits(page)
  }
})

test('native buttons support Enter and Space with feedback in the status region', async ({ page }) => {
  const checkButton = page.getByRole('button', { name: 'Run health check', exact: true })
  const recoveryButton = page.getByRole('button', { name: 'Simulate recovery', exact: true })
  await checkButton.focus()
  await expect(checkButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText(degradedFeedback)
  await expectHealth(page, false)
  await expectTimestamp(page)
  await page.keyboard.press('Tab')
  await expect(recoveryButton).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText(recoveryFeedback)
  await expectHealth(page, true)
  await expectFits(page)
  await checkButton.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('status')).toHaveText(healthyFeedback)
  await recoveryButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText(recoveryFeedback)
  await expectHealth(page, true)
})

test('reload resets ephemeral recovery without changing the embedded version', async ({ page }) => {
  await page.getByRole('button', { name: 'Simulate recovery', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(recoveryFeedback)
  await expectHealth(page, true)
  const observation = observations.get(page)!
  expect(observation.requests).toEqual([])
  page.off('request', observation.listener)
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  page.on('request', observation.listener)
  await expectHealth(page, false)
  await expect(page.getByRole('status')).toHaveText(initialFeedback)
  await expect(lastCheck(page)).toHaveText('Not run yet')
})