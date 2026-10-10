import { describe, expect, it, vi } from "vitest";
import {
  createBrowserTranslator,
  detectTranslatorApi,
  type StableTranslatorApi,
} from "../modules/translation/browser-translator";
import type { TranslationCache } from "../modules/translation/db";

function cache(overrides: Partial<TranslationCache> = {}): TranslationCache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("translation ports", () => {
  it("detects stable, AI, and legacy API shapes without conflating them", () => {
    const stable = { create: vi.fn() };
    const ai = { create: vi.fn() };
    const legacy = { createTranslator: vi.fn() };

    expect(detectTranslatorApi({ Translator: stable, ai: { translator: ai } })).toEqual({
      kind: "stable",
      api: stable,
    });
    expect(detectTranslatorApi({ ai: { translator: ai } })).toEqual({ kind: "ai", api: ai });
    expect(detectTranslatorApi({ translation: legacy })).toEqual({
      kind: "legacy",
      api: legacy,
    });
    expect(detectTranslatorApi({})).toEqual({ kind: "unsupported" });
  });

  it("returns cached text without creating a browser translation session", async () => {
    const api: StableTranslatorApi = { create: vi.fn() };
    const translationCache = cache({ get: vi.fn().mockResolvedValue("Hola") });
    const translator = createBrowserTranslator({
      api: { kind: "stable", api },
      cache: translationCache,
    });

    await expect(translator.translate("Hello", "es")).resolves.toBe("Hola");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("reuses a language-pair session and writes translated text to the cache", async () => {
    const translate = vi.fn(async (text: string) => `es:${text}`);
    const api: StableTranslatorApi = {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue({ translate }),
    };
    const translationCache = cache();
    const translator = createBrowserTranslator({
      api: { kind: "stable", api },
      cache: translationCache,
    });

    await expect(translator.translateBatch(["Hello", "World"], "es")).resolves.toEqual([
      "es:Hello",
      "es:World",
    ]);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(translationCache.set).toHaveBeenCalledTimes(2);
  });
});
