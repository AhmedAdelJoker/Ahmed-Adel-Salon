import { expect } from "vitest";
import axe, { type AxeResults, type RunOptions, type ElementContext } from "axe-core";
import { toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom";

declare module "vitest" {
   
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

expect.extend(toHaveNoViolations);

/**
 * Accessibility test utilities for axe-core integration
 * Provides reusable functions for testing components and pages
 */

// Configure axe with project-specific rules
const axeConfig = {
  rules: {
    // Required: WCAG 2.1 AA compliance
    "color-contrast": { enabled: true },
    "focus-order-semantics": { enabled: true },
    label: { enabled: true },
    "button-name": { enabled: true },
    "link-name": { enabled: true },
    "image-alt": { enabled: true },
    "aria-required-attr": { enabled: true },
    "aria-valid-attr-value": { enabled: true },
    "aria-valid-attr": { enabled: true },
    "role-img-alt": { enabled: true },
    "landmark-one-main": { enabled: true },
    region: { enabled: true },
    "heading-order": { enabled: true },
    "html-has-lang": { enabled: true },
    "html-lang-valid": { enabled: true },
    "page-has-heading-one": { enabled: true },
    "document-title": { enabled: true },
    list: { enabled: true },
    listitem: { enabled: true },
    "meta-viewport": { enabled: true },
    bypass: { enabled: true },
  },
  // Run only WCAG 2.1 AA rules
  runOnly: {
    type: "tag",
    values: ["wcag2aa", "wcag21aa", "best-practice"],
  },
  // Result types to include
  resultTypes: ["violations", "incomplete", "passes"],
};

/**
 * Run axe on a container element
 * @param {HTMLElement} container - The container to test
 * @param {Object} options - Additional axe options
 * @returns {Promise<Object>} Axe results
 */
export async function runAxe(
  container: ElementContext,
  options: Partial<RunOptions> = {},
): Promise<AxeResults> {
  return await axe.run(container, {
    ...axeConfig,
    ...options,
  } as RunOptions);
}

/**
 * Test a component for accessibility violations
 * @param {React.ReactElement} component - The component to test
 * @param {Object} renderOptions - RTL render options
 * @returns {Promise<void>}
 */
export async function testComponentA11y(
  component: React.ReactElement,
   
  renderOptions: Record<string, any> = {},
) {
  const { render, screen } = await import("@testing-library/react");
  const { container } = render(component, renderOptions);

  const results = await runAxe(container);

  if (results.violations.length > 0) {
    const formatted = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary,
      })),
    }));

    console.error(
      "Accessibility violations found:",
      JSON.stringify(formatted, null, 2),
    );
  }

  expect(results).toHaveNoViolations();
}

/**
 * Axe rule for touch target size (48x48px minimum)
 * This is a custom rule since axe-core doesn't have it built-in
 */
export const touchTargetRule = {
  id: "touch-target",
  selector:
    'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"]',
  matches: (node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const minTouchTarget = 48; // px

    // Check if element is visible
    if (rect.width === 0 && rect.height === 0) return true;
    if (style.display === "none" || style.visibility === "hidden") return true;
    if (style.opacity === "0") return true;

    return rect.width >= minTouchTarget && rect.height >= minTouchTarget;
  },
  message: "Touch targets must be at least 48x48px for WCAG 2.1 AA compliance",
  tags: ["wcag21aa", "best-practice"],
};

/**
 * Helper to check color contrast for specific elements
 * @param {HTMLElement} element - Element to check
 * @returns {Object} Contrast ratio info
 */
export function checkColorContrast(element: Element) {
  const style = window.getComputedStyle(element);
  const color = style.color;
  const backgroundColor = style.backgroundColor;

  // This would need a color contrast library like 'wcag-contrast'
  // For now, return placeholder
  return {
    color,
    backgroundColor,
    ratio: null,
    passes: null,
  };
}

/**
 * Test keyboard navigation for a component
 * @param {HTMLElement} container - Container to test
 * @returns {Object} Keyboard navigation results
 */
export interface KeyboardNavigationIssue {
  index: number;
  element: string;
  issue: string;
  selector: string;
}

export function testKeyboardNavigation(container: ParentNode) {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [role="tab"]',
  );

  const results: {
    focusableCount: number;
    hasFocusStyles: boolean;
    tabOrderLogical: boolean;
    issues: KeyboardNavigationIssue[];
  } = {
    focusableCount: focusableElements.length,
    hasFocusStyles: true,
    tabOrderLogical: true,
    issues: [],
  };

  focusableElements.forEach((el, index) => {
    const style = window.getComputedStyle(el);
    // Check for visible focus styles
    const hasFocus =
      style.outline !== "none" ||
      style.boxShadow !== "none" ||
      style.borderColor !== style.color;

    if (!hasFocus) {
      results.hasFocusStyles = false;
      results.issues.push({
        index,
        element: el.tagName,
        issue: "Missing visible focus styles",
        selector: getSelector(el),
      });
    }
  });

  return results;
}

/**
 * Get a CSS selector for an element
 */
function getSelector(element: HTMLElement) {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(" ").join(".")}`;
  return element.tagName.toLowerCase();
}

/**
 * Run full page accessibility audit
 * @param {HTMLElement} container - Page container (usually document.body)
 * @returns {Promise<Object>} Full audit results
 */
export async function runFullPageAudit(container: ElementContext = document.body) {
  const results = await runAxe(container, {
    rules: {
      ...axeConfig.rules,
      // Disable rules that need manual review
      "landmark-one-main": { enabled: false }, // May have multiple mains in SPA
      region: { enabled: false }, // SPA regions handled by router
    },
  });

  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    violations: results.violations,
    incomplete: results.incomplete,
    passes: results.passes.length,
    summary: {
      total: results.violations.length,
      critical: results.violations.filter((v) => v.impact === "critical")
        .length,
      serious: results.violations.filter((v) => v.impact === "serious").length,
      moderate: results.violations.filter((v) => v.impact === "moderate")
        .length,
      minor: results.violations.filter((v) => v.impact === "minor").length,
    },
  };
}

export default {
  runAxe,
  testComponentA11y,
  runFullPageAudit,
  testKeyboardNavigation,
  checkColorContrast,
  axeConfig,
};
