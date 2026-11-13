import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type {
  RoleRemovalApi,
  RoleRemovalOutcome,
} from "@green-goods/shared/hooks/garden/useGardenOperations";
import esMessages from "@green-goods/shared/i18n/es.json";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  withAdminIdentity,
  withDataRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../shared/.storybook/fixtures";
import { ManageMembersDialog } from "./ManageMembersDialog";
import {
  ANA,
  manageRolesIdentity,
  manageRolesRoster,
  RIOLAB,
  TOMI,
} from "./manageRolesStoryFixtures";

const roleMembers = manageRolesRoster;

const emptyRoleMembers: Record<GardenRole, Address[]> = {
  owner: [],
  steward: [],
  evaluator: [],
  gardener: [],
  funder: [],
  community: [],
};

const identity = manageRolesIdentity(FIXTURE_IMAGE_PROFILE);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A simulated chain: each check answers `held`, and each removal waits `delayMs` before it
 * settles as `settle` says. Nothing here signs or sends.
 */
function simulatedRemoval({
  held = () => true,
  settle = () => ({ status: "removed" }),
  delayMs = 0,
  hangAfterFirst = false,
}: {
  held?: (address: Address, role: GardenRole) => boolean | null;
  settle?: (address: Address, role: GardenRole, index: number) => RoleRemovalOutcome;
  delayMs?: number;
  /** Leaves the first signature open, to hold the dialog in its sending state. */
  hangAfterFirst?: boolean;
} = {}): RoleRemovalApi {
  return {
    account: ANA,
    check: fn(async (rows: Parameters<RoleRemovalApi["check"]>[0]) => {
      await wait(delayMs);
      return rows.map((row) => held(row.address, row.role));
    }),
    remove: fn(
      async (
        rows: Parameters<RoleRemovalApi["remove"]>[0],
        events?: Parameters<RoleRemovalApi["remove"]>[1]
      ) => {
        const outcomes: RoleRemovalOutcome[] = [];
        let stopped = false;
        for (const [index, row] of rows.entries()) {
          if (stopped) {
            const outcome: RoleRemovalOutcome = { status: "notSent" };
            events?.onSettled?.(row, outcome);
            outcomes.push(outcome);
            continue;
          }
          events?.onSending?.(row);
          if (hangAfterFirst) await new Promise(() => {});
          await wait(delayMs);
          const outcome = settle(row.address, row.role, index);
          if (["declined", "failed", "unknown"].includes(outcome.status)) stopped = true;
          events?.onSettled?.(row, outcome);
          outcomes.push(outcome);
        }
        return outcomes;
      }
    ),
  };
}

const body = () => within(document.body);

/** Waits out the dialog's entrance, so a visibility check reads the dialog a steward sees. */
async function dialogSettled() {
  const dialog = await body().findByRole("dialog");
  await Promise.all(
    dialog
      .getAnimations({ subtree: true })
      .map((animation) => animation.finished.catch(() => undefined))
  );
}

async function pick(role: string, name: string) {
  await userEvent.click(
    await body().findByRole("checkbox", { name: `Remove ${role} from ${name}` })
  );
}

/** Filters by a role, by its chip on a wide dialog or by the select it folds into below 480px (DL-141). */
async function filterBy(label: string) {
  const chip = body().queryByRole("button", { name: label });
  if (chip && chip.offsetParent !== null) await userEvent.click(chip);
  else
    await userEvent.selectOptions(
      body().getByRole("combobox", { name: "Filter members by role" }),
      label
    );
}

/** Picks Evaluator from two evaluators and from a steward, then opens Review. */
async function pickEvaluatorsAndReview() {
  await pick("Evaluator", "chidinma");
  await pick("Evaluator", "tomi.eth");
  await pick("Evaluator", "kwame-mensah.eth");
  await userEvent.click(body().getByRole("button", { name: "Review Removal" }));
}

