/**
 * Your Services on the Profile's Account tab: the member's own drafts and listed services as
 * rows that open their panels, and what their wallet holds as rows that open the exchange for a
 * catalogued voucher. Reads start only for what is the member's own, and the desk only when asked.
 */
import type { VoucherIssuer, VoucherWalletSnapshot } from "@green-goods/shared/commitment-pooling";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, within } from "../test-utils";
import {
  ISSUER_STORY_ADDRESS,
  issuerServiceStory,
  issuerStoryAssets,
  issuerStoryDraftRecord,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { ServiceAssets } from "../../views/Profile/ServiceAssets";

const state = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  profile: "kernel-0.3.3-pilot",
  routes: [] as unknown[],
  walletRoute: false,
  wallet: { data: undefined as unknown, isError: false, refetch: vi.fn() },
  operations: vi.fn(),
  drafts: vi.fn(),
  load: { mutate: vi.fn(), isPending: false, isError: false },
  decline: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false },
  approval: {
    approve: { isPending: false, mutateAsync: vi.fn() },
    canSign: true,
  },
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: state.address,
    authMode: "passkey",
    passkeyAccountProfile: state.profile,
  }),
}));
// A booking row names its holder; this composition test reads no profile, ENS or Green Goods name.
vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: () => ({ avatarUri: null, isLoading: false }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  get SERVICE_ISSUER_ROUTES() {
    return state.routes;
  },
  hasVoucherWalletRoute: () => state.walletRoute,
  useVoucherWallet: () => state.wallet,
  useServiceIssuerOperations: (...args: unknown[]) => state.operations(...args),
  useServiceIssuerDesk: () => {
    const records = state.drafts().data?.records;
    return {
      records: records ?? [],
      loaded: records !== undefined,
      load: state.load,
      approve: state.approval.approve,
      decline: state.decline,
      isLimited: false,
      canSign: state.approval.canSign,
    };
  },
}));

const STORY_ROUTE = {
  service: { id: "fictional-story" },
  assets: issuerStoryAssets,
  pools: [
    {
      id: "fictional-local",
      name: "Test exchange",
      listings: issuerStoryAssets.map((asset) => ({ assetId: asset.id })),
    },
  ],
};
const refetch = vi.fn().mockResolvedValue(undefined);
const reconcile = vi.fn().mockResolvedValue(null);
/** A read with a pool sees the listing; one without, as the real hook answers, sees none. */
const operations = (actor?: { poolId?: string }, state: "overview" | "pending" = "overview") => {
  const snapshot = issuerServiceStory(state);
  return {
    snapshot: {
      data: actor?.poolId ? snapshot : { ...snapshot, pool: null, poolStatus: "unselected" },
      isLoading: false,
      isError: false,
      refetch,
    },
    review: { mutateAsync: vi.fn() },
    execute: { mutateAsync: vi.fn() },
    reconcile: { mutateAsync: reconcile },
    quote: { mutateAsync: vi.fn() },
    lastExchange: { data: null },
  };
};
const issuer = (name: string, token: `0x${string}`): VoucherIssuer => ({
  account: "0x3333333333333333333333333333333333333333",
  kind: "individual",
  name,
  gender: null,
  asset: { chainId: 100, token, symbol: null, decimals: 6 },
  garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  standing: { bookings: "open", exchange: "listed" },
});
/** The analyst coaching voucher of the fictional route, and one of a token no route lists. */
const COACHING = issuer("Fictional analyst coaching", "0x4444444444444444444444444444444444444444");
const STRANGER = issuer("Stranger", "0x9999999999999999999999999999999999999999");
const wallet = (): VoucherWalletSnapshot => ({
  account: ISSUER_STORY_ADDRESS,
  evidence: "onchain",
  complete: true,
  reason: null,
  issuers: [COACHING, STRANGER],
  holdings: [
    { issuer: COACHING, available: 500_000n },
    { issuer: STRANGER, available: 2_000_000n },
  ],
  bookings: [],
  returns: [],
});
const rows = (kind: "draft" | "service" | "holding") => [
  ...document.querySelectorAll<HTMLElement>(`[data-row="${kind}"]`),
];

function reset() {
  state.address = ISSUER_STORY_ADDRESS;
  state.routes = [];
  state.walletRoute = false;
  state.wallet = { data: undefined, isError: false, refetch: vi.fn() };
  state.drafts.mockReturnValue({ data: { status: "unavailable" } });
  state.operations.mockReset();
  state.operations.mockImplementation((actor: { poolId?: string }) => operations(actor));
  state.load.mutate.mockClear();
  state.load.isError = false;
  refetch.mockClear();
  reconcile.mockClear();
}

