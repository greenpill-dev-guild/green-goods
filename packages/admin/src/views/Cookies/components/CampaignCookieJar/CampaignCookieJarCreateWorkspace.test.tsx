/**
 * The Create Cookie Jar flow decides how it ends: on its Review (DL-080), where the status row
 * shows the send and the footer becomes Done. A create whose jar address is not yet known shows
 * the submitted transaction and takes the address by hand, only a valid address completes it,
 * "Create Another" starts a clean draft at the first step, and a failed create stays on the Review
 * with its error and Try Again.
 */

import type { CampaignCookieJar } from "@green-goods/shared/types/cookie-jar";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen } from "../../../../__tests__/test-utils";

const OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x9999999999999999999999999999999999999999";
const JAR = "0x7777777777777777777777777777777777777777";
const SUBMITTED_HASH = `0x${"ab".repeat(32)}`;

const createJar = vi.hoisted(() => ({
  reset: vi.fn(),
  mutate: vi.fn(),
  isPending: false,
  error: null as Error | null,
}));

const payoutReads = vi.hoisted(() => ({
  jar: undefined as
    | Pick<
        CampaignCookieJar,
        | "balance"
        | "decimals"
        | "symbol"
        | "withdrawalType"
        | "fixedAmount"
        | "maxWithdrawal"
        | "allowlist"
      >
    | undefined,
  customToken: undefined as { result?: number | string }[] | undefined,
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: OWNER }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [], isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar", () => ({
  useCreateCampaignCookieJar: () => ({
    mutate: createJar.mutate,
    reset: createJar.reset,
    isPending: createJar.isPending,
    error: createJar.error,
  }),
  useCampaignCookieJar: () => ({
    jar: payoutReads.jar,
    isLoading: false,
    hasDetailReadFailure: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarFactoryAddress", () => ({
  useCookieJarFactoryAddress: () => ({
    factoryAddress: FACTORY,
    moduleConfigured: true,
    isLoading: false,
  }),
}));
vi.mock("@green-goods/shared/hooks/gardener/useRole", () => ({
  useRole: () => ({ isProtocolTeam: true, loading: false }),
}));
// The route blocker needs a data router; closing is not what these cases test.
vi.mock("@green-goods/shared/hooks/admin-ui/useDirtyClose", () => ({
  useDirtyClose: ({ onClose }: { onClose: () => void }) => ({
    onOpenChange: (open: boolean) => {
      if (!open) onClose();
    },
    confirmOpen: false,
    cancelClose: () => {},
    confirmClose: () => {},
  }),
}));
vi.mock("wagmi", () => ({
  useReadContracts: () => ({ data: payoutReads.customToken, isLoading: false, isFetching: false }),
}));
vi.mock("@/components/EnsAddressText", () => ({
  EnsAddressText: ({ address }: { address: string }) => address,
}));

import { CampaignCookieJarCreateWorkspace } from "./CampaignCookieJarCreateWorkspace";

beforeEach(() => {
  createJar.reset.mockReset();
  createJar.mutate.mockReset();
  createJar.isPending = false;
  createJar.error = null;
  payoutReads.jar = undefined;
  payoutReads.customToken = undefined;
});

describe("CampaignCookieJarCreateWorkspace", () => {
  it("creates a recurring USDC jar for an explicit steward roster and Safe owner", async () => {
    const safe = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
    const steward = "0x2222222222222222222222222222222222222222";
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Campaign name/), {
      target: { value: "Pilot steward work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Claim schedule"), { target: { value: "recurring" } });
    fireEvent.change(screen.getByLabelText("Maximum claim per steward"), {
      target: { value: "120" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByText("Advanced", { selector: "summary" }));
    fireEvent.change(await screen.findByLabelText("Jar owner"), { target: { value: safe } });
    fireEvent.change(screen.getByLabelText("Extra allowlist addresses"), {
      target: { value: steward },
    });

    expect(screen.getByText("Up to 120 USDC every 30 days")).toBeInTheDocument();
    expect(screen.getByText(safe)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Cookie Jar" }));

    expect(createJar.mutate).toHaveBeenCalledTimes(1);
    expect(createJar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        jarOwner: safe,
        allowlist: [steward],
        sourceGardens: [],
        fixedAmount: 0n,
        maxWithdrawal: 120_000_000n,
        withdrawalInterval: 2_592_000n,
        withdrawalType: "variable",
        oneTimeWithdrawal: false,
      }),
      expect.anything()
    );
  });

  it("shows the submitted transaction until the steward supplies the created jar's address", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialSubmittedHash={SUBMITTED_HASH} />
    );

    expect(screen.getByText("Creation submitted")).toBeInTheDocument();
    // Its Review, ending on Done: the jar to finish has no fresh start yet.
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Another" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Created jar address"), { target: { value: JAR } });
    fireEvent.click(screen.getByRole("button", { name: "Use jar address" }));

    expect(screen.getByText("Cookie jar created")).toBeInTheDocument();
    expect(screen.getAllByText(JAR).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Create Another" })).toBeInTheDocument();
  });

  it("shows the onchain maximum after creating a recurring jar", () => {
    payoutReads.jar = {
      balance: 0n,
      decimals: 6,
      symbol: "USDC",
      withdrawalType: "variable",
      fixedAmount: 0n,
      maxWithdrawal: 120_000_000n,
      allowlist: [OWNER],
    };
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialCreatedJarAddress={JAR} />
    );

    const label = screen.getByText("Maximum claim per steward");
    expect(label.closest("dt")?.nextElementSibling).toHaveTextContent("120 USDC");
  });

  it("reviews the amount and cadence when custom token decimals are known but its symbol is not", async () => {
    payoutReads.customToken = [{ result: 6 }, {}];
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Campaign name/), { target: { value: "Pilot" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Claim schedule"), { target: { value: "recurring" } });
    fireEvent.change(screen.getByLabelText("Maximum claim per steward"), {
      target: { value: "120.000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByText("Advanced", { selector: "summary" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use custom token" }));
    fireEvent.change(screen.getByLabelText("ERC20 token address"), { target: { value: JAR } });
    fireEvent.change(screen.getByLabelText("Extra allowlist addresses"), {
      target: { value: OWNER },
    });

    expect(screen.getByRole("button", { name: "Create Cookie Jar" })).toBeEnabled();
    expect(screen.getByText("Up to 120.000001 every 30 days")).toBeInTheDocument();
  });

  it("does not complete the flow with a malformed jar address", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialSubmittedHash={SUBMITTED_HASH} />
    );

    fireEvent.change(screen.getByLabelText("Created jar address"), { target: { value: "0x7777" } });

    expect(screen.getByRole("button", { name: "Use jar address" })).toBeDisabled();
    expect(screen.queryByText("Cookie jar created")).toBeNull();
  });

  it("starts another jar from a clean first step", () => {
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialCreatedJarAddress={JAR} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Another" }));

    expect(screen.getByLabelText(/Campaign name/)).toHaveValue("");
    expect(screen.queryByText("Cookie jar created")).toBeNull();
    expect(createJar.reset).toHaveBeenCalledTimes(1);
  });

  it("ends a created jar on its Review with Done, back to the cookie jar list", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CampaignCookieJarCreateWorkspace onClose={onClose} initialCreatedJarAddress={JAR} />
    );

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByText("Cookie jar created")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Cookie Jar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    // Advanced changes what Create sends, so it is gone once the jar exists.
    expect(screen.queryByText(/Advanced/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed create on the Review with its error, Try Again and Back", () => {
    createJar.error = new Error("Execution reverted: factory paused");
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    const row = document.querySelector('[data-component="FlowStatusRow"]');
    expect(row).toHaveAttribute("data-tone", "error");
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("holds every button while the create works", () => {
    createJar.isPending = true;
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByText("Creating the cookie jar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("holds Create while the jar is incomplete", () => {
    renderWithProviders(<CampaignCookieJarCreateWorkspace onClose={vi.fn()} initialStep={3} />);

    expect(screen.getByText("Creates this cookie jar on-chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Cookie Jar" })).toBeDisabled();
  });
});
