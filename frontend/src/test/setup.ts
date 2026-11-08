import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock ResizeObserver — radix Floating UI constructs it with `new`, so it
// must be an actual class rather than a factory returning a plain object.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as { new (): ResizeObserver };

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as { new (): IntersectionObserver };

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
//
// `getItem` reports Arabic as the stored language: jsdom's navigator is en-US,
// so the i18next language detector would otherwise boot the whole suite in
// English and every Arabic-text assertion in the component tests (the POS
// a11y suite, for one) would miss. Tests that need another language call
// `i18n.changeLanguage()` themselves.
const localStorageMock = {
  getItem: vi.fn((key: string) => (key === 'language' ? 'ar' : null)),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.sessionStorage = sessionStorageMock as unknown as Storage;

// Suppress console.error for known warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
      args[0]?.includes?.('act(...)') ||
      args[0]?.includes?.('useLayoutEffect does nothing on the server')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// RTL direction for all tests
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'ar';