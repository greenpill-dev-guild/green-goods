import { useGardenAssessmentRecords } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import {
  useActions,
  useGardeners,
  useGardens,
} from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useConvictionStrategies } from "@green-goods/shared/hooks/conviction/useConvictionStrategies";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import type { GardenVault, VaultDeposit } from "@green-goods/shared/types/vaults";
import type { Meta, StoryObj } from "@storybook/react";
import { useLayoutEffect } from "react";
import { expect, fn, mocked, screen, userEvent, waitFor, within } from "storybook/test";
import {
  JOURNEY_GARDEN_RECORD,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withClientAppRuntime, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  FIXTURE_IMAGE_BANNER,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import {
  type JournalLocale,
  JournalLocales,
  JournalPhone,
} from "../../../../../shared/.storybook/homeJournalFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { AboutGarden } from "./AboutGarden";

/** An account with no role on the garden's record: the evaluator the chain confirms, the depositor. */
const OUTSIDER = "0x5eed0000000000000000000000000000000000d4" as Address;
const OWNER = "0x5eed0000000000000000000000000000000000e5" as Address;

/** Riverside Commons with its banner and an owner, as the About section reads it. */
const GARDEN: Garden = {
  ...JOURNEY_GARDEN_RECORD,
  bannerImage: FIXTURE_IMAGE_BANNER,
  description:
    "Riverside Commons grows food along the river and shares the harvest with its block.",
  owners: [OWNER],
};

const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address;
const VAULT_ADDRESS = "0x5eed0000000000000000000000000000000000f6" as Address;
const WEI = 10n ** 18n;

/** The garden's one vault, so Endowment can show. */
const VAULT: GardenVault = {
  id: `42161-${VAULT_ADDRESS}`,
  chainId: 42161,
  garden: GARDEN.id as Address,
  asset: DAI,
  vaultAddress: VAULT_ADDRESS,
  totalDeposited: 120n * WEI,
  totalWithdrawn: 0n,
  totalHarvestCount: 0,
  donationAddress: null,
  depositorCount: 3,
  paused: false,
  createdAt: STORYBOOK_NOW_SECONDS - 86_400 * 30,
};

/** The depositor's shares in that vault. */
const DEPOSIT: VaultDeposit = {
  id: `42161-${VAULT_ADDRESS}-${OUTSIDER}`,
  chainId: 42161,
  garden: GARDEN.id as Address,
  asset: DAI,
  vaultAddress: VAULT_ADDRESS,
  depositor: OUTSIDER,
  shares: 25n * WEI,
  totalDeposited: 25n * WEI,
  totalWithdrawn: 0n,
};

/** Who is reading Home: each role the access matrix names (eval A5). */
type Role = "gardener" | "steward" | "evaluator" | "owner" | "depositor";

const ACCOUNTS: Record<Role, Address> = {
  gardener: JOURNEY_VIEWER,
  steward: JOURNEY_NEIGHBOUR,
  evaluator: OUTSIDER,
  owner: OWNER,
  depositor: OUTSIDER,
};

/**
 * The reads behind `useGardenAccess` for one role: the account, the garden's one vault, the
 * account's deposits, and the chain's answer on the evaluator role. The roster predicates run
 * for real on the record above. The sheets a row opens read the garden's work, people and
 * actions; those answer empty here, offline.
 */
const withRole = (role: Role) => () => {
  mocked(useUser).mockReturnValue({ primaryAddress: ACCOUNTS[role] } as ReturnType<typeof useUser>);
  mocked(usePrimaryAddress).mockReturnValue(ACCOUNTS[role]);
  mocked(useGardenVaults).mockReturnValue({ vaults: [VAULT] } as unknown as ReturnType<
    typeof useGardenVaults
  >);
  mocked(useVaultDeposits).mockReturnValue({
    deposits: role === "depositor" ? [DEPOSIT] : [],
  } as unknown as ReturnType<typeof useVaultDeposits>);
  mocked(useHasRole).mockReturnValue({ hasRole: role === "evaluator" } as ReturnType<
    typeof useHasRole
  >);
  mocked(useConvictionStrategies).mockReturnValue({ strategies: [] } as unknown as ReturnType<
    typeof useConvictionStrategies
  >);
  mocked(useGardenAssessmentRecords).mockReturnValue({
    records: [],
    status: "success",
  } as unknown as ReturnType<typeof useGardenAssessmentRecords>);
  mocked(useWorks).mockReturnValue({
    works: [],
    isFetching: false,
    isLoading: false,
    isError: false,
    isPaused: false,
    availability: "empty",
    refetch: fn(),
  } as unknown as ReturnType<typeof useWorks>);
  mocked(useGardens).mockReturnValue({
    data: [GARDEN],
    isPending: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: fn(),
  } as unknown as ReturnType<typeof useGardens>);
  mocked(useGardeners).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useGardeners>);
  mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
  return resetHookMocks(
    useUser,
    usePrimaryAddress,
    useGardenVaults,
    useVaultDeposits,
    useHasRole,
    useConvictionStrategies,
    useGardenAssessmentRecords,
    useWorks,
    useGardens,
    useGardeners,
    useActions
  );
};

