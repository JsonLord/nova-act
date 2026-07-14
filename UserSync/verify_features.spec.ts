
import { test, expect } from '@playwright/test';

test('Verify app features', async ({ page }) => {
  await page.goto('http://localhost:7860');

  // Wait for the app to load
  await page.waitForSelector('text=SyncUsers & NovaAct');

  // Click Dashboard to get to Tab 2 Simulation view
  await page.click('text=Dashboard');

  // 1. Verify Default View is Job Title
  const currentView = await page.locator('select').nth(1).inputValue();
  console.log('Current View:', currentView);
  expect(currentView).toBe('Job Title');

  // 2. Verify Info Box
  await expect(page.locator('text=Configuration Required')).toBeVisible();
  await expect(page.locator('text=Assemble new group and create a new test are required')).toBeVisible();

  // 3. Verify Output Panel
  await expect(page.locator('text=OUTPUT')).toBeVisible();
  await expect(page.locator('text=Simulation Results')).toBeVisible();

  // 4. Test "Assemble new group" modal
  await page.click('text=Assemble new group');
  await expect(page.locator('h3:has-text("Assemble New Group")')).toBeVisible();
  await page.fill('textarea[placeholder="Describe your ideal audience..."]', 'Test Profile');
  await page.click('button:has-text("Cancel")');

  // 5. Test Chat Page
  await page.click('text=Open Global Chat');
  await expect(page.locator('text=New Simulation')).toBeVisible();

  // 6. Verify Help Me Craft button
  await expect(page.locator('button:has-text("Help Me Craft")')).toBeVisible();

  // 7. Verify Upload Images button
  await expect(page.locator('button:has-text("Upload Images")')).toBeVisible();

  // 8. Test "Request a new context" button in Chat
  await page.click('text=Request a new context');
  await expect(page.locator('h3:has-text("Request New Context")')).toBeVisible();
  await page.click('button:has-text("Cancel")');

  // 9. Verify /health endpoint
  const response = await page.request.get('http://localhost:7860/health');
  expect(response.status()).toBe(200);
  console.log('/health status:', response.status());

  // Take a screenshot of the chat page
  await page.screenshot({ path: '/home/jules/verification/chat_page_check.png', fullPage: true });

  console.log('Verification completed successfully');
});
