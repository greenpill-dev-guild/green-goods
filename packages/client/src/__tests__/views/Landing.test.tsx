/**
 * Landing View Tests
 *
 * Smoke tests for the public landing page.
 * This page should work without authentication.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderWithIntl = (element: ReactElement) =>
  render(createElement(IntlProvider, { locale: "en", messages: {} }, element));

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  toastService: { success: vi.fn(), error: vi.fn() },
}));

// Mock client components
vi.mock("@/components/Layout/Hero", () => ({
  Hero: ({ handleSubscribe }: { handleSubscribe: (e: any) => void }) =>
    createElement(
      "div",
      { "data-testid": "hero" },
      createElement(
        "form",
        {
          "data-testid": "subscribe-form",
          onSubmit: handleSubscribe,
        },
        createElement("input", { name: "email", placeholder: "Email" }),
        createElement("button", { type: "submit" }, "Subscribe")
      )
    ),
}));

import Landing from "../../views/Landing";

describe("Landing View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders hero section with subscribe form", () => {
    renderWithIntl(createElement(Landing));

    expect(screen.getByTestId("hero")).toBeInTheDocument();
    expect(screen.getByTestId("subscribe-form")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });

  it("has the landing root container", () => {
    const { container } = renderWithIntl(createElement(Landing));

    const root = container.querySelector("#landing-root");
    expect(root).toBeInTheDocument();
  });
});
