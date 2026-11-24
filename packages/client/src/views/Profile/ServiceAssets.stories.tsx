import {
  type ServiceIssuerActor,
  type ServiceIssuerDeskRecord,
  type ServiceIssuerRoute,
  useServiceIssuerOperations,
  type VoucherIssuer,
} from "@green-goods/shared/commitment-pooling";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, userEvent, within } from "storybook/test";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { voucherWalletStory } from "../../../../shared/.storybook/voucherPilotFixtures";
import { ServiceAssetsView } from "./ServiceAssetsView";
import { catalogAssets, heldVoucherRows, ownServiceAssets } from "./serviceAssetRows";
import {
  ISSUER_STORY_ADDRESS,
  ISSUER_STORY_NAMES,
  issuerServiceStory,
  issuerStoryAssets,
  issuerStoryDraftRecord,
  issuerStorySnapshot,
} from "./serviceIssuerStoryFixtures";

/** The draft as the desk records it, sent by a steward and not yet answered. */
const draft: ServiceIssuerDeskRecord = {
  ...issuerStoryDraftRecord("review"),
  context: {
    chainId: 100,
    sourceChainId: 42161,
    garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    routeId: "fictional-story",
    poolId: "fictional-local",
  },
  revision: 1,
  createdBy: "0x8888888888888888888888888888888888888888",
  updatedAt: "2026-11-01T00:00:00Z",
};

/** The member's own service reads as its issuer; another member's voucher, as a holder of it. */
function snapshotFor(actor: ServiceIssuerActor | null) {
  if (actor?.assetId !== "analyst-help") return issuerServiceStory("overview");
  const snapshot = issuerStorySnapshot();
  return {
    ...snapshot,
    actor: { ...snapshot.actor, ...actor },
    asset: issuerStoryAssets[1]!,
    holdingBalance: 500_000n,
    pool: { admitted: true, limit: 6_000_000n, holding: 1_000_000n },
  };
}

/** The fictional route: the member's engineer help and another member's analyst coaching. */
const route = {
  service: { id: "fictional-story" },
  assets: issuerStoryAssets,
  pools: [
    {
      id: "fictional-local",
      name: "Fictional local exchange",
      listings: issuerStoryAssets.map((asset) => ({ assetId: asset.id })),
    },
  ],
} as unknown as ServiceIssuerRoute;
const assets = catalogAssets([route]);

/** The analyst coaching voucher as the wallet names it, so its holding opens the exchange. */
const COACHING: VoucherIssuer = {
  account: "0x3333333333333333333333333333333333333333",
  kind: "individual",
  name: "Fictional analyst coaching",
  gender: null,
  asset: {
    chainId: 100,
    token: "0x4444444444444444444444444444444444444444",
    symbol: "AHELP",
    decimals: 6,
  },
  garden: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  standing: { bookings: "open", exchange: "listed" },
};
const wallet = voucherWalletStory("vouchers");
const holdings = heldVoucherRows(
  {
    ...wallet,
    issuers: [...wallet.issuers, COACHING],
    holdings: [...wallet.holdings, { issuer: COACHING, available: 500_000n }],
  },
  assets
);

/**
 * Your Services on the Profile's Account tab (DL-159): the services the member offers and the
 * vouchers they hold, each a row that opens its panel in place. Fictional accounts; the pilot
 * issuers' vouchers as the wallet stories count them. Switch the toolbar's Language for Spanish
 * and Portuguese.
 */
const meta: Meta<typeof ServiceAssetsView> = {
  title: "Client/Profile/ServiceAssets",
  component: ServiceAssetsView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    services: { control: false },
    holdings: { control: false },
    drafts: { control: false },
  },
  beforeEach: () => {
    const refuse = fn(async () => {
      throw new Error("Fictional Storybook operation unavailable");
    });
    mocked(useServiceIssuerOperations).mockImplementation(
      (actor) =>
        ({
          snapshot: {
            data: snapshotFor(actor),
            isLoading: false,
            isError: false,
            refetch: fn().mockResolvedValue(undefined),
          },
          quote: { mutateAsync: refuse },
          quoteContinuation: { mutateAsync: refuse },
          review: { mutateAsync: refuse },
          reviewContinuation: { mutateAsync: refuse },
          execute: { mutateAsync: refuse },
          reconcile: { mutateAsync: refuse },
          lastExchange: { data: null },
        }) as unknown as ReturnType<typeof useServiceIssuerOperations>
    );
    mocked(useGreenGoodsEnsName).mockImplementation(
      (address) =>
        ({
          data: address ? (ISSUER_STORY_NAMES[address.toLowerCase()] ?? null) : null,
        }) as ReturnType<typeof useGreenGoodsEnsName>
    );
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: null,
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    return resetHookMocks(
      useServiceIssuerOperations,
      useGreenGoodsEnsName,
      useEnsName,
      useResolvedProfileAvatar
    );
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg">
        <h5 className="mb-2 text-label-md text-text-strong-950">Your Services</h5>
        <Story />
      </div>
    ),
  ],
  args: {
    member: ISSUER_STORY_ADDRESS,
    identity: "story",
    drafts: {
      records: [draft],
      loaded: true,
      loading: false,
      failed: false,
      canSign: true,
      approving: false,
      onCheck: fn(),
      onApprove: fn(async () => undefined),
      onDecline: fn(),
    },
    services: ownServiceAssets(assets, ISSUER_STORY_ADDRESS),
    holdings,
    wallet: "ready",
    onRefreshWallet: fn(async () => undefined),
    unconfigured: false,
  },
};
export default meta;
type Story = StoryObj<typeof ServiceAssetsView>;

/** A draft to review and a listed service under Services I offer; three holdings under Vouchers I hold. */
export const Current: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Draft to review/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Fictional engineer help/ })).toHaveTextContent(
      "Listed"
    );
    await expect(
      canvas.getByRole("button", { name: /Fictional analyst coaching vouchers/ })
    ).toBeVisible();
    // The pilot issuers' vouchers are held, but no fictional route lists them: records, not doors.
    await expect(canvas.queryByRole("button", { name: /Tech and Sun vouchers/ })).toBeNull();
    await expect(canvas.getByText(/Tech and Sun vouchers/)).toBeVisible();
  },
};

/** The member's own service opened: its bookings, capacity and acts, under its row. */
export const ServiceOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Fictional engineer help/ }));
    await expect(canvas.getByText("Services I Offer")).toBeVisible();
  },
};

/** A held voucher opened: the pool to exchange in, and the holder's own balance and acts. */
export const HoldingOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /Fictional analyst coaching vouchers/ })
    );
    await expect(canvas.getByLabelText("Exchange Pool")).toBeVisible();
  },
};

/** A draft opened: what the member would promise, what stays theirs, and Review and Approve. */
export const DraftOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Draft to review/ }));
    await expect(canvas.getByRole("button", { name: "Review and Approve" })).toBeVisible();
  },
};

/** Nothing offered yet and nothing held: each list says so, and the drafts check stays. */
export const NothingYet: Story = {
  args: {
    drafts: { ...meta.args!.drafts!, records: [] },
    services: [],
    holdings: [],
  },
};

/** The wallet read failed: the holdings say so, with Refresh Balances, and claim no empty account. */
export const WalletFailed: Story = {
  args: { holdings: [], wallet: "failed" },
};

/** This build reads no live route and the desk sent nothing: the block says why. */
export const Unconfigured: Story = {
  args: { unconfigured: true },
};
