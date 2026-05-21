/**
 * AddressDisplay Tests
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../types";

const mockUseEnsName = vi.fn();

vi.mock("../../hooks/blockchain/useEnsName", () => ({
  useEnsName: (...args: unknown[]) => mockUseEnsName(...args),
}));

import { AddressDisplay } from "../../components/AddressDisplay";
import enMessages from "../../i18n/en.json";

const TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const SHORT_TEST_ADDRESS = "0x12...678";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderAddressDisplay(ui: React.ReactElement) {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={enMessages}>
        {ui}
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("AddressDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEnsName.mockReturnValue({ data: null });
  });

  it("renders a resolved Green Goods ENS name as the display label", () => {
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });

    renderAddressDisplay(<AddressDisplay address={TEST_ADDRESS} showCopyButton={false} />);

    expect(screen.getByRole("button", { name: "river" })).toBeInTheDocument();
    expect(mockUseEnsName).toHaveBeenCalledWith(TEST_ADDRESS);
    expect(screen.queryByRole("button", { name: SHORT_TEST_ADDRESS })).not.toBeInTheDocument();
  });

  it("keeps the shortened raw address fallback when no ENS name resolves", () => {
    renderAddressDisplay(<AddressDisplay address={TEST_ADDRESS} showCopyButton={false} />);

    expect(screen.getByRole("button", { name: SHORT_TEST_ADDRESS })).toBeInTheDocument();
    expect(mockUseEnsName).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("keeps the shortened raw address fallback when ENS lookup errors", () => {
    mockUseEnsName.mockReturnValue({ data: null, error: new Error("RPC timeout"), isError: true });

    renderAddressDisplay(<AddressDisplay address={TEST_ADDRESS} showCopyButton={false} />);

    expect(screen.getByRole("button", { name: SHORT_TEST_ADDRESS })).toBeInTheDocument();
    expect(mockUseEnsName).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("keeps the copy button usable", async () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    const user = userEvent.setup();
    const { container } = renderAddressDisplay(<AddressDisplay address={TEST_ADDRESS} />);

    await user.click(screen.getByTitle("Copy address"));

    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith("copy");
    });
    expect(container.querySelector(".text-success-dark")).toBeTruthy();
  });
});
