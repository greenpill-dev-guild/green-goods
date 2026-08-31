/**
 * useTranslation Tests
 *
 * Tests the browser-based translation hook that translates content
 * using Chrome's Translation API. Covers locale matching, fallback
 * behavior, unsupported API, and recursive value translation.
 */

/**
 * @vitest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Test port
// ============================================

const mockTranslate = vi.fn();
const mockIsSupported = vi.fn().mockReturnValue(true);

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================
// Import after mocks
// ============================================

import { useTranslation } from "../../../hooks/translation/useTranslation";
import type { Translator } from "../../../modules/translation/browser-translator";
import { AppContext } from "../../../providers/App";

const translator: Translator = {
  get isSupported() {
    return mockIsSupported();
  },
  translate: (text, target, source) => mockTranslate(text, target, source),
  translateBatch: (texts, target, source) =>
    Promise.all(texts.map((text) => mockTranslate(text, target, source))),
};

// ============================================
// Test Wrapper
// ============================================

function createWrapper(locale: "en" | "es" | "pt") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const value = {
      locale,
      isMobile: false,
      isInstalled: false,
      isInstalling: false,
      isPwaPresentation: false,
      isStandalone: false,
      installState: "not-installed" as const,
      installedAppEvidence: { status: "unknown" as const, source: "unsupported" as const },
      presentationMode: "website" as const,
      wasInstalled: false,
      availableLocales: ["en", "es", "pt"] as const,
      deferredPrompt: null,
      platform: "unknown" as const,
      promptInstall: () => {},
      handleInstallCheck: () => {},
      switchLanguage: () => {},
    };
    return React.createElement(AppContext.Provider, { value }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("useTranslation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);
    mockTranslate.mockImplementation(async (text: string) => `translated:${text}`);
  });

  // ------------------------------------------
  // Same locale (no translation needed)
  // ------------------------------------------

  describe("same locale as source", () => {
    it("returns original content when locale matches sourceLang", () => {
      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("en"),
      });

      expect(result.current.translated).toBe("Hello");
      expect(result.current.isTranslating).toBe(false);
      expect(mockTranslate).not.toHaveBeenCalled();
    });

    it("returns original content with custom sourceLang match", () => {
      const { result } = renderHook(() => useTranslation("Hola", "es", { translator }), {
        wrapper: createWrapper("es"),
      });

      expect(result.current.translated).toBe("Hola");
    });
  });

  // ------------------------------------------
  // Translation needed (different locale)
  // ------------------------------------------

  describe("different locale triggers translation", () => {
    it("translates string content to target locale", async () => {
      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });

      expect(result.current.translated).toBe("translated:Hello");
      expect(mockTranslate).toHaveBeenCalledWith("Hello", "es", "en");
    });

    it("translates array of strings", async () => {
      const content = ["Hello", "World"];
      const { result } = renderHook(() => useTranslation(content, "en", { translator }), {
        wrapper: createWrapper("pt"),
      });

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });

      expect(result.current.translated).toEqual(["translated:Hello", "translated:World"]);
    });

    it("translates object values recursively", async () => {
      const content = { greeting: "Hello", farewell: "Goodbye" };
      const { result } = renderHook(
        () => useTranslation(content as Record<string, unknown>, "en", { translator }),
        {
          wrapper: createWrapper("pt"),
        }
      );

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });

      expect(result.current.translated).toEqual({
        greeting: "translated:Hello",
        farewell: "translated:Goodbye",
      });
    });

    it("sets isTranslating while translation is in progress", async () => {
      let resolveTranslation: (value: string) => void;
      mockTranslate.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveTranslation = resolve;
          })
      );

      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      // Should be translating
      await waitFor(() => {
        expect(result.current.isTranslating).toBe(true);
      });

      // Resolve translation
      resolveTranslation!("Hola");

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });
    });
  });

  // ------------------------------------------
  // Null/undefined content
  // ------------------------------------------

  describe("null/undefined content", () => {
    it("returns null for null content", () => {
      const { result } = renderHook(() => useTranslation(null, "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      expect(result.current.translated).toBeNull();
      expect(result.current.isTranslating).toBe(false);
      expect(mockTranslate).not.toHaveBeenCalled();
    });

    it("returns undefined for undefined content", () => {
      const { result } = renderHook(() => useTranslation(undefined, "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      expect(result.current.translated).toBeUndefined();
      expect(result.current.isTranslating).toBe(false);
    });
  });

  // ------------------------------------------
  // Unsupported browser API
  // ------------------------------------------

  describe("unsupported translation API", () => {
    it("returns original content when API not supported", () => {
      mockIsSupported.mockReturnValue(false);

      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      expect(result.current.translated).toBe("Hello");
      expect(result.current.isSupported).toBe(false);
      expect(mockTranslate).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("falls back to original content on translation error", async () => {
      mockTranslate.mockRejectedValue(new Error("Translation API error"));

      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });

      expect(result.current.translated).toBe("Hello");
    });

    it("falls back to original when translate returns empty string", async () => {
      mockTranslate.mockResolvedValue("");

      const { result } = renderHook(() => useTranslation("Hello", "en", { translator }), {
        wrapper: createWrapper("es"),
      });

      await waitFor(() => {
        expect(result.current.isTranslating).toBe(false);
      });

      // Empty string is falsy, so translateValue returns original
      expect(result.current.translated).toBe("Hello");
    });
  });
});
