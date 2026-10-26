import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { claimRowKey } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, screen, userEvent, within } from "storybook/test";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../../shared/.storybook/adminFixtures";
import { daysAgo } from "../../../../../shared/.storybook/fixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { PoolClaimsCard, type PoolClaimsCardProps } from "./PoolClaimsCard";
import {
  STORY_CLAIMS,
  STORY_JOAO,
  STORY_NOW,
  STORY_TITLES,
  storyCommitment,
  storyPool,
  storyPoolConsole,
} from "./poolStoryFixtures";
import {
  nameVoucherMembers,
  STORY_GREEN_GOODS_CLAIMS,
  STORY_GREEN_GOODS_VOUCHERS,
  STORY_TECH_AND_SUN_CLAIMS,
  STORY_TECH_AND_SUN_VOUCHERS,
  STORY_VOUCHER_TITLES,
  storyVoucherConsole,
} from "./poolStoryVouchers";

const [MARIA, ANA] = STORY_CLAIMS as [PoolClaimRequestRow, PoolClaimRequestRow];

/** João asks to take up an offer: a different promise from the two asks on the ride. */
const JOAO: PoolClaimRequestRow = {
  claim: {
    ...MARIA.claim,
    id: `${DEFAULT_CHAIN_ID}-7-${STORY_JOAO}`,
    commitmentId: 7n,
    claimant: STORY_JOAO,
    requestedBy: STORY_JOAO,
    requestedAt: daysAgo(1) + 3_600,
    updatedAt: daysAgo(1) + 3_600,
  },
  commitment: storyCommitment({
    id: `${DEFAULT_CHAIN_ID}-7`,
    commitmentId: 7n,
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    state: "OFFERED",
    counterparty: null,
    unitLabel: "loan",
    targetUnits: 1n,
    metadataCID: "bafy-7",
    claimMode: "APPROVAL_GATED",
  }),
};

const TITLES = new Map([
  ...STORY_TITLES,
  ["bafy-7", { version: 1, title: "Wheelbarrow loan for the weekend" }],
]);
const CLAIMS = [MARIA, ANA, JOAO];
const keyOf = claimRowKey;
/** Decided at the story clock, as a clock time reads it. */
const DECIDED_AT = Number(STORY_NOW) * 1000;

function consoleWith(overrides: Parameters<typeof storyPoolConsole>[0] = {}) {
  return storyPoolConsole({ claims: CLAIMS, titles: TITLES, ...overrides });
}

/** A card whose second read brings a new ask, the way the 20-second refresh does. */
function ArrivalCard(props: PoolClaimsCardProps) {
  const [claims, setClaims] = useState(CLAIMS.slice(0, 2));
  useEffect(() => setClaims(CLAIMS), []);
  return <PoolClaimsCard {...props} console={{ ...props.console, claims }} />;
}

