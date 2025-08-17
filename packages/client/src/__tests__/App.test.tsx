import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, it, vi } from "vitest";

import { Root } from "../main";

// Mock browser-lang to prevent null language error
Object.defineProperty(navigator, "language", {
  writable: true,
  value: "en-US",
});

// Mock window.matchMedia for PWA detection
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("App", () => {
  beforeEach(() => {
    // Ensure language is set for each test
    Object.defineProperty(navigator, "language", {
      writable: true,
      value: "en-US",
    });
  });

  it("renders the App component", () => {
    render(<Root />);
    screen.debug(); // prints out the jsx in the App component unto the command line
  });
});
