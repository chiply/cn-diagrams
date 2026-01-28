import { test, expect } from '@playwright/test';

test('dropdown should update both code and diagram', async ({ page }) => {
  await page.goto('http://localhost:5179/');
  await page.waitForTimeout(3000);

  // Take screenshot before change - should show Cloud Platform
  await page.screenshot({ path: 'test-results/before-dropdown.png' });

  // Verify initial state shows Cloud Platform in the editor
  const initialEditorText = await page.locator('.editor-pane').textContent();
  expect(initialEditorText).toContain('Cloud Platform');

  // Select "Simple Web App" from dropdown
  await page.selectOption('#example-select', 'simple-webapp');
  await page.waitForTimeout(2000);

  // Take screenshot after change
  await page.screenshot({ path: 'test-results/after-dropdown.png' });

  // Verify code editor now shows Simple Web App content
  const newEditorText = await page.locator('.editor-pane').textContent();
  expect(newEditorText).toContain('Simple Web App');
  expect(newEditorText).toContain('browser');
  expect(newEditorText).toContain('webapp');
  expect(newEditorText).not.toContain('Kubernetes');
});
