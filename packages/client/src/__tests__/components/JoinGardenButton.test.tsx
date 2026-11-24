import messages from "@green-goods/shared/i18n/en.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** Mirror the breakpoint that switches the confirmation between sheet and dialog. */
function stubViewport(width = 390) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width: 639px") && width < 640,
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
    stubViewport();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it.each([
    [375, "Escape"],
    [375, "Close"],
    [375, "Cancel"],
    [1280, "Escape"],
    [1280, "Close"],
    [1280, "Cancel"],
  ] as const)("restores a pointer opener at %ipx after %s without joining", async (width, dismiss) => {
    stubViewport(width);
    renderOnGardenPage();
    const user = userEvent.setup();
    const opener = screen.getByRole("button", { name: "Join Garden" });
    screen.getByRole("button", { name: "/home/0xgarden" }).focus();
    // Safari leaves focus where it was on pointer activation. fireEvent does not focus the button.
    fireEvent.click(opener);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    if (dismiss === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: dismiss }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
    expect(mockJoinGarden).not.toHaveBeenCalled();
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
