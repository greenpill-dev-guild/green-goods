/**
 * useActionTranslation Tests
 *
 * Tests the action-specific translation wrapper that translates
 * title, description, mediaInfo, details, review, and inputs fields.
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

import { useActionTranslation } from "../../../hooks/translation/useActionTranslation";
import { AppContext } from "../../../providers/App";
import type { Action } from "../../../types/domain";

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

function createAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    slug: "agro.planting",
    startTime: Date.now(),
    endTime: Date.now() + 86400000,
    title: "Plant Trees",
    description: "Plant trees in the garden",
    instructions: "Dig a hole",
    capitals: [],
    media: [],
    domain: 1,
    createdAt: Date.now(),
    inputs: [],
    mediaInfo: "Take photo of planted tree",
    details: "Detailed instructions here",
    review: "Review criteria",
    ...overrides,
  } as Action;
}

// ============================================
// Tests
// ============================================

describe("useActionTranslation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null translatedAction when action is null", () => {
    const { result } = renderHook(() => useActionTranslation(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.translatedAction).toBeNull();
    expect(result.current.isTranslating).toBe(false);
  });

  it("returns the action fields unchanged when locale matches source (en)", () => {
    const action = createAction();
    const { result } = renderHook(() => useActionTranslation(action), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedAction).not.toBeNull();
    expect(result.current.translatedAction!.title).toBe("Plant Trees");
    expect(result.current.translatedAction!.description).toBe("Plant trees in the garden");
    expect(result.current.translatedAction!.mediaInfo).toBe("Take photo of planted tree");
    expect(result.current.translatedAction!.details).toBe("Detailed instructions here");
    expect(result.current.translatedAction!.review).toBe("Review criteria");
    expect(result.current.isTranslating).toBe(false);
  });

  it("preserves non-translated action fields", () => {
    const action = createAction({ id: "special-id", slug: "edu.workshop" });
    const { result } = renderHook(() => useActionTranslation(action), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedAction!.id).toBe("special-id");
    expect(result.current.translatedAction!.slug).toBe("edu.workshop");
  });

  it("preserves inputs when translation API is not supported", () => {
    const action = createAction({
      inputs: [
        { label: "Trees Planted", type: "number" },
        { label: "Area Covered", type: "number" },
      ] as any[],
    });

    const { result } = renderHook(() => useActionTranslation(action), {
      wrapper: createWrapper("es"),
    });

    // With API unsupported, translated falls back to original
    expect(result.current.translatedAction!.inputs).toEqual(action.inputs);
  });

  it("handles action with undefined optional fields", () => {
    const action = createAction({
      mediaInfo: undefined,
      details: undefined,
      review: undefined,
    });

    const { result } = renderHook(() => useActionTranslation(action), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.translatedAction).not.toBeNull();
    // Falls back to original values (which are undefined)
    expect(result.current.translatedAction!.mediaInfo).toBeUndefined();
  });

  it("reports isTranslating as false when all fields are settled", () => {
    const action = createAction();
    const { result } = renderHook(() => useActionTranslation(action), {
      wrapper: createWrapper("en"),
    });

    expect(result.current.isTranslating).toBe(false);
  });
});
