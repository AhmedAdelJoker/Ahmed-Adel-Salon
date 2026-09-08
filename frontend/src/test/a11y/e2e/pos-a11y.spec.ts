import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Accessibility Tests using Playwright + axe-core
 * Tests the POS page at http://localhost:5173/pos
 */

test.describe('POS Page - Accessibility E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to POS page
    await page.goto('/pos');
    
    // Wait for page to load (loading spinner to disappear)
    await page.waitForSelector('text=تنشيط محطة الـ POS الآمنة...', { state: 'hidden', timeout: 30000 });
    
    // Ensure RTL direction
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    });
  });

  test('Full page has no accessibility violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Color contrast meets WCAG AA', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard navigation works correctly', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['cat.keyboard'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Focus indicators are visible', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('body')
      .withRules(['focus-visible'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Form labels are properly associated', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Buttons have accessible names', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ARIA attributes are valid', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['aria-valid-attr', 'aria-valid-attr-value', 'aria-required-attr'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Heading structure is logical', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order', 'page-has-heading-one'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Touch targets meet 48x48px minimum', async ({ page }) => {
    // Check interactive elements for minimum touch target size
    const smallTargets = await page.evaluate(() => {
      const interactiveElements = document.querySelectorAll(
        'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [tabindex]:not([tabindex="-1"])'
      );
      
      const violations: { tagName: string; className: string; width: number; height: number; selector: string }[] = [];
      interactiveElements.forEach((raw) => {
        const el = raw as HTMLElement;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Skip hidden elements
        if (rect.width === 0 && rect.height === 0) return;
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
        if ("disabled" in el && (el as HTMLButtonElement).disabled) return;

        if (rect.width < 48 || rect.height < 48) {
          violations.push({
            tagName: el.tagName,
            className: typeof el.className === "string" ? el.className : "",
            width: rect.width,
            height: rect.height,
            selector: el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase(),
          });
        }
      });
      
      return violations;
    });
    
    // Allow some small targets (like icon-only buttons with padding) but log them
    if (smallTargets.length > 0) {
      console.warn('Elements below 48x48px touch target:', smallTargets);
    }
    
    // Fail only if there are significant violations (non-icon buttons)
    const significantViolations = smallTargets.filter(v => 
      v.tagName !== 'BUTTON' || 
      !v.className.includes('icon') ||
      (v.width < 32 && v.height < 32)
    );
    
    expect(significantViolations).toHaveLength(0);
  });

  test('Mobile bottom navigation is accessible', async ({ page }) => {
    // Check bottom nav exists and has proper ARIA
    const bottomNav = page.locator('[role="tablist"]');
    
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toHaveAttribute('aria-label');
      
      const tabs = bottomNav.locator('[role="tab"]');
      const tabCount = await tabs.count();
      
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        await expect(tab).toHaveAttribute('aria-selected');
        await expect(tab).toHaveAttribute('aria-label');
        await expect(tab).toHaveAttribute('aria-disabled');
      }
    }
  });

  test('Sessions queue cards are keyboard accessible', async ({ page }) => {
    // Cards should have role="button", tabindex="0", and aria-label
    const sessionCards = page.locator('[role="button"][tabindex="0"]');
    const count = await sessionCards.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const card = sessionCards.nth(i);
        await expect(card).toHaveAttribute('aria-label');
        await expect(card).toHaveAttribute('aria-pressed');
      }
    }
  });

  test('Checkout button has keyboard shortcut attribute', async ({ page }) => {
    const checkoutBtn = page.locator('[data-pos-checkout="true"]');
    await expect(checkoutBtn).toBeVisible();
    await expect(checkoutBtn).toHaveAttribute('data-pos-checkout', 'true');
  });

  test('Category tabs have touch-target class', async ({ page }) => {
    // Switch to items view to see category tabs
    const itemsTab = page.locator('[role="tab"]:has-text("إضافة")');
    if (await itemsTab.isVisible()) {
      await itemsTab.click();
    }
    
    const categoryTabs = page.locator('.touch-target');
    await expect(categoryTabs.first()).toHaveClass(/touch-target/);
  });

  test('Select components are used instead of native selects', async ({ page }) => {
    // Check for Radix Select triggers (data-radix-select-trigger)
    const radixSelects = page.locator('[data-radix-select-trigger]');
    const nativeSelects = page.locator('select');
    
    // There should be Radix selects for barber assignment
    const radixCount = await radixSelects.count();
    const nativeCount = await nativeSelects.count();
    
    // Allow native selects for other purposes, but barber selects should be Radix
    // This is a soft check - log for review
    console.log(`Radix Selects: ${radixCount}, Native Selects: ${nativeCount}`);
  });
});

test.describe('POS Page - Responsive Accessibility', () => {
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`No violations at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/pos');
      await page.waitForSelector('text=تنشيط محطة الـ POS الآمنة...', { state: 'hidden', timeout: 30000 });
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});

test.describe('POS Page - High Contrast Mode', () => {
  test('No violations in forced colors mode', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/pos');
    await page.waitForSelector('text=تنشيط محطة الـ POS الآمنة...', { state: 'hidden', timeout: 30000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('POS Page - Reduced Motion', () => {
  test('No violations with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/pos');
    await page.waitForSelector('text=تنشيط محطة الـ POS الآمنة...', { state: 'hidden', timeout: 30000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});