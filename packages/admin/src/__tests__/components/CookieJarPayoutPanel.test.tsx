import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { CookieJar } from "@green-goods/shared/types/cookie-jar";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderWithProviders, screen, within } from "../test-utils";

// The default chain's DAI, so the claim-limit rule recognises the asset.
const DAI = getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address as Address;
const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x9E1b00000000000000000000000000000000C7f0" as Address;

const plainJar: CookieJar = {
  jarAddress: "0xjar",
  gardenAddress: "0xgarden",
  assetAddress: "0xasset",
  balance: 5000000n,
  currency: "0xasset",
  decimals: 6,
  maxWithdrawal: 1000000n,
  withdrawalInterval: 3600n,
  minDeposit: 0n,
  isPaused: false,
  emergencyWithdrawalEnabled: false,
};

// The live Arbitrum shape: 9.98 DAI in a jar that pays one cent per claim, once a day.
const oneCentDaiJar: CookieJar = {
  ...plainJar,
  jarAddress: "0x7A3d0000000000000000000000000000000041C2",
  assetAddress: DAI,
  currency: DAI,
  decimals: 18,
  balance: 998n * 10n ** 16n,
  maxWithdrawal: 10n ** 16n,
  withdrawalInterval: 86_400n,
};

/** A finished read that found jars; each test overrides what it needs. */
const FINISHED_READ = {
  isLoading: false,
  isPaused: false,
  error: null as Error | null,
  hasNoJar: false,
};

const mocks = vi.hoisted(() => ({
  jars: [] as unknown[],
  read: {} as Record<string, unknown>,
  useGardenCookieJars: vi.fn(),
  signer: { canSign: true, isResolved: true, owner: undefined as Address | undefined },
  updateLimit: vi.fn(),
  depositModalProps: null as null | { onFixLimit?: (jar: Address) => void },
}));

vi.mock(
  import("@green-goods/shared/hooks/cookie-jar/useGardenCookieJars"),
  async (importOriginal) => ({
    ...(await importOriginal()),
    useGardenCookieJars: ((...args: unknown[]) => {
      mocks.useGardenCookieJars(...args);
      return { jars: mocks.jars, moduleConfigured: true, ...mocks.read };
    }) as never,
  })
);

vi.mock("@green-goods/shared/hooks/garden/useGardenAccountSigner", () => ({
  useGardenAccountSigner: () => mocks.signer,
}));

vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarAdmin", () => ({
  useCookieJarUpdateMaxWithdrawal: () => ({ mutate: mocks.updateLimit, isPending: false }),
  useCookieJarUpdateInterval: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock modal components to avoid deep hook dependencies (AuthProvider, wagmi, etc.)
vi.mock("@/views/Hub/components/CookieJarWithdrawModal", () => ({
  CookieJarWithdrawModal: () => null,
}));
vi.mock("@/views/Hub/components/CookieJarDepositModal", () => ({
  CookieJarDepositModal: (props: { onFixLimit?: (jar: Address) => void }) => {
    mocks.depositModalProps = props;
    return null;
  },
}));

import { CookieJarPayoutPanel } from "@/views/Hub/components/CookieJarPayoutPanel";

function panel(props: { routeEditLimitJar?: Address } = {}) {
  return <CookieJarPayoutPanel gardenAddress={GARDEN} gardenName="Riverbend Garden" {...props} />;
}

function renderPanel(props: { routeEditLimitJar?: Address } = {}) {
  return renderWithProviders(panel(props));
}

