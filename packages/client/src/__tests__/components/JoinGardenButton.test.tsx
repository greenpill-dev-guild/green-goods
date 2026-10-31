import messages from "@green-goods/shared/i18n/en.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
// The button loads this with its first press; a slow first import is not what these tests prove.
import "@/components/Features/Garden/JoinGardenConfirmDialog";

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

function Place() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      {useLocation().pathname}
    </button>
  );
}

/** The button on a garden's page, as a visit from Explore opens it. */
function renderOnGardenPage() {
  render(
    <MemoryRouter initialEntries={["/home/explore", "/home/0xgarden"]} initialIndex={1}>
      <IntlProvider locale="en" messages={messages}>
        <Place />
        <JoinGardenButton gardenId="0xgarden" gardenName="Open Garden" />
      </IntlProvider>
    </MemoryRouter>
  );
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

  it("asks for confirmation before joining, then joins and opens Home in place of the visit", async () => {
    mockJoinGarden.mockResolvedValue("joined");
    renderOnGardenPage();

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    expect(mockJoinGarden).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "You'll join Open Garden as a gardener and can submit work right away."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(mockJoinGarden).toHaveBeenCalledWith("0xgarden"));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());

    // Back steps past the garden's page, to the Explore list the visit came from.
    fireEvent.click(await screen.findByRole("button", { name: "/home" }));
    expect(await screen.findByRole("button", { name: "/home/explore" })).toBeInTheDocument();
  });

  it("opens Home in a garden the chain says the member already belongs to", async () => {
    mockJoinGarden.mockResolvedValue("already-member");
    renderOnGardenPage();

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Join" }));

    expect(await screen.findByRole("button", { name: "/home" })).toBeInTheDocument();
  });

  it("stays on the page and reports nothing while a join is already in flight", async () => {
    mockJoinGarden.mockResolvedValue("already-joining");
    renderOnGardenPage();

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Join" }));
    await waitFor(() => expect(mockJoinGarden).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "/home/0xgarden" })).toBeInTheDocument();
  });

  it("reports a failed join, closes the confirmation and stays on the page", async () => {
    mockJoinGarden.mockRejectedValue(new Error("rejected"));
    renderOnGardenPage();

    fireEvent.click(screen.getByRole("button", { name: "Join Garden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Join" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "/home/0xgarden" })).toBeInTheDocument();
  });
});
