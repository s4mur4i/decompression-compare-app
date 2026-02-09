import { test, expect } from '@playwright/test';

test.describe('Page Load', () => {
  test('loads with empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Decompression Compare');
    // Should show add stop button
    await expect(page.locator('.add-btn')).toBeVisible();
  });

  test('loads with URL params', async ({ page }) => {
    await page.goto('/?plan=25:10,20:5');
    // Should have 2 stop rows
    const stops = page.locator('.stop-row');
    await expect(stops).toHaveCount(2);
  });

  test('footer is visible with GitHub link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('footer')).toContainText('S4mur4i');
  });
});

test.describe('Dive Stops', () => {
  test('can add a stop', async ({ page }) => {
    await page.goto('/');
    await page.click('.add-btn');
    const stops = page.locator('.stop-row');
    await expect(stops).toHaveCount(1);
  });

  test('can add multiple stops', async ({ page }) => {
    await page.goto('/');
    await page.click('.add-btn');
    await page.click('.add-btn');
    await page.click('.add-btn');
    const stops = page.locator('.stop-row');
    await expect(stops).toHaveCount(3);
  });

  test('can remove a stop', async ({ page }) => {
    await page.goto('/?plan=25:10,20:5');
    const stops = page.locator('.stop-row');
    await expect(stops).toHaveCount(2);
    
    // Click remove on first stop
    await page.locator('.stop-row').first().locator('.remove-btn').click();
    await expect(stops).toHaveCount(1);
  });

  test('can edit depth value', async ({ page }) => {
    await page.goto('/');
    await page.click('.add-btn');
    
    const depthInput = page.locator('.stop-field input').first();
    await depthInput.click({ clickCount: 3 });
    await depthInput.fill('40');
    await expect(depthInput).toHaveValue('40');
  });

  test('empty input shows red highlight', async ({ page }) => {
    await page.goto('/?plan=25:10');
    
    const depthInput = page.locator('.stop-field input').first();
    await depthInput.click({ clickCount: 3 });
    await depthInput.press('Backspace');
    
    await expect(depthInput).toHaveClass(/invalid/);
  });
});

test.describe('Chart', () => {
  test('chart renders with stops', async ({ page }) => {
    await page.goto('/?plan=25:10');
    // Chart.js renders on canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('no chart placeholder without stops', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.chart-placeholder')).toBeVisible();
  });
});

test.describe('Dive Table', () => {
  test('shows dive plan table with stops', async ({ page }) => {
    await page.goto('/?plan=25:10&algo=zhl16c');
    await expect(page.locator('.dive-table')).toBeVisible();
    await expect(page.locator('.dive-table table')).toBeVisible();
    
    // Should have at least descend + stay + ascend rows
    const rows = page.locator('.dive-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('shows action badges', async ({ page }) => {
    await page.goto('/?plan=25:10&algo=zhl16c');
    await expect(page.locator('.action-badge.descend').first()).toBeVisible();
    await expect(page.locator('.action-badge.stay').first()).toBeVisible();
  });

  test('shows deco stops for deep dive', async ({ page }) => {
    await page.goto('/?plan=60:20&algo=zhl16c');
    // Should have deco-stop badges
    const decoStops = page.locator('.action-badge.deco-stop');
    const count = await decoStops.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Algorithm Selection', () => {
  test('can select algorithm', async ({ page }) => {
    await page.goto('/?plan=30:15');
    await page.locator('.algo-select').selectOption('zhl16c');
    
    // Should show GF settings
    await expect(page.locator('text=GF Low')).toBeVisible();
  });

  test('algorithm settings hidden when "No Algorithm"', async ({ page }) => {
    await page.goto('/?plan=30:15');
    await page.locator('.algo-select').selectOption('none');
    
    // GF settings should not be visible
    await expect(page.locator('text=GF Low')).not.toBeVisible();
  });
});

test.describe('Summary', () => {
  test('shows summary with stops', async ({ page }) => {
    await page.goto('/?plan=25:10');
    await expect(page.locator('.dive-summary')).toBeVisible();
    await expect(page.locator('text=Max Depth')).toBeVisible();
    await expect(page.locator('.dive-summary .summary-label', { hasText: 'Run Time' })).toBeVisible();
  });
});

test.describe('Compare Mode', () => {
  test('can toggle compare mode', async ({ page }) => {
    await page.goto('/?plan=30:15');
    
    // Click compare button
    const compareBtn = page.locator('.mode-btn', { hasText: 'Compare' });
    await compareBtn.click();
    
    // Should show two algorithm panels
    const algoSelects = page.locator('.algo-select');
    const count = await algoSelects.count();
    expect(count).toBe(2);
  });

  test('loads compare mode from URL', async ({ page }) => {
    await page.goto('/?plan=60:20&mode=compare&algoA=zhl16c&algoB=vpm');
    
    const algoSelects = page.locator('.algo-select');
    const count = await algoSelects.count();
    expect(count).toBe(2);
  });

  test('shows two dive tables in compare mode', async ({ page }) => {
    await page.goto('/?plan=60:20&mode=compare&algoA=zhl16c&algoB=vpm');
    
    const tables = page.locator('.dive-table');
    const count = await tables.count();
    expect(count).toBe(2);
  });
});

test.describe('Share Link', () => {
  test('share button is visible', async ({ page }) => {
    await page.goto('/?plan=25:10');
    await expect(page.locator('.share-btn')).toBeVisible();
  });

  test('URL updates when stops change', async ({ page }) => {
    await page.goto('/');
    await page.click('.add-btn');
    
    // URL should now contain plan param
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('plan=');
  });
});

test.describe('Responsive', () => {
  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/?plan=25:10&algo=zhl16c');
    
    // Page should load without errors
    await expect(page.locator('h1')).toContainText('Decompression Compare');
    await expect(page.locator('.dive-table')).toBeVisible();
  });
});
