import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  buildCommunityViewActions,
  resolveCommunityMode,
} from "@green-goods/shared/hooks/admin-ui/community/community.utils";
import type { Address } from "@green-goods/shared/types/domain";
import { getCampaignCookieJarPayoutAsset } from "@green-goods/shared/utils/cookie-jar-campaign";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/__tests__/test-utils";
import { AdminViewActions } from "@/components/AdminViewActions";
import { CommunitySheetDescriptor } from "./CommunitySheetDescriptor";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const JAR = "0x2222222222222222222222222222222222222222" as Address;
const ASSET = "0x3333333333333333333333333333333333333333" as Address;

const jars = vi.hoisted(() => ({ current: [] as unknown[] }));
// One object, as TanStack Query keeps `reset` stable: the dialog's open effect depends on it.
const deposit = vi.hoisted(() => ({
  error: null,
  isPending: false,
  mutate: () => {},
  reset: () => {},
}));

// The chain and the wallet are this suite's edges; the action, the URL and the dialog are real.
vi.mock("@green-goods/shared/hooks/cookie-jar/useGardenCookieJars", () => ({
  useGardenCookieJars: () => ({ jars: jars.current, moduleConfigured: true }),
}));
vi.mock("@green-goods/shared/hooks/cookie-jar/useCookieJarDeposit", () => ({
  useCookieJarDeposit: () => deposit,
}));
vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x9999999999999999999999999999999999999999" }),
}));
vi.mock("wagmi", () => ({ useBalance: () => ({ data: undefined }) }));

// The governance sheets and the vault dialog have their own suites.
vi.mock("@/components/Layout", () => ({ useRouteBackedLeftSheetConfig: vi.fn() }));
vi.mock("@/views/Garden/SignalPool", () => ({ default: () => null }));
vi.mock("@/views/Garden/Strategies", () => ({ default: () => null }));
vi.mock("./VaultActionRouteDialog", () => ({ VaultActionRouteDialog: () => null }));

function CommunityRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const actions = buildCommunityViewActions(
    resolveCommunityMode(location.pathname),
    true,
    true,
    true,
    navigate,
    { gardenAddress: GARDEN }
  );
  return (
    <>
      <AdminViewActions items={actions} />
      <CommunitySheetDescriptor
        isStrategiesRoute={false}
        isSignalPoolRoute={false}
        vaultAction={null}
        poolType={undefined}
        selectedItem={new URLSearchParams(location.search).get("item")}
        gardenAddress={GARDEN}
      />
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
    </>
  );
}

function renderAt(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <CommunityRoute />
    </MemoryRouter>
  );
}

const fundButton = () => screen.getByRole("button", { name: "Fund Cookie Jar" });
const fundDialog = () => screen.queryByRole("dialog", { name: "Fund Cookie Jar" });
const currentUrl = () => screen.getByTestId("location").textContent;

describe("CommunitySheetDescriptor: Fund Cookie Jar (DL-140)", () => {
  beforeEach(() => {
    jars.current = [
      {
        jarAddress: JAR,
        assetAddress: ASSET,
        balance: 5_000_000n,
        decimals: 6,
        maxWithdrawal: 1_000_000n,
        withdrawalInterval: 3600n,
      },
    ];
  });

  it.each([
    "members",
    "coordination",
    "endowment",
    "payouts",
  ] as const)("opens over %s with the jar selected, and returns there on close", async (tab) => {
    const user = userEvent.setup();
    const tabUrl = `/community/${tab}?gardenId=${GARDEN}`;
    renderAt(tabUrl);
    expect(fundDialog()).not.toBeInTheDocument();

    const opener = fundButton();
    await user.click(opener);

    expect(fundDialog()).toBeInTheDocument();
    expect(currentUrl()).toBe(`${tabUrl}&item=fund-jar`);
    expect(screen.getByText("Jar Balance")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(fundDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(tabUrl);
    await waitFor(() => expect(opener).toHaveFocus());

    // The handled item is gone, so the next press opens it again.
    await user.click(fundButton());
    expect(fundDialog()).toBeInTheDocument();
  });

  it("reopens on the same tab when the page reloads with the item in the URL", () => {
    const url = `/community/endowment?gardenId=${GARDEN}&item=fund-jar`;
    renderAt(url);

    expect(fundDialog()).toBeInTheDocument();
    expect(currentUrl()).toBe(url);
  });

  it("stays closed for another route item", () => {
    renderAt(`/community/members?gardenId=${GARDEN}&item=add-member`);

    expect(fundDialog()).not.toBeInTheDocument();
  });

  it("takes Fix Limit First to the jar's limit editor on Payouts", async () => {
    const user = userEvent.setup();
    // The live shape the warning exists for: a DAI jar that pays one cent per claim.
    jars.current = [
      {
        jarAddress: JAR,
        assetAddress: getCampaignCookieJarPayoutAsset(DEFAULT_CHAIN_ID, "dai")?.address,
        balance: 0n,
        decimals: 18,
        maxWithdrawal: 10n ** 16n,
        withdrawalInterval: 86_400n,
      },
    ];
    renderAt(`/community/endowment?gardenId=${GARDEN}&item=fund-jar`);

    await user.click(screen.getByRole("button", { name: "Fix Limit First" }));

    await waitFor(() => expect(fundDialog()).not.toBeInTheDocument());
    expect(currentUrl()).toBe(`/community/payouts?gardenId=${GARDEN}&item=jar-limit-${JAR}`);
  });
});
