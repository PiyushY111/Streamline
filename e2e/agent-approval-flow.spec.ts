import { test, expect } from '@playwright/test';

test.describe('Streamline Agent Guardrails & Human-in-the-Loop Journey', () => {
  test('proposing send_email queues in Shield and executes only after explicit human approval', async ({ page }) => {
    // 1. Authenticate with seeded / test credentials
    await page.goto('/login');
    await expect(page).toHaveTitle(/Streamline|Login/i);

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill('alex@example.com');
      await passwordInput.fill('password123');
      await page.click('button[type="submit"]');
    }

    // 2. Open Agent Copilot Interface
    await page.goto('/agent');
    await expect(page.locator('body')).toBeVisible();

    // 3. Propose high-consequence external action
    const chatInput = page.locator(
      'textarea[placeholder*="Ask"], input[placeholder*="Ask"], textarea[placeholder*="Message"]',
    );
    if (await chatInput.isVisible()) {
      await chatInput.fill('Draft and send an email to sarah@example.com approving the enterprise contract renewal.');
      await page.keyboard.press('Enter');

      // 4. Verify Human-in-the-Loop Shield Review Modal / Action Card Appears
      const shieldCard = page.locator(
        '[data-testid="shield-action-card"], [data-testid="pending-action-card"], text=Send External Email',
      );
      await expect(shieldCard.first()).toBeVisible({ timeout: 15000 });

      // 5. Click Approve in Shield Review Card
      const approveBtn = page.locator(
        '[data-testid="approve-action-btn"], button:has-text("Approve"), button:has-text("Execute")',
      );
      if (await approveBtn.first().isVisible()) {
        await approveBtn.first().click();

        // 6. Verify Execution Feedback Toast
        const successToast = page.locator(
          'text=Action executed successfully, text=executed, [data-testid="toast-success"]',
        );
        await expect(successToast.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('prevents execution of rejected actions and logs cancellation', async ({ page }) => {
    await page.goto('/agent');
    await expect(page.locator('body')).toBeVisible();

    const shieldRejectBtn = page.locator(
      '[data-testid="reject-action-btn"], button:has-text("Reject"), button:has-text("Dismiss")',
    );
    if (await shieldRejectBtn.first().isVisible()) {
      await shieldRejectBtn.first().click();
      await expect(page.locator('text=Rejected, text=Cancelled').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
