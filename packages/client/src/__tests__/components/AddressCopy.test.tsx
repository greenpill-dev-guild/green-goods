/** @vitest-environment jsdom */

import { act, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test-utils";

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  reset: null as null | (() => void),
}));

vi.mock("@green-goods/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared")>()),
  copyToClipboard: (...args: unknown[]) => mocks.copy(...args),
  toastService: { success: mocks.success, error: mocks.error },
  useTimeout: () => ({
    set: (callback: () => void) => {
      mocks.reset = callback;
    },
  }),
}));

const { AddressCopy } = await import("@/components/Inputs/Clipboard/AddressCopy");
const ADDRESS = "0x1111111111111111111111111111111111111111" as const;

describe("AddressCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reset = null;
    mocks.copy.mockResolvedValue(undefined);
  });

  it("copies, announces success, and resets its status", async () => {
    renderWithProviders(<AddressCopy address={ADDRESS} ensName="garden.eth" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await screen.findByText("Copied");
    expect(mocks.copy).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByRole("status")).toHaveTextContent(/Copied garden.eth/);

    act(() => mocks.reset?.());
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("keeps copy available and reports a clipboard failure", async () => {
    mocks.copy.mockRejectedValue(new Error("Clipboard denied"));
    renderWithProviders(<AddressCopy address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("renders nothing without an address", () => {
    const { container } = renderWithProviders(<AddressCopy />);
    expect(container).toBeEmptyDOMElement();
  });
});