interface AboutGardenStoryProps {
  role: Role;
  width: 360 | 390;
  locale: JournalLocale;
}

function AboutGardenStory({ width, locale }: AboutGardenStoryProps) {
  // A sheet a story leaves open closes as the story unmounts, so no later story starts with it.
  useLayoutEffect(() => () => useUIStore.getState().closeGardenSheet(), []);
  return (
    <JournalPhone width={width} locale={locale}>
      <AboutGarden garden={GARDEN} />
    </JournalPhone>
  );
}

/**
 * About This Garden (PWA Home step 10, DL-128): the journal's last section, one item row per
 * entry point the garden page kept for members. Insights, Gardeners and Share for everyone;
 * Endowment for a steward, an evaluator or a depositor of a garden with a vault; Governance only
 * while its flag is on. Each row follows the garden page's own predicate, so no role gains an
 * entry here it would not have on the page. Fictional data from the client journeys.
 */
const meta: Meta<typeof AboutGardenStory> = {
  title: "Client/Home/AboutGarden",
  component: AboutGardenStory,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { role: "gardener", width: 390, locale: "en" },
  argTypes: {
    role: { control: "radio", options: ["gardener", "steward", "evaluator", "owner", "depositor"] },
    width: { control: "radio", options: [360, 390] },
    locale: { control: "radio", options: ["en", "es", "pt"] },
  },
  decorators: [withRouter(["/home"]), withClientAppRuntime],
  beforeEach: ({ args }) => withRole(args.role)(),
};

export default meta;
type Story = StoryObj<typeof AboutGardenStory>;

const rowTitles = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(".gg-item-row")].map(
    (row) => row.querySelector(".gg-item-row-title")?.textContent
  );

/** A gardener: Insights, Gardeners and Share, each an 88px row; no Endowment. */
export const Gardener: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 2, name: "About This Garden" })
    ).toBeVisible();
    await expect(rowTitles(canvasElement)).toEqual(["Insights", "Gardeners", "Share Garden"]);
    for (const row of canvasElement.querySelectorAll(".gg-item-row")) {
      await expect(Math.round(row.getBoundingClientRect().height)).toBe(88);
    }
    await expect(canvas.getByText("3 members")).toBeVisible();
  },
};

/** A steward of a garden with a vault: Endowment joins the rows. */
export const Steward: Story = {
  args: { role: "steward" },
  play: async ({ canvasElement }) => {
    await expect(rowTitles(canvasElement)).toEqual([
      "Insights",
      "Gardeners",
      "Share Garden",
      "Endowment",
    ]);
  },
};

/** An evaluator the chain confirms, with no role on the record: the same rows as a steward. */
export const Evaluator: Story = {
  args: { role: "evaluator" },
  play: async ({ canvasElement }) => {
    await expect(rowTitles(canvasElement)).toContain("Endowment");
  },
};

/** An owner answers join requests in Gardeners, but reviews nothing and has no deposit: no Endowment. */
export const Owner: Story = {
  args: { role: "owner" },
  play: async ({ canvasElement }) => {
    await expect(rowTitles(canvasElement)).toEqual(["Insights", "Gardeners", "Share Garden"]);
  },
};

/** A depositor who holds no role: Endowment, naming their deposit. */
export const Depositor: Story = {
  args: { role: "depositor" },
  play: async ({ canvasElement }) => {
    const endowment = within(canvasElement).getByRole("button", { name: /Endowment/ });
    await expect(endowment).toHaveTextContent("Your deposit");
  },
};

/** Insights opens as a tall sheet over Home, named for the garden, with its banner; Close hands focus back to the row. */
export const OpensInsights: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("button", { name: /Insights/ });
    await userEvent.click(row);
    // The sheets load on first use, so the first opening waits for their chunk.
    const sheet = await screen.findByRole("dialog", { name: "Insights" }, { timeout: 10_000 });
    await expect(sheet).toHaveAttribute("data-sheet-size", "tall");
    await expect(sheet).toHaveAccessibleDescription("In Riverside Commons Garden");
    const banner = within(sheet).getByTestId("garden-sheet-banner");
    await expect(Math.round(banner.getBoundingClientRect().height)).toBe(144);
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    // Focus returns once the sheet has let go, in the commit that closes it.
    await waitFor(() => expect(row).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The steward's rows in English, Spanish and Portuguese at 390 and 360px, one detail line each. */
export const Locales: Story = {
  args: { role: "steward" },
  render: () => <JournalLocales render={() => <AboutGarden garden={GARDEN} />} />,
};

/** The depositor's rows, whose Endowment carries a detail, in the six frames. */
export const DepositorLocales: Story = {
  args: { role: "depositor" },
  render: () => <JournalLocales render={() => <AboutGarden garden={GARDEN} />} />,
};
