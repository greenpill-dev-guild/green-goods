/**
 * Public Garden Dialog Tests
 *
 * Locks the close-stagger choreography:
 * - Clicking close defers navigation by ~480ms (the body-stagger window)
 *   so the dialog content evacuates before the View Transitions API
 *   reverses the hero morph back to the originating card.
 * - Reduced-motion users bypass the stagger and navigate immediately.
 * - The dialog Content carries `data-closing="true"` during the close
 *   window — the matching CSS rules in editorial.css drive the per-row
 *   reverse stagger.
 *
 * Visual quality of the morph and per-row stagger cannot be verified in
 * jsdom (no real animation timeline); see proof_limit in the lane handoff.
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const mockGarden = {
  id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Test Garden",
  description: "A test garden",
  location: "Somewhere",
  bannerImage: "",
  works: [],
  operators: [],
  evaluators: [],
};

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return {
    ...actual,
    usePublicGardenDetail: () => ({
      data: {
        garden: mockGarden,
        totalFieldNotes: 0,
        contributors: [],
        assessmentCount: 0,
        fieldNotes: [],
      },
      isLoading: false,
    }),
    useHypercerts: () => ({ hypercerts: [], isLoading: false }),
  };
});

import GardenDialog from "../../views/Public/GardenDialog";

const messages: Record<string, string> = {
  "public.gardenDialog.close": "Close",
  "public.gardenDialog.entries": "Entries",
  "public.gardenDialog.handsAtWork": "Hands at work",
  "public.gardenDialog.assessments": "Assessments",
  "public.gardenDialog.certificates": "Certificates",
  "public.gardenDialog.notes.heading": "Latest field notes",
  "public.gardenDialog.notes.helper": "Helper",
  "public.gardenDialog.notes.empty": "No notes yet",
  "public.gardenDialog.support": "Support this Garden",
  "public.gardenDialog.evidence": "View public evidence",
};

function renderDialog() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/gardens/test-garden"] },
      createElement(
        IntlProvider,
        { locale: "en", messages, defaultLocale: "en" },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/gardens/:id",
            element: createElement(GardenDialog),
          })
        )
      )
    )
  );
}

const CLOSE_STAGGER_DURATION_MS = 480;

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("GardenDialog close choreography", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateSpy.mockClear();
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    document.querySelectorAll("[data-testid='origin-card']").forEach((node) => node.remove());
    vi.useRealTimers();
  });

  it("defers navigate by the close-stagger window after clicking close", () => {
    const origin = document.createElement("a");
    origin.href = "/gardens/test-garden";
    origin.textContent = "Test Garden";
    origin.dataset.testid = "origin-card";
    document.body.appendChild(origin);

    const { unmount } = renderDialog();

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    // RED — click alone does not navigate; the stagger evacuates first.
    expect(navigateSpy).not.toHaveBeenCalled();

    // The Dialog.Content carries the closing flag for editorial.css to bind.
    const content = document.querySelector(".public-garden-dialog");
    expect(content?.getAttribute("data-closing")).toBe("true");

    // Just before the stagger total — still no navigation.
    act(() => {
      vi.advanceTimersByTime(CLOSE_STAGGER_DURATION_MS - 1);
    });
    expect(navigateSpy).not.toHaveBeenCalled();

    // GREEN — passing the stagger total triggers navigate with viewTransition.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(navigateSpy).toHaveBeenCalledWith("/gardens", { viewTransition: true });

    // The real route change unmounts the dialog and Radix removes aria-hidden
    // from the background card before the retry focus lands.
    unmount();
    origin.removeAttribute("aria-hidden");
    origin.removeAttribute("data-aria-hidden");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(origin).toHaveFocus();
  });

  it("bypasses the stagger and navigates immediately under reduced motion", () => {
    mockMatchMedia(true);

    const origin = document.createElement("a");
    origin.href = "/gardens/test-garden";
    origin.textContent = "Test Garden";
    origin.dataset.testid = "origin-card";
    document.body.appendChild(origin);

    const { unmount } = renderDialog();

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);

    // No data-closing flag, no deferral — navigate fires synchronously.
    const content = document.querySelector(".public-garden-dialog");
    expect(content?.getAttribute("data-closing")).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith("/gardens", { viewTransition: true });

    unmount();
    origin.removeAttribute("aria-hidden");
    origin.removeAttribute("data-aria-hidden");

    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(origin).toHaveFocus();
  });
});