const meta: Meta<typeof ManageMembersDialog> = {
  title: "Admin/Workflows/Garden/ManageMembersDialog",
  component: ManageMembersDialog,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    // The avatars read the signed-in account's own photo, so the stories carry an identity.
    withAdminIdentity,
    // The selection guard blocks Back through `useBlocker`, which only a data router provides.
    withDataRouter("/community/members"),
    withSeededQueryClient(identity),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Manage Roles: one row per person with a check chip for each role they hold (DL-049). Picks survive search and filters, the footer counts them in roles and people and says how many are out of view, and roles the viewer cannot remove are locked with the reason on the row. Review opens in the same shell, names the garden, reads every pair on chain again, and says what each person loses and keeps; its confirm is the only destructive button. Each pair takes one signature, and the result says what landed before offering anything again. Every write here is simulated.",
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    roleMembers,
    canManage: true,
    viewerIsOwner: false,
    viewerAddress: ANA,
    gardenName: "Rio Rainforest Lab",
    chainId: DEFAULT_CHAIN_ID,
    isLoading: false,
    removal: simulatedRemoval(),
    onAddMembers: fn(),
    onAddRole: fn(),
    gardenAddress: "0x7777777777777777777777777777777777777777",
    tone: "community",
  },
};

export default meta;
type Story = StoryObj<typeof ManageMembersDialog>;

/** A steward's view: an owner's roles, another steward's Steward role and their own are locked, each with its reason. */
export const StewardChoosing: Story = {
  play: async () => {
    await dialogSettled();
    await expect(
      await body().findByText("Only an owner can change an owner's roles.")
    ).toBeVisible();
    await expect(
      body().getByText("Only an owner can remove a steward's Steward role.")
    ).toBeVisible();
    await expect(body().getByText("You can't remove your own Steward role here.")).toBeVisible();
    await expect(body().getByRole("button", { name: "Review Removal" })).toBeDisabled();
  },
};

/** An owner's view: every other person's roles are open; their own Owner and Steward roles are not. */
export const OwnerChoosing: Story = {
  args: { viewerIsOwner: true, viewerAddress: RIOLAB },
  play: async () => {
    await dialogSettled();
    await expect(
      await body().findByRole("checkbox", { name: "Remove Steward from kwame-mensah.eth" })
    ).toBeInTheDocument();
    await expect(
      body().getByText("You can't remove your own Owner and Steward roles here.")
    ).toBeVisible();
  },
};

/** Three picks, then a filter that hides one: the footer still counts all three and says one is out of view. */
export const FilteredSelection: Story = {
  play: async () => {
    await pick("Evaluator", "chidinma");
    await pick("Evaluator", "tomi.eth");
    await pick("Community member", "0x66...666");
    await filterBy("Evaluators");
    await expect(await body().findByText("1 role not shown")).toBeVisible();
    await expect(body().getByText("3 roles from 3 people")).toBeVisible();
  },
};

/** Review: the garden under the title, one role already gone and left out, and what each person keeps. */
export const Review: Story = {
  args: { removal: simulatedRemoval({ held: (address) => address !== TOMI }) },
  play: async () => {
    await pickEvaluatorsAndReview();
    const dialog = await body().findByRole("dialog", { name: "Review Removal" });
    await expect(await within(dialog).findByText("Removes 2 roles from 2 people")).toBeVisible();
    await expect(within(dialog).getByText("Already removed")).toBeVisible();
    await expect(within(dialog).getByText("2 signatures")).toBeVisible();
    await expect(within(dialog).getByRole("button", { name: "Remove 2 Roles" })).toBeEnabled();
  },
};

/** The first signature is out: the dialog holds still, says which one, and cannot be closed. */
export const Sending: Story = {
  args: { removal: simulatedRemoval({ hangAfterFirst: true }) },
  play: async () => {
    await pickEvaluatorsAndReview();
    await userEvent.click(await body().findByRole("button", { name: "Remove 3 Roles" }));
    await expect(await body().findByText("Confirm in your wallet (1 of 3)")).toBeVisible();
    await expect(body().queryByRole("button", { name: "Back" })).toBeNull();
  },
};

