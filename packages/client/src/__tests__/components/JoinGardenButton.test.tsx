import messages from "@green-goods/shared/i18n/en.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockJoinGarden = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@green-goods/shared/hooks/garden/useJoinGarden", () => ({
  useJoinGarden: () => ({ joinGarden: mockJoinGarden, isJoining: false }),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import { JoinGardenButton } from "@/components/Features/Garden/JoinGardenButton";

/** Render at phone width, where the confirmation is a bottom sheet. */
function stubPhoneViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width: 639px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("JoinGardenButton", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    stubPhoneViewport();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("asks for confirmation before joining, then joins and closes", async () => {
    mockJoinGarden.mockResolvedValue("joined");
    render(
      <IntlProvider locale="en" messages={messages}>
        <JoinGardenButton gardenId="0xgarden" gardenName="Open Garden" />
      </IntlProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    expect(mockJoinGarden).not.toHaveBeenCalled();
    expect(
      screen.getByText("You'll join Open Garden as a Gardener and can submit work right away.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(mockJoinGarden).toHaveBeenCalledWith("0xgarden"));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());
  });

  it("reports a failed join and closes the confirmation", async () => {
    mockJoinGarden.mockRejectedValue(new Error("rejected"));
    render(
      <IntlProvider locale="en" messages={messages}>
        <JoinGardenButton gardenId="0xgarden" gardenName="Open Garden" />
      </IntlProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());
  });
});