describe("CookieJarPayoutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jars = [plainJar];
    mocks.read = { ...FINISHED_READ };
    mocks.signer = { canSign: true, isResolved: true, owner: undefined };
  });

  it("renders each jar as an operational payout card", () => {
    renderPanel();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Jar Balance")).toBeInTheDocument();
    expect(screen.getByText("Withdrawal cooldown")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getAllByText(/0xasset/).length).toBeGreaterThan(0);

    // Focused payout actions live on the jar card.
    expect(screen.getByRole("button", { name: /Deposit/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage Jars/ })).not.toBeInTheDocument();
  });

  // Jars are funded from the PWA and other wallets; no mutation in this app can announce that.
  it("says the garden has no jars once its jar list was read empty", () => {
    mocks.jars = [];
    mocks.read = { ...FINISHED_READ, hasNoJar: true };
    renderPanel();

    expect(screen.getByText("No cookie jars found for this garden")).toBeInTheDocument();
  });

  it.each([
    ["is paused offline", { isPaused: true }, "Cookie jars need a connection"],
    ["failed", { error: new Error("RPC timeout") }, "Couldn't read this garden's cookie jars"],
    [
      "failed for every jar",
      { hasDetailReadFailure: true },
      "Couldn't read this garden's cookie jars",
    ],
  ])("does not claim the garden has no jars when its jar read %s", (_state, read, title) => {
    mocks.jars = [];
    mocks.read = { ...FINISHED_READ, ...read };
    renderPanel();

    expect(screen.queryByText("No cookie jars found for this garden")).not.toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("stays loading while a jar read is pending but not yet fetching", () => {
    // TanStack Query reports isLoading false until the fetch starts.
    mocks.jars = [];
    renderPanel();

    expect(screen.queryByText("No cookie jars found for this garden")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking which cookie jars you can access"
    );
  });

  it("keeps re-reading the jars while it is open", () => {
    renderPanel();

    expect(mocks.useGardenCookieJars).toHaveBeenCalledWith(
      GARDEN,
      expect.objectContaining({ refetchInterval: 15_000 })
    );
  });

  it("shows the limit itself, not the limit clamped by what the jar holds", () => {
    mocks.jars = [{ ...oneCentDaiJar, balance: 10n ** 15n, maxWithdrawal: 10n * 10n ** 18n }];
    renderPanel();

    expect(screen.getByText("Per-claim limit")).toBeInTheDocument();
    expect(screen.getByText("10 DAI")).toBeInTheDocument();
    expect(screen.queryByText("Available now")).not.toBeInTheDocument();
    expect(screen.queryByText("Limit too low")).not.toBeInTheDocument();
  });

  it("lets a steward who can sign raise a one-cent limit to the suggested 10 DAI", async () => {
    const user = userEvent.setup();
    mocks.jars = [oneCentDaiJar];
    renderPanel();

    expect(screen.getByText("Limit too low")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Per-Claim Limit" }));

    expect(screen.getByRole("textbox", { name: "Per-claim limit" })).toHaveValue("10");
    await user.click(screen.getByRole("button", { name: "Update Limit" }));

    // Names the reach before the act, including that one claim could now empty the jar.
    const dialog = await screen.findByRole("dialog", { name: "Update Per-Claim Limit" });
    expect(dialog).toHaveTextContent("Gardeners in Riverbend Garden");
    expect(dialog).toHaveTextContent("0.01 → 10 DAI");
    expect(dialog).toHaveTextContent("9.98 DAI · one claim could empty it");
    expect(dialog).toHaveTextContent("Garden account");

    await user.click(within(dialog).getByRole("button", { name: "Update Limit" }));
    expect(mocks.updateLimit).toHaveBeenCalledWith(
      { jarAddress: oneCentDaiJar.jarAddress, maxWithdrawal: 10n * 10n ** 18n },
      expect.anything()
    );
  });

  it("keeps Edit visible but disabled for a steward who cannot sign, and names the owner", () => {
    mocks.jars = [oneCentDaiJar];
    mocks.signer = { canSign: false, isResolved: true, owner: OWNER };
    renderPanel();

    expect(screen.getByRole("button", { name: "Edit Per-Claim Limit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Withdrawal Cooldown" })).toBeDisabled();
    const note = screen
      .getByText("Only the garden owner's wallet can change this jar.")
      .closest("p");
    expect(note).toHaveTextContent(/Owner 0x9E/i);
    // The disabled control points at the reason.
    expect(screen.getByRole("button", { name: "Edit Per-Claim Limit" })).toHaveAttribute(
      "aria-describedby",
      note?.id
    );
  });

  it("opens the limit editor when the low-limit alert or the deposit warning sends the steward here", async () => {
    mocks.jars = [plainJar, oneCentDaiJar];
    renderPanel({ routeEditLimitJar: oneCentDaiJar.jarAddress.toLowerCase() as Address });

    expect(screen.getByRole("textbox", { name: "Per-claim limit" })).toHaveValue("10");

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Per-claim limit" })).not.toBeInTheDocument();

    // "Fix Limit First" in the deposit dialog lands on the same editor.
    act(() => mocks.depositModalProps?.onFixLimit?.(oneCentDaiJar.jarAddress));
    expect(screen.getByRole("textbox", { name: "Per-claim limit" })).toBeInTheDocument();
  });

  it("reopens the limit editor when the alert sends the steward back to the same jar", async () => {
    mocks.jars = [plainJar, oneCentDaiJar];
    const jar = oneCentDaiJar.jarAddress.toLowerCase() as Address;
    const { rerender } = renderPanel({ routeEditLimitJar: jar });

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));
    // The route moves on while the panel stays mounted, then the alert links back here.
    rerender(panel());
    rerender(panel({ routeEditLimitJar: jar }));

    expect(screen.getByRole("textbox", { name: "Per-claim limit" })).toHaveValue("10");
  });
});
