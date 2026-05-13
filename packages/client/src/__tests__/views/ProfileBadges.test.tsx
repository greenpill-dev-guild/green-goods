import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../shared/src/i18n/en.json";

const GREENWILL_BADGE_IDS = {
  GENESIS: "0x019f6193080fa2ce1eb4082321d3fc1563ca3ee6f96dc5b2092d4bd08cc1b2cb",
  FIRST_WORK: "0xcf9804d3da2c8f716a32449c2b67e5dfa650d9335bc0be6c8a48b9a99ad1efde",
  FIRST_SUPPORT: "0x6fc67c6755ce3ed4ebb1672f2ee106e26f5ba6e37f0f76c2b2541991212dcdc4",
} as const;
const TEST_GARDEN = "0x00000000000000000000000000000000000000a1";
const TEST_ASSET = "0x00000000000000000000000000000000000000b2";

const sharedMocks = vi.hoisted(() => ({
  usePrimaryAddress: vi.fn(() => "0x1234567890abcdef1234567890abcdef12345678"),
  useGreenGoodsEnsName: vi.fn(() => ({ data: "river.greengoods.eth" })),
  useEnsName: vi.fn(() => ({ data: "river.eth" })),
  useGreenWillBadges: vi.fn(),
  useClaimGenesisBadge: vi.fn(),
  useClaimFirstSupportBadge: vi.fn(),
  useClaimFirstWorkBadge: vi.fn(),
  useMyVaultDeposits: vi.fn(),
  useMyOnlineWorks: vi.fn(),
  useProtocolMemberStatus: vi.fn(),
  formatAddress: vi.fn(
    (address: string, opts?: { ensName?: string }) =>
      opts?.ensName?.replace(".greengoods.eth", "") ||
      `${address.slice(0, 6)}...${address.slice(-4)}`
  ),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  DialogShell: ({ open, onOpenChange, title, description, children }: any) =>
    open
      ? createElement(
          "div",
          { role: "dialog", "aria-label": title },
          createElement("h2", null, title),
          description ? createElement("p", null, description) : null,
          children,
          createElement(
            "button",
            { type: "button", onClick: () => onOpenChange(false), "aria-label": "Close" },
            "Close"
          )
        )
      : null,
  formatAddress: sharedMocks.formatAddress,
  // Default to "deployed" so existing empty-state tests aren't reroutes to the
  // wrong-chain branch. Tests that want to assert wrong-chain UI override per case.
  isGreenWillDeployed: () => true,
  usePrimaryAddress: sharedMocks.usePrimaryAddress,
  useGreenGoodsEnsName: sharedMocks.useGreenGoodsEnsName,
  useEnsName: sharedMocks.useEnsName,
  useGreenWillBadges: sharedMocks.useGreenWillBadges,
  useClaimGenesisBadge: sharedMocks.useClaimGenesisBadge,
  useClaimFirstSupportBadge: sharedMocks.useClaimFirstSupportBadge,
  useClaimFirstWorkBadge: sharedMocks.useClaimFirstWorkBadge,
  useMyVaultDeposits: sharedMocks.useMyVaultDeposits,
  useMyOnlineWorks: sharedMocks.useMyOnlineWorks,
  useProtocolMemberStatus: sharedMocks.useProtocolMemberStatus,
}));

vi.mock("@remixicon/react", () => ({
  RiAwardLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-award" }),
  RiCoinsLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-coins" }),
  RiHammerLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-hammer" }),
  RiSeedlingLine: (props: any) =>
    createElement("span", { ...props, "data-testid": "icon-seedling" }),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children, ...props }: any) => createElement("div", props, children),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick, ...props }: any) =>
    createElement("button", { ...props, onClick, type: "button" }, label),
}));

import { ProfileBadges } from "../../views/Profile/Badges";

const wrap = (el: React.ReactElement) =>
  createElement(MemoryRouter, null, createElement(IntlProvider, { locale: "en", messages }, el));

