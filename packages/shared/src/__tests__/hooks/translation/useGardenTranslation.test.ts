/**
 * useGardenTranslation Tests
 *
 * Tests the garden-specific translation wrapper that translates
 * name, description, and location fields of a Garden.
 */

/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/translation/browser-translator", () => ({
  browserTranslator: {
    get isSupported() {
      return false;
    },
    translate: vi.fn(),
  },
}));

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

import { useGardenTranslation } from "../../../hooks/translation/useGardenTranslation";
import { AppContext } from "../../../providers/App";
import type { Garden } from "../../../types/domain";

// ============================================
// Test Helpers
// ============================================

function createWrapper(locale = "en") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const value = {
      locale,
      isMobile: false,
      isInstalled: false,
      isStandalone: false,
      wasInstalled: false,
      availableLocales: ["en", "es"],
      deferredPrompt: null,
      platform: "unknown" as const,
      promptInstall: () => {},
      handleInstallCheck: () => {},
    };
    return React.createElement(AppContext.Provider, { value }, children);
  };
}

function createGarden(overrides: Partial<Garden> = {}): Garden {
  return {
    id: "garden-1",
    chainId: 11155111,
    tokenAddress: "0x1234567890123456789012345678901234567890",
    tokenID: BigInt(1),
    name: "Urban Garden Portland",
    description: "A community garden in Portland",
    location: "Portland, Oregon",
    bannerImage: "ipfs://QmBanner",
    createdAt: Date.now(),
    gardeners: [],
    operators: [],
    owners: [],
    evaluators: [],
    funders: [],
    assessments: [],
    works: [],
    ...overrides,
  } as Garden;
}

// ============================================
// Tests
// ============================================

describe("useGardenTranslation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null translatedGarden when garden is null", () => {
    const { result } = renderHook(() => useGardenTranslation(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.translatedGarden).toBeNull();
    expect(result.current.isTranslating).toBe(false);
  });

  it("returns garden fields unchanged when locale matches source (en)", () => {
    const garden = createGarden();
    const { result } = renderHook(() => useGardenTranslation(garden), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedGarden).not.toBeNull();
    expect(result.current.translatedGarden!.name).toBe("Urban Garden Portland");
    expect(result.current.translatedGarden!.description).toBe("A community garden in Portland");
    expect(result.current.translatedGarden!.location).toBe("Portland, Oregon");
    expect(result.current.isTranslating).toBe(false);
  });

  it("preserves non-translated garden fields", () => {
    const garden = createGarden({
      id: "special-garden",
      tokenID: BigInt(42),
      chainId: 42161,
    });

    const { result } = renderHook(() => useGardenTranslation(garden), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedGarden!.id).toBe("special-garden");
    expect(result.current.translatedGarden!.tokenID).toBe(BigInt(42));
    expect(result.current.translatedGarden!.chainId).toBe(42161);
  });

  it("preserves array fields (gardeners, operators, etc.)", () => {
    const garden = createGarden({
      gardeners: ["0xGardener1" as any],
      operators: ["0xOperator1" as any],
    });

    const { result } = renderHook(() => useGardenTranslation(garden), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedGarden!.gardeners).toEqual(["0xGardener1"]);
    expect(result.current.translatedGarden!.operators).toEqual(["0xOperator1"]);
  });

  it("reports isTranslating as false when API is unsupported and locale differs", () => {
    const garden = createGarden();
    const { result } = renderHook(() => useGardenTranslation(garden), {
      wrapper: createWrapper("es"),
    });

    // API unsupported => falls back immediately without translating
    expect(result.current.isTranslating).toBe(false);
    // Falls back to original values
    expect(result.current.translatedGarden!.name).toBe("Urban Garden Portland");
  });

  it("handles garden with empty string fields", () => {
    const garden = createGarden({
      name: "",
      description: "",
      location: "",
    });

    const { result } = renderHook(() => useGardenTranslation(garden), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedGarden!.name).toBe("");
    expect(result.current.translatedGarden!.description).toBe("");
    expect(result.current.translatedGarden!.location).toBe("");
  });
});
