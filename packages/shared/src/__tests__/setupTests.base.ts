/**
 * Base Test Setup for Green Goods Monorepo
 *
 * Provides common test environment configuration shared across all packages: the Node-safe core
 * in `setupTests.core.ts` plus the DOM layer. Individual packages extend this base setup with
 * package-specific mocks.
 */

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

import "@testing-library/jest-dom/vitest";

import { setupCoreTestEnvironment } from "./setupTests.core";

// Lit queues a one-time dev-mode banner on first import. Pre-mark that code as
// already issued so focused test runs stay readable without hiding other warnings.
const litGlobal = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
litGlobal.litIssuedWarnings ??= new Set<string>();
litGlobal.litIssuedWarnings.add("dev-mode");

// Polyfill HTMLDialogElement.showModal/close for jsdom.
// jsdom doesn't implement the <dialog> top-layer API, which components that use
// a native <dialog> for focus trap and Escape handling rely on.
if (typeof window !== "undefined") {
  const dialogProto = (window as any).HTMLDialogElement?.prototype;
  if (dialogProto) {
    dialogProto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    dialogProto.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }
}

// Mock matchMedia immediately (before any module imports that might use it)
// This needs to be at the top level, not in beforeAll, because it's called during module import
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

/**
 * Setup common test environment
 * Call this from package-specific setupTests files
 */
export function setupTestEnvironment() {
  // Node-safe hooks first: after-hooks run in reverse, so DOM cleanup still precedes their resets.
  setupCoreTestEnvironment();

  beforeAll(() => {
    // Mock window properties (only in browser-like environments)
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000",
          origin: "http://localhost:3000",
          pathname: "/",
          search: "",
          hash: "",
          hostname: "localhost",
          assign: vi.fn(),
          replace: vi.fn(),
          reload: vi.fn(),
        },
        writable: true,
      });

      // Mock window.addEventListener for online/offline events
      const eventListeners: Record<string, Function[]> = {};
      (global.window.addEventListener as any) = vi.fn((event: string, listener: Function) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(listener);
      });

      (global.window.removeEventListener as any) = vi.fn((event: string, listener: Function) => {
        if (eventListeners[event]) {
          const index = eventListeners[event].indexOf(listener);
          if (index > -1) eventListeners[event].splice(index, 1);
        }
      });

      (global.window.dispatchEvent as any) = vi.fn((event: Event) => {
        const listeners = eventListeners[event.type] || [];
        listeners.forEach((listener) => listener(event));
        return true;
      });
    }

    // Mock IntersectionObserver (class-based — must be `new`-able since
    // useInViewReveal and other hooks construct an instance directly).
    (global as any).IntersectionObserver = class IntersectionObserver {
      // Declared so callers can construct it the way the real API is used;
      // nothing observes in jsdom, so the callback is held and never fired.
      constructor(
        public callback?: unknown,
        public options?: unknown
      ) {}
      root = null;
      rootMargin = "";
      thresholds: number[] = [];
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
    };

    // Mock ResizeObserver (class-based for @floating-ui/dom compatibility)
    (global as any).ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    };
  });

  // Cleanup after each test
  afterEach(() => {
    if (typeof document !== "undefined") cleanup();
  });
}

// Auto-run setup for shared package tests
setupTestEnvironment();