describe("ProfileBadges", () => {
  const mockGenesisClaim = vi.fn();
  const mockFirstSupportClaim = vi.fn();
  const mockFirstWorkClaim = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    sharedMocks.useGreenWillBadges.mockReturnValue({
      badges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: true,
          claimableNow: false,
          ownership: {
            id: "own-genesis",
            chainId: 42161,
            badgeId: GREENWILL_BADGE_IDS.GENESIS,
            owner: "0x1234567890abcdef1234567890abcdef12345678",
            sourceRef: "0x1111111111111111111111111111111111111111111111111111111111111111",
            issuer: "0x0000000000000000000000000000000000000004",
            unlockTokenId: 1n,
            issuedAt: 1710000000,
            definitionId: "def-genesis",
            lastGrantId: "grant-genesis",
          },
        },
        {
          id: "def-first-work",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_WORK,
          slug: "first-work",
          metadataURI: "ipfs://first-work",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 2,
          grantCount: 2,
          updatedAt: 1710001000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: false,
          active: true,
          holderCount: 1,
          grantCount: 1,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: false,
          ownership: null,
        },
      ],
      earnedBadges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: true,
          claimableNow: false,
          ownership: {
            id: "own-genesis",
            chainId: 42161,
            badgeId: GREENWILL_BADGE_IDS.GENESIS,
            owner: "0x1234567890abcdef1234567890abcdef12345678",
            sourceRef: "0x1111111111111111111111111111111111111111111111111111111111111111",
            issuer: "0x0000000000000000000000000000000000000004",
            unlockTokenId: 1n,
            issuedAt: 1710000000,
            definitionId: "def-genesis",
            lastGrantId: "grant-genesis",
          },
        },
      ],
      claimableBadges: [
        {
          id: "def-first-work",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_WORK,
          slug: "first-work",
          metadataURI: "ipfs://first-work",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 2,
          grantCount: 2,
          updatedAt: 1710001000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: false,
          active: true,
          holderCount: 1,
          grantCount: 1,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: false,
          ownership: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    sharedMocks.useClaimGenesisBadge.mockReturnValue({
      mutate: mockGenesisClaim,
      isPending: false,
    });
    sharedMocks.useClaimFirstSupportBadge.mockReturnValue({
      mutate: mockFirstSupportClaim,
      isPending: false,
    });
    sharedMocks.useClaimFirstWorkBadge.mockReturnValue({
      mutate: mockFirstWorkClaim,
      isPending: false,
    });
    sharedMocks.useMyVaultDeposits.mockReturnValue({
      deposits: [{ garden: TEST_GARDEN, asset: TEST_ASSET, shares: 1n }],
      isLoading: false,
    });
    sharedMocks.useMyOnlineWorks.mockReturnValue({
      data: [{ id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
      isLoading: false,
    });
    sharedMocks.useProtocolMemberStatus.mockReturnValue({
      data: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders earned badge data and prefers the protocol ENS identity", () => {
    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByText("Issued to river")).toBeInTheDocument();
    expect(screen.getByText("Genesis")).toBeInTheDocument();
    expect(screen.getByTestId("profile-badge-grid")).toHaveClass("grid-cols-2");
    expect(screen.getByRole("button", { name: "View Genesis badge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View First Work badge" })).toBeInTheDocument();
  });

  it("renders one neutral empty state when no badges are returned", () => {
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [],
      earnedBadges: [],
      claimableBadges: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByText("No badges yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Badges appear here as you document work, support gardens/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Earned badges")).not.toBeInTheDocument();
    expect(screen.queryByText("Claimable badges")).not.toBeInTheDocument();
  });

  it("uses the neutral empty state when badge data errors", () => {
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [],
      earnedBadges: [],
      claimableBadges: [],
      isLoading: false,
      isError: true,
      error: new Error("indexer unavailable"),
    });

    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByText("Badges are not loading right now")).toBeInTheDocument();
    expect(screen.queryByText("Could not load badges.")).not.toBeInTheDocument();
  });

  it("keeps first-support out of the claimable list until the badge is actually claimable", () => {
    render(wrap(createElement(ProfileBadges)));

    expect(screen.queryByRole("button", { name: "Claim First Support" })).not.toBeInTheDocument();
  });

  it("opens and closes badge details from the grid", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(ProfileBadges)));

    await user.click(screen.getByRole("button", { name: "View Genesis badge" }));

    const dialog = screen.getByRole("dialog", { name: "Genesis" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Earned")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Genesis" })).not.toBeInTheDocument();
  });

  it("allows claiming the genesis badge when eligible", async () => {
    const user = userEvent.setup();
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      earnedBadges: [],
      claimableBadges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(wrap(createElement(ProfileBadges)));

    await user.click(screen.getByRole("button", { name: "View Genesis badge" }));
    await user.click(screen.getByRole("button", { name: "Claim Genesis" }));

    expect(mockGenesisClaim).toHaveBeenCalledTimes(1);
  });

  it("keeps globally claimable badges hidden when the user is not locally eligible", () => {
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
        {
          id: "def-first-work",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_WORK,
          slug: "first-work",
          metadataURI: "ipfs://first-work",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 0,
          grantCount: 0,
          updatedAt: 1710001000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 0,
          grantCount: 0,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      earnedBadges: [],
      claimableBadges: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    sharedMocks.useProtocolMemberStatus.mockReturnValueOnce({ data: false, isLoading: false });
    sharedMocks.useMyOnlineWorks.mockReturnValueOnce({ data: [], isLoading: false });
    sharedMocks.useMyVaultDeposits.mockReturnValueOnce({
      deposits: [{ garden: TEST_GARDEN, asset: TEST_ASSET, shares: 0n }],
      isLoading: false,
    });

    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByText("No badges yet")).toBeInTheDocument();
    expect(screen.queryByText("Ready to claim")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Genesis badge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View First Work badge" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View First Support badge" })
    ).not.toBeInTheDocument();
  });

  it("keeps genesis out of the claimable grid when the user is not a protocol member", () => {
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [
        {
          id: "def-genesis",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.GENESIS,
          slug: "genesis",
          metadataURI: "ipfs://genesis",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 4,
          grantCount: 4,
          updatedAt: 1710000000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      earnedBadges: [],
      claimableBadges: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    sharedMocks.useProtocolMemberStatus.mockReturnValueOnce({ data: false, isLoading: false });

    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByText("No badges yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Genesis badge" })).not.toBeInTheDocument();
  });

  it("renders earned badges even when the user lacks claim eligibility signals", () => {
    sharedMocks.useProtocolMemberStatus.mockReturnValueOnce({ data: false, isLoading: false });
    sharedMocks.useMyOnlineWorks.mockReturnValueOnce({ data: [], isLoading: false });
    sharedMocks.useMyVaultDeposits.mockReturnValueOnce({
      deposits: [{ garden: TEST_GARDEN, asset: TEST_ASSET, shares: 0n }],
      isLoading: false,
    });

    render(wrap(createElement(ProfileBadges)));

    expect(screen.getByRole("button", { name: "View Genesis badge" })).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View First Work badge" })).not.toBeInTheDocument();
  });

  it("allows claiming the first work badge with the first work uid", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(ProfileBadges)));

    await user.click(screen.getByRole("button", { name: "View First Work badge" }));
    await user.click(screen.getByRole("button", { name: "Claim First Work" }));

    expect(mockFirstWorkClaim).toHaveBeenCalledWith({
      uid: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("allows claiming the first support badge from an existing vault position", async () => {
    const user = userEvent.setup();
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 1,
          grantCount: 1,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      earnedBadges: [],
      claimableBadges: [
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 1,
          grantCount: 1,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    sharedMocks.useMyVaultDeposits.mockReturnValueOnce({
      deposits: [{ garden: TEST_GARDEN, asset: TEST_ASSET, shares: 1n }],
      isLoading: false,
    });

    render(wrap(createElement(ProfileBadges)));

    await user.click(screen.getByRole("button", { name: "View First Support badge" }));
    await user.click(screen.getByRole("button", { name: "Claim First Support" }));

    expect(mockFirstSupportClaim).toHaveBeenCalledWith({
      gardenAddress: TEST_GARDEN,
      assetAddress: TEST_ASSET,
    });
  });

  it("uses the first positive-share vault position for first support claims", async () => {
    const user = userEvent.setup();
    const positiveGarden = "0x00000000000000000000000000000000000000c3";
    const positiveAsset = "0x00000000000000000000000000000000000000d4";
    sharedMocks.useGreenWillBadges.mockReturnValueOnce({
      badges: [
        {
          id: "def-first-support",
          chainId: 42161,
          badgeId: GREENWILL_BADGE_IDS.FIRST_SUPPORT,
          slug: "first-support",
          metadataURI: "ipfs://first-support",
          validator: "0x0000000000000000000000000000000000000001",
          authorizedIssuer: "0x0000000000000000000000000000000000000002",
          unlockLock: "0x0000000000000000000000000000000000000003",
          claimable: true,
          active: true,
          holderCount: 1,
          grantCount: 1,
          updatedAt: 1710002000,
          owned: false,
          claimableNow: true,
          ownership: null,
        },
      ],
      earnedBadges: [],
      claimableBadges: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    sharedMocks.useMyVaultDeposits.mockReturnValue({
      deposits: [
        { garden: TEST_GARDEN, asset: TEST_ASSET, shares: 0n },
        { garden: positiveGarden, asset: positiveAsset, shares: 2n },
      ],
      isLoading: false,
    });

    render(wrap(createElement(ProfileBadges)));

    await user.click(screen.getByRole("button", { name: "View First Support badge" }));
    await user.click(screen.getByRole("button", { name: "Claim First Support" }));

    expect(mockFirstSupportClaim).toHaveBeenCalledWith({
      gardenAddress: positiveGarden,
      assetAddress: positiveAsset,
    });
  });
});