const meta: Meta<typeof PoolClaimsCard> = {
  title: "Admin/Pool/PoolClaimsCard",
  component: PoolClaimsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Review Promises (PRD-1025, named by DL-077), at the top of the Promises tab's right column: everyone asking to take up a request or an offer. It is always there, one quiet line when nothing waits. Each row is two lines, who and when, then what for, with Decline… and Approve on the right; the row opens its promise. Pressing Approve puts the act's progress in the pair's place, then the outcome, which stays until the steward leaves the tab, and approving one closes the others on the same promise. A failure brings the pair back as Try Again, and a new ask joins the end marked New.",
      },
    },
  },
  args: {
    onDecline: () => undefined,
    onOpen: () => undefined,
    console: consoleWith(),
    vouchers: storyVoucherConsole(),
    target: { gardenName: "Rio Rainforest Lab", isProtocol: false },
    tone: "garden",
  },
  decorators: [
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolClaimsCard>;

/** Three waiting, two of them for the same ride. */
export const Waiting: Story = {};

/** Approve went out from Maria's row and the chain is confirming it; the other acts wait. */
export const Approving: Story = {
  args: {
    console: consoleWith({
      claimInFlight: true,
      claimPhase: (commitmentId, claimant) =>
        commitmentId === MARIA.claim.commitmentId && claimant === MARIA.claim.claimant
          ? { status: "confirming", key: keyOf(MARIA), hash: `0x${"a".repeat(64)}` }
          : { status: "idle" },
    }),
  },
};

/** Maria's approval landed: her row is its outcome, and Ana's ask on the same ride closed. */
export const Approved: Story = {
  args: {
    console: consoleWith({
      claimDecisions: {
        [keyOf(MARIA)]: { kind: "approved", commitmentId: "3", at: DECIDED_AT },
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);
    await expect(card.getByText("Not chosen")).toBeVisible();
    await expect(card.getByText(/1 waiting\. 2 decided this visit/)).toBeVisible();
  },
};

/** Approving the loan didn't go through: the pair comes back as Try Again. */
export const Failed: Story = {
  args: {
    console: consoleWith({
      claimDecisions: {
        [keyOf(MARIA)]: { kind: "approved", commitmentId: "3", at: DECIDED_AT },
      },
      claimPhase: (commitmentId, claimant) =>
        commitmentId === JOAO.claim.commitmentId && claimant === JOAO.claim.claimant
          ? { status: "failed", key: keyOf(JOAO) }
          : { status: "idle" },
    }),
  },
};

/** The last one was declined: nothing waits, and the outcomes stay for the visit. */
export const LastDecided: Story = {
  args: {
    console: consoleWith({
      claimDecisions: {
        [keyOf(MARIA)]: { kind: "approved", commitmentId: "3", at: DECIDED_AT },
        [keyOf(JOAO)]: { kind: "declined", commitmentId: "7", at: DECIDED_AT + 60_000 },
      },
    }),
  },
};

/** A new ask arrived with the refresh: it joins the end, marked New. */
export const NewArrival: Story = {
  render: (args) => <ArrivalCard {...args} />,
};

/** A fresh visit with nothing waiting: one quiet line, in its usual place. */
export const NothingWaiting: Story = {
  args: { console: consoleWith({ claims: [] }) },
};

/** Paused: the contract refuses decisions, so the rows only wait. */
export const Paused: Story = {
  args: { console: consoleWith({ pool: storyPool({ state: "PAUSED" }) }) },
};

/**
 * Tech and Sun's voucher bookings (PRD-1297 surface 6): Lina's hub day waits on
 * the Safe's approval (Approve…), and Kwesi's deposit is confirmed, so the steward
 * can accept it (Accept…). Neither is a one-tap Approve.
 */
export const VoucherAsks: Story = {
  args: {
    console: storyPoolConsole({ claims: STORY_TECH_AND_SUN_CLAIMS, titles: STORY_VOUCHER_TITLES }),
    vouchers: storyVoucherConsole(STORY_TECH_AND_SUN_VOUCHERS),
    target: { gardenName: "Tech and Sun", isProtocol: false },
  },
  beforeEach: nameVoucherMembers,
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);
    await expect(await card.findByText("Needs your approval")).toBeVisible();
    await expect(card.getByText("Deposit confirmed")).toBeVisible();
    await expect(card.getByRole("button", { name: "Approve…" })).toBeEnabled();
    await expect(card.queryByRole("button", { name: "Approve" })).toBeNull();
  },
};

/** Approve… opens the Safe's approval of the exact booking. */
export const VoucherApproveBooking: Story = {
  ...VoucherAsks,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Approve…" }));
    await expect(await screen.findByText("Approve Lina’s Booking?")).toBeVisible();
  },
};

/** Accept… opens the acceptance with its four checks, all holding. */
export const VoucherAccept: Story = {
  ...VoucherAsks,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Accept…" }));
    await expect(await screen.findByText("Accept Kwesi?")).toBeVisible();
  },
};

/** Kwesi was accepted: the outcome reads Accepted, never Approved. */
export const VoucherAccepted: Story = {
  args: {
    ...VoucherAsks.args,
    console: storyPoolConsole({
      claims: STORY_TECH_AND_SUN_CLAIMS,
      titles: STORY_VOUCHER_TITLES,
      claimDecisions: {
        [claimRowKey(STORY_TECH_AND_SUN_CLAIMS[1]!)]: {
          kind: "approved",
          commitmentId: "42",
          at: DECIDED_AT,
        },
      },
    }),
  },
  beforeEach: nameVoucherMembers,
};

/** Green Goods' console: Rafa's assisted session waits on a Safe that signs two of five. */
export const VoucherAskGreenGoods: Story = {
  args: {
    console: storyPoolConsole({ claims: STORY_GREEN_GOODS_CLAIMS, titles: STORY_VOUCHER_TITLES }),
    vouchers: storyVoucherConsole(STORY_GREEN_GOODS_VOUCHERS),
    target: { gardenName: "Green Goods Community Garden", isProtocol: true },
  },
  beforeEach: nameVoucherMembers,
};