describe("Your Services", () => {
  it("leaves an empty production catalog unavailable without starting a read", () => {
    reset();
    renderWithProviders(<ServiceAssets />);
    expect(screen.getByText(/No verified service assets are available yet/)).toBeInTheDocument();
    expect(state.operations).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists only the signed-in member's own drafts, each approved by their own signature", async () => {
    reset();
    const own = issuerStoryDraftRecord("review");
    const someoneElse = issuerStoryDraftRecord("review");
    someoneElse.draft = {
      ...someoneElse.draft,
      id: "8",
      member: "0x6666666666666666666666666666666666666666",
    };
    state.drafts.mockReturnValue({ data: { status: "observed", records: [own, someoneElse] } });
    state.approval.approve.mutateAsync.mockResolvedValue(undefined);
    renderWithProviders(<ServiceAssets />);
    expect(state.load.mutate).not.toHaveBeenCalled();
    expect(rows("draft")).toHaveLength(1);
    const row = within(rows("draft")[0]!).getByRole("button", { expanded: false });
    expect(row).toHaveTextContent("Draft to review");
    expect(row).toHaveTextContent(/Drafted with/);
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("checkbox"));
    await userEvent.click(sheet.getByRole("button", { name: "Approve My Service" }));
    expect(state.approval.approve.mutateAsync).toHaveBeenCalledExactlyOnceWith(own);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(state.decline.mutate).toHaveBeenCalledExactlyOnceWith(own);
    expect(state.operations).not.toHaveBeenCalled();
    // This build reads no vouchers: no holdings list, and no claim that the account holds none.
    expect(screen.queryByText("Vouchers you hold")).not.toBeInTheDocument();
    expect(screen.queryByText("No vouchers yet")).not.toBeInTheDocument();
  });

  it("reads the member's own service as a row with its standing, and opens its panel from the active identity", async () => {
    reset();
    state.routes = [STORY_ROUTE];
    const view = renderWithProviders(<ServiceAssets />);
    // Only the asset whose reserve is the member's; the analyst's service is someone else's.
    expect(rows("service")).toHaveLength(1);
    const row = within(rows("service")[0]!).getByRole("button", { expanded: false });
    expect(row).toHaveTextContent("Fictional engineer help");
    // The row reads with the pool that lists the asset: without one, no listing is known.
    expect(row).toHaveTextContent("Listed");
    expect(row).toHaveTextContent("2 booked, 3 left to deliver");
    expect(state.operations).toHaveBeenCalledWith({
      address: ISSUER_STORY_ADDRESS,
      routeId: "fictional-story",
      assetId: "engineer-help",
      poolId: "fictional-local",
    });
    await userEvent.click(row);
    expect(screen.getByText("Services I Offer")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Exchange Pool"), "fictional-local");
    expect(state.operations).toHaveBeenLastCalledWith({
      address: ISSUER_STORY_ADDRESS,
      routeId: "fictional-story",
      assetId: "engineer-help",
      poolId: "fictional-local",
    });
    state.address = "0x6666666666666666666666666666666666666666";
    view.rerender(<ServiceAssets />);
    expect(rows("service")).toHaveLength(0);
  });

  it("lists what the wallet holds, and opens the exchange only for a voucher a live route lists", async () => {
    reset();
    state.routes = [STORY_ROUTE];
    state.walletRoute = true;
    state.wallet = { data: wallet(), isError: false, refetch: vi.fn() };
    renderWithProviders(<ServiceAssets />);
    const [coaching, stranger] = rows("holding");
    expect(coaching).toHaveAttribute("data-listed", "true");
    expect(coaching).toHaveTextContent("Fictional analyst coaching vouchers");
    expect(coaching).toHaveTextContent("0.5");
    expect(coaching).toHaveTextContent("available");
    expect(stranger).toHaveAttribute("data-listed", "false");
    expect(within(stranger!).queryByRole("button")).not.toBeInTheDocument();
    expect(stranger).toHaveTextContent("2");
    // The listed row reads what the pool may spend, with its pool; the unlisted one reads nothing.
    expect(state.operations).toHaveBeenCalledWith({
      address: ISSUER_STORY_ADDRESS,
      routeId: "fictional-story",
      assetId: "analyst-help",
      poolId: "fictional-local",
    });
    expect(state.operations).toHaveBeenCalledWith(null);
    await userEvent.click(within(coaching!).getByRole("button", { expanded: false }));
    expect(screen.getByText("Vouchers I Hold")).toBeInTheDocument();
    expect(state.operations).toHaveBeenCalledWith({
      address: ISSUER_STORY_ADDRESS,
      routeId: "fictional-story",
      assetId: "analyst-help",
    });
  });

  it("keeps an open holding's row and panel through a refresh that empties it, until it is closed", async () => {
    reset();
    state.routes = [STORY_ROUTE];
    state.walletRoute = true;
    state.wallet = { data: wallet(), isError: false, refetch: vi.fn() };
    const view = renderWithProviders(<ServiceAssets />);
    const row = () => within(rows("holding")[0]!).getByRole("button", { expanded: false });
    await userEvent.click(row());
    expect(screen.getByText("Vouchers I Hold")).toBeInTheDocument();
    // The exchange of the whole balance refreshed the wallet: the open row stays with its panel.
    state.wallet = {
      data: { ...wallet(), holdings: [{ issuer: COACHING, available: 0n }] },
      isError: false,
      refetch: vi.fn(),
    };
    view.rerender(<ServiceAssets />);
    expect(rows("holding")).toHaveLength(1);
    expect(screen.getByText("Vouchers I Hold")).toBeInTheDocument();
    expect(rows("holding")[0]).toHaveTextContent("0");
    await userEvent.click(within(rows("holding")[0]!).getByRole("button", { expanded: true }));
    expect(rows("holding")).toHaveLength(0);
    expect(screen.getByText("No vouchers yet")).toBeInTheDocument();
  });

  it("keeps a listed holding reachable at zero balance while the pool may still spend it", () => {
    reset();
    state.routes = [STORY_ROUTE];
    state.walletRoute = true;
    state.wallet = {
      data: { ...wallet(), holdings: [{ issuer: COACHING, available: 0n }] },
      isError: false,
      refetch: vi.fn(),
    };
    // The pool may spend 2 of the coaching vouchers the member spent another way.
    state.operations.mockImplementation((actor: { poolId?: string }) => {
      const read = operations(actor);
      if (actor?.poolId) read.snapshot.data.poolAllowance = 2_000_000n;
      return read;
    });
    const view = renderWithProviders(<ServiceAssets />);
    const [coaching] = rows("holding");
    expect(coaching).toHaveAttribute("data-listed", "true");
    expect(coaching).toHaveTextContent("Fictional analyst coaching vouchers");
    expect(coaching).toHaveTextContent("The pool may spend 2 Fictional analyst coaching vouchers");
    expect(within(coaching!).getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByText("No vouchers yet")).not.toBeInTheDocument();
    // With nothing left for the pool to spend, the empty holding leaves the list, as the wallet's.
    state.operations.mockImplementation((actor: { poolId?: string }) => operations(actor));
    view.rerender(<ServiceAssets />);
    expect(rows("holding")).toHaveLength(0);
    expect(screen.getByText("No vouchers yet")).toBeInTheDocument();
  });

  it("keeps a holding a record when no exchange pool lists its asset", () => {
    reset();
    state.routes = [
      {
        ...STORY_ROUTE,
        pools: [{ ...STORY_ROUTE.pools[0], listings: [{ assetId: "engineer-help" }] }],
      },
    ];
    state.walletRoute = true;
    state.wallet = { data: wallet(), isError: false, refetch: vi.fn() };
    renderWithProviders(<ServiceAssets />);
    const [coaching] = rows("holding");
    expect(coaching).toHaveTextContent("Fictional analyst coaching vouchers");
    expect(coaching).toHaveAttribute("data-listed", "false");
    expect(within(coaching!).queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads the service row again after the panel confirms an act", async () => {
    reset();
    state.routes = [STORY_ROUTE];
    state.operations.mockImplementation((actor: { poolId?: string }) =>
      operations(actor, "pending")
    );
    reconcile.mockResolvedValue({
      status: "confirmed",
      transactionHash: `0x${"ab".repeat(32)}`,
      currentStateMatchesReceipt: true,
    });
    state.walletRoute = true;
    state.wallet = { data: { ...wallet(), holdings: [] }, isError: false, refetch: vi.fn() };
    renderWithProviders(<ServiceAssets />);
    await userEvent.click(within(rows("service")[0]!).getByRole("button", { expanded: false }));
    expect(refetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Check Transaction Status" }));
    expect(reconcile).toHaveBeenCalledOnce();
    expect(state.wallet.refetch).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalled();
  });

  it("says the wallet could not be read, and reads it again on request", async () => {
    reset();
    state.walletRoute = true;
    state.wallet = { data: undefined, isError: true, refetch: vi.fn() };
    renderWithProviders(<ServiceAssets />);
    expect(screen.getByText(/Voucher balances and bookings could not be read/)).toBeInTheDocument();
    expect(screen.queryByText("No vouchers yet")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh Balances" }));
    expect(state.wallet.refetch).toHaveBeenCalledOnce();
  });

  it("checks for drafts only when asked, and says so when the desk could not answer", async () => {
    reset();
    state.walletRoute = true;
    state.wallet = { data: { ...wallet(), holdings: [] }, isError: false, refetch: vi.fn() };
    const view = renderWithProviders(<ServiceAssets />);
    expect(screen.getByText(/A steward drafts a service with you/)).toBeInTheDocument();
    expect(screen.getByText("No vouchers yet")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Check for Drafts From Your Steward" })
    );
    expect(state.load.mutate).toHaveBeenCalledOnce();
    state.drafts.mockReturnValue({ data: { status: "observed", records: [] } });
    state.load.isError = true;
    view.rerender(<ServiceAssets />);
    expect(screen.getByText("No drafts waiting for you.")).toBeInTheDocument();
    expect(screen.getByText(/Service drafts could not be loaded/)).toBeInTheDocument();
  });
});