/** Every pick landed: the done state stays until Done. */
export const Removed: Story = {
  play: async () => {
    await pickEvaluatorsAndReview();
    await userEvent.click(await body().findByRole("button", { name: "Remove 3 Roles" }));
    await expect(await body().findByText("3 roles removed")).toBeVisible();
    await expect(body().getByRole("button", { name: "Done" })).toBeVisible();
  },
};

/** The first signature was declined: nothing landed, the picks stay, and the same button tries again. */
export const Declined: Story = {
  args: { removal: simulatedRemoval({ settle: () => ({ status: "declined" }) }) },
  play: async () => {
    await pickEvaluatorsAndReview();
    await userEvent.click(await body().findByRole("button", { name: "Remove 3 Roles" }));
    await expect(await body().findByText("Nothing was removed")).toBeVisible();
    await expect(body().getByRole("button", { name: "Remove 3 Roles" })).toBeEnabled();
  },
};

/** One landed, then one failed and the run stopped: what landed is named before the retry. */
export const PartlyRemoved: Story = {
  args: {
    removal: simulatedRemoval({
      settle: (_address, _role, index) =>
        index === 0
          ? { status: "removed" }
          : { status: "failed", reason: "The transaction ran out of gas." },
    }),
  },
  play: async () => {
    await pickEvaluatorsAndReview();
    await userEvent.click(await body().findByRole("button", { name: "Remove 3 Roles" }));
    await expect(await body().findByText("1 removed · 2 not removed")).toBeVisible();
    await expect(body().getByRole("button", { name: "Remove 2 Remaining Roles" })).toBeVisible();
  },
};

/** The chain could not say whether a removal landed: nothing is offered again until Check Again reads it. */
export const NotConfirmed: Story = {
  args: { removal: simulatedRemoval({ settle: () => ({ status: "unknown" }) }) },
  play: async () => {
    await pickEvaluatorsAndReview();
    await userEvent.click(await body().findByRole("button", { name: "Remove 3 Roles" }));
    await expect(await body().findByText("We couldn't confirm a removal")).toBeVisible();
    await expect(body().getByRole("button", { name: "Check Again" })).toBeVisible();
    await waitFor(() => expect(body().queryByRole("button", { name: /^Remove \d/ })).toBeNull());
  },
};

/**
 * For a hand walk with the keyboard: simulated writes that take a moment each, so every state
 * shows. Tab to a chip, Space to pick, Tab to Review Removal, Enter; the review takes focus.
 */
export const Walkthrough: Story = {
  args: { removal: simulatedRemoval({ delayMs: 900 }) },
};

/** Opened from one person's row: just them, until Show Everyone. */
export const OpenedForOnePerson: Story = {
  args: { initialMember: TOMI },
};

/** Someone who cannot change roles reads them without checkboxes. */
export const ReadOnly: Story = {
  args: { canManage: false },
};

export const Empty: Story = {
  args: { roleMembers: emptyRoleMembers },
};

function inLocale(locale: string, messages: Record<string, string>): Decorator {
  return (Story) => (
    <IntlProvider locale={locale} messages={messages}>
      <Story />
    </IntlProvider>
  );
}

/** Spanish role names are the longest ("Miembro de la comunidad"): chips wrap, nothing is cut. */
export const StewardChoosingSpanish: Story = {
  decorators: [inLocale("es", esMessages)],
};

/** Garden-specific dates are read once for the roster, independently of removal selection. */
export const MembershipDates: Story = {
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.gardens.memberHistory(
          "0x7777777777777777777777777777777777777777",
          undefined,
          DEFAULT_CHAIN_ID
        ),
        [
          {
            garden: "0x7777777777777777777777777777777777777777",
            account: TOMI,
            joinedAt: Date.UTC(2026, 5, 12, 12),
            memberSince: Date.UTC(2026, 5, 12, 12),
            roleSince: {
              gardener: Date.UTC(2026, 5, 12, 12),
              evaluator: Date.UTC(2026, 5, 12, 12),
            },
          },
        ],
      ],
    ]),
  ],
  play: async () => {
    await waitFor(() =>
      expect(within(document.body).getByText("Joined this garden")).toBeVisible()
    );
  },
};
