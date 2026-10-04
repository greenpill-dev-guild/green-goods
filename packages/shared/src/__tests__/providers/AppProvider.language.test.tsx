import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormattedMessage } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../../providers/App";

// The Portuguese catalogue never arrives in this file, as on a phone whose offline tier has not landed.
vi.mock("../../i18n/pt.json", () => {
  throw new Error("catalogue not cached");
});

function LanguageProbe() {
  const { switchLanguage } = useApp();
  return (
    <>
      <p>
        <FormattedMessage id="app.common.close" defaultMessage="fallback copy" />
      </p>
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
    expect(document.documentElement.lang).toBe("en");

    expect(await screen.findByText("Cerrar")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });

  it("stays in English when a reader's own catalogue has not landed", async () => {
    localStorage.setItem("gg-language", "pt");
    renderApp();

    expect(await screen.findByText("Close")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
