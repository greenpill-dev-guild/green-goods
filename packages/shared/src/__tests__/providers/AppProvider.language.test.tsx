import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIntl } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    localStorage.clear();
    renders.length = 0;
    // What index.html ships.
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares a stored language once its copy is on screen", async () => {
    localStorage.setItem("gg-language", "es");
    renderApp();

    expect(await screen.findByText("Cerrar")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });

  it("names the app language, not the browser's regional tag", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["es-MX", "en"]);
    renderApp();

    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });

  it("keeps the old language until the new copy is on screen", async () => {
    renderApp();
    expect(await screen.findByText("Close")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch to es" }));
    // The Spanish catalogue is still loading, so the page still reads English.
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Planting Event")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    expect(await screen.findByText("Cerrar")).toBeInTheDocument();
    expect(screen.getByText("Evento de siembra")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
    // The display language and the stored translation changed in the render the copy did.
    expect(mixedRenders()).toEqual([]);
  });

  it("stays in English when a reader's own catalogue has not landed", async () => {
    localStorage.setItem("gg-language", "pt");
    renderApp();

    expect(await screen.findByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Planting Event")).toBeInTheDocument();
    expect(new Set(renders.map(([language]) => language))).toEqual(new Set(["en"]));
    expect(document.documentElement.lang).toBe("en");
  });
});
