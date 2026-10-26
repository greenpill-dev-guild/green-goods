import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIntl } from "react-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useActionTranslation } from "../../hooks/translation/useActionTranslation";
import { AppProvider, useApp } from "../../providers/App";
import type { Action } from "../../types/domain";

// The Portuguese catalogue never arrives in this file, as on a phone whose offline tier has not landed.
vi.mock("../../i18n/pt.json", () => {
  throw new Error("catalogue not cached");
});

// A template that stores a reviewed translation in both languages, as the live ones do.
const template: Action = {
  id: "1",
  slug: "agro.planting_event",
  title: "Planting Event",
  description: "",
  startTime: 0,
  endTime: 0,
  createdAt: 0,
  capitals: [],
  media: [],
  domain: null,
  inputs: [],
  translations: {
    es: { status: "reviewed", data: { title: "Evento de siembra" } },
    pt: { status: "reviewed", data: { title: "Evento de plantio" } },
  },
};

// What each render showed: the display language, the page copy and the stored template title.
const renders: Array<[language: string, copy: string, title: string]> = [];

/** Renders whose display language or stored translation is not the language of their copy. */
function mixedRenders() {
  return renders.filter(([language, copy, title]) => {
    const spanishCopy = copy === "Cerrar";
    return (language === "es") !== spanishCopy || (title === "Evento de siembra") !== spanishCopy;
  });
}

/** Watches the page's lang from here on: each language it declares, in order, without repeats. */
function trackPageLanguage(): () => string[] {
  const setLanguage = vi.spyOn(document.documentElement, "lang", "set");
  return () =>
    setLanguage.mock.calls
      .map(([language]) => language)
      .filter((language, index, all) => index === 0 || language !== all[index - 1]);
}

function LanguageProbe() {
  const { switchLanguage } = useApp();
  const { locale, formatMessage } = useIntl();
  const copy = formatMessage({ id: "app.common.close", defaultMessage: "fallback copy" });
  const title = useActionTranslation(template).translatedAction?.title ?? "";
  renders.push([locale, copy, title]);
  return (
    <>
      <p>{copy}</p>
      <p>{title}</p>
      <button type="button" onClick={() => switchLanguage("es")}>
        switch to es
      </button>
    </>
  );
}

function renderApp() {
  return render(
    <AppProvider allowPosthogKeyFallback={false}>
      <LanguageProbe />
    </AppProvider>
  );
}

describe("AppProvider page language", () => {
  beforeAll(async () => {
    // Transform the catalogues that do arrive once, up front, so a cold transform on a busy
    // machine never eats into a test's wait. A load from the warm cache still lands after the
    // first render, as on a device.
    await Promise.all([import("../../i18n/en.json"), import("../../i18n/es.json")]);
  });

  beforeEach(() => {
    localStorage.clear();
    renders.length = 0;
    // What the page says before the app runs where index.html has not declared the reader's
    // language already, as in the admin.
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares a stored language from the first render and keeps it when its copy lands", async () => {
    localStorage.setItem("gg-language", "es");
    const declared = trackPageLanguage();
    renderApp();

    // The Spanish catalogue is still loading, so the copy on screen is the fallback.
    expect(screen.getByText("fallback copy")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");

    expect(await screen.findByText("Cerrar")).toBeInTheDocument();
    expect(declared()).toEqual(["es"]);
  });

  // The choice index.html makes before the app loads: the stored language, else the first browser
  // language the app has copy for, else English.
  it.each([
    { stored: null, browser: ["es-MX", "en"], language: "es" },
    { stored: null, browser: ["fr-FR", "pt-BR"], language: "pt" },
    { stored: "fr", browser: ["es-MX"], language: "en" },
  ])("declares $language from the first render for a stored $stored and a browser on $browser", async ({
    stored,
    browser,
    language,
  }) => {
    if (stored) localStorage.setItem("gg-language", stored);
    vi.spyOn(navigator, "languages", "get").mockReturnValue(browser);
    renderApp();

    expect(document.documentElement.lang).toBe(language);
    await act(() => vi.dynamicImportSettled());
  });

  it("keeps the old language until the new copy is on screen", async () => {
    renderApp();
    expect(await screen.findByText("Close")).toBeInTheDocument();
    const declared = trackPageLanguage();

    fireEvent.click(screen.getByRole("button", { name: "switch to es" }));
    // The Spanish catalogue is still loading, so the page still reads English.
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Planting Event")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    expect(await screen.findByText("Cerrar")).toBeInTheDocument();
    expect(screen.getByText("Evento de siembra")).toBeInTheDocument();
    await waitFor(() => expect(declared()).toEqual(["es"]));
    // The display language and the stored translation changed in the render the copy did.
    expect(mixedRenders()).toEqual([]);
  });

  it("corrects to English once only English copy can show", async () => {
    localStorage.setItem("gg-language", "pt");
    const declared = trackPageLanguage();
    renderApp();
    // Wait for both the failed Portuguese import and its English fallback.
    await act(() => vi.dynamicImportSettled());

    expect(await screen.findByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Planting Event")).toBeInTheDocument();
    expect(new Set(renders.map(([language]) => language))).toEqual(new Set(["en"]));
    expect(declared()).toEqual(["pt", "en"]);
  });

  it("settles on English when no catalogue can load", async () => {
    localStorage.setItem("gg-language", "pt");
    const importCatalogue = vi.fn(async (_locale: "en" | "pt" | "es"): Promise<never> => {
      throw new Error("offline and not cached");
    });
    const declared = trackPageLanguage();
    render(
      <AppProvider allowPosthogKeyFallback={false} importCatalogue={importCatalogue}>
        <LanguageProbe />
      </AppProvider>
    );

    await waitFor(() => expect(declared()).toEqual(["pt", "en"]));
    expect(importCatalogue.mock.calls.map(([locale]) => locale)).toEqual(["pt", "en"]);
    expect(screen.getByText("fallback copy")).toBeInTheDocument();
  });

  it("uses a surface catalogue and retains the shared English recovery path", async () => {
    localStorage.setItem("gg-language", "pt");
    const importCatalogue = vi.fn(async (locale: "en" | "pt" | "es") => {
      if (locale !== "en") throw new Error("public catalogue not cached");
      return { locale, messages: { "app.common.close": "Public close" } };
    });
    render(
      <AppProvider allowPosthogKeyFallback={false} importCatalogue={importCatalogue}>
        <LanguageProbe />
      </AppProvider>
    );
    expect(await screen.findByText("Public close")).toBeInTheDocument();
    expect(importCatalogue.mock.calls.map(([locale]) => locale)).toEqual(["pt", "en"]);
    expect(document.documentElement.lang).toBe("en");
  });
});
