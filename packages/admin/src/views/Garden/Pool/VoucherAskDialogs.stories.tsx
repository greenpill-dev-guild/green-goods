import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { VoucherAcceptDialog, VoucherApproveDialog } from "./VoucherAskDialogs";
import {
  STORY_GREEN_GOODS_SAFE,
  STORY_KWESI_ASK,
  STORY_LINA_ASK,
  STORY_MARA_ACCESS_ASK,
  STORY_MAYA_ASK,
  STORY_TECH_AND_SUN_SAFE,
  STORY_TECH_AND_SUN_VOUCHERS,
  nameVoucherMembers,
} from "./poolStoryVouchers";

const NOW_MS = STORYBOOK_NOW_SECONDS * 1000;
const TARGET = { gardenName: "Tech and Sun", isProtocol: false };
/** Green Goods' own pool is the protocol pool, the Green Goods Community Garden's. */
const GREEN_GOODS_TARGET = { gardenName: "Green Goods Community Garden", isProtocol: true };

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const meta: Meta = {
  title: "Admin/Pool/VoucherAskDialogs",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The two dialogs a voucher booking's ask opens from Review Promises (PRD-1297 surface 6, `SIssuer`), on the cockpit's confirm dialog. Approve Booking is the issuer Safe's approval of the exact booking: an escrow write, so a plain description rather than the pool's target line, its facts, a note that approving isn't accepting, and the Safe's signature count read from the Safe. Accept is the pool steward's `acceptServiceClaim`: it names the pool, lists the four checks the contract enforces (current consent, the Safe's approval, the confirmed deposit, the deadline), keeps Accept off while any fails, and follows the act from the wallet to the chain. A member issuer's booking (slice 2) names the member's own terms and their approval from their own account, and says the steward couldn't have given it. The people, addresses and moments are fictional.",
      },
    },
  },
  beforeEach: nameVoucherMembers,
};

export default meta;
type Story = StoryObj;

const approve = (overrides: Partial<Parameters<typeof VoucherApproveDialog>[0]> = {}) => (
  <VoucherApproveDialog
    ask={STORY_LINA_ASK}
    title="Hub day, up to 4 hours"
    safe={STORY_TECH_AND_SUN_SAFE}
    nowMs={NOW_MS}
    disabled={false}
    tone="garden"
    onClose={() => undefined}
    onApprove={async () => undefined}
    {...overrides}
  />
);

const accept = (overrides: Partial<Parameters<typeof VoucherAcceptDialog>[0]> = {}) => (
  <VoucherAcceptDialog
    ask={STORY_KWESI_ASK}
    title="Hub day, up to 4 hours"
    target={TARGET}
    chainId={42161}
    now={STORYBOOK_NOW_SECONDS}
    phase={{ status: "idle" }}
    disabled={false}
    tone="garden"
    onClose={() => undefined}
    onAccept={async () => undefined}
    {...overrides}
  />
);

/** Tech and Sun approves Lina's hub day; its Safe needs one signature, read from the Safe. */
export const ApproveBooking: Story = {
  render: () => approve(),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Approve Lina’s Booking?")).toBeVisible();
    await expect(dialog.getByText("It isn’t acceptance.", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Your Safe needs 1 signature.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Approve Booking" })).toBeEnabled();
  },
};

/** Green Goods' Safe signs two of five, so the dialog says so. */
export const ApproveTwoOfFive: Story = {
  render: () => approve({ safe: STORY_GREEN_GOODS_SAFE }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Your Safe needs 2 of 5 signatures.")).toBeVisible();
  },
};

/** The Safe can't be read: the dialog says the Safe signs, without inventing a count. */
export const ApproveSafeUnread: Story = {
  render: () =>
    approve({
      safe: {
        ...STORY_TECH_AND_SUN_SAFE,
        status: "unavailable",
        threshold: null,
        owners: null,
        signers: null,
      },
    }),
};

/** The console went offline with the dialog open: Approve Booking waits, as the row's act does. */
export const ApproveOffline: Story = {
  render: () => approve({ disabled: true }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: "Approve Booking" })).toBeDisabled();
  },
};

/** Kwesi's deposit is confirmed on Green Goods: every check holds, and Accept is on. */
export const AcceptBooking: Story = {
  render: () => accept(),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Accept Kwesi?")).toBeVisible();
    const checks = dialog.getByTestId("voucher-acceptance-checks");
    await expect(checks.querySelectorAll('[data-holds="true"]')).toHaveLength(4);
    await expect(dialog.getByRole("button", { name: "Accept Kwesi" })).toBeEnabled();
  },
};

/** The deposit hasn't reached Green Goods yet: that check fails, and Accept stays off. */
export const AcceptBlocked: Story = {
  render: () =>
    accept({
      ask: {
        ...STORY_KWESI_ASK,
        setup: STORY_KWESI_ASK.setup && { ...STORY_KWESI_ASK.setup, depositConfirmed: false },
      },
    }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Not confirmed on Green Goods yet")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Accept Kwesi" })).toBeDisabled();
  },
};

/** The ask names no agreement the acceptance can name: the consent check says so, not changed terms. */
export const AcceptAgreementMissing: Story = {
  render: () => accept({ ask: { ...STORY_KWESI_ASK, claimHash: `0x${"00".repeat(32)}` } }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(
      dialog.getByText("There’s no agreement from Kwesi to accept, so they book again")
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Accept Kwesi" })).toBeDisabled();
  },
};

/** Accept went out and the chain is confirming it: the dialog holds and says where the act stands. */
export const Accepting: Story = {
  render: () =>
    accept({
      phase: { status: "confirming", key: "accept", hash: `0x${"a".repeat(64)}` },
      onAccept: () => new Promise(() => undefined),
    }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Accept Kwesi" }));
    await expect(await dialog.findByText(/Confirming on/)).toBeVisible();
  },
};

/**
 * Green Goods accepts Mara's 30 days of Claude access in its own pool, the protocol pool: the
 * dialog sets that pool apart with its warning, and all four checks hold for her 10 vouchers.
 */
export const AcceptGreenGoodsAccess: Story = {
  render: () =>
    accept({
      ask: STORY_MARA_ACCESS_ASK,
      title: "Claude access, 30 days",
      target: GREEN_GOODS_TARGET,
    }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    // The dialog fades in, so its words are read once it has.
    await waitFor(() => expect(dialog.getByText("Accept Mara?")).toBeVisible());
    await expect(dialog.getByText("Writing to the Green Goods protocol pool")).toBeVisible();
    await expect(dialog.getByText("10 vouchers deposited in escrow")).toBeVisible();
    const checks = dialog.getByTestId("voucher-acceptance-checks");
    await expect(checks.querySelectorAll('[data-holds="true"]')).toHaveLength(4);
    await expect(dialog.getByRole("button", { name: "Accept Mara" })).toBeEnabled();
  },
};

/**
 * Maya's lesson is Teo's, a member who approved it from his own account: the checks name his
 * terms and approval, and the note says the steward couldn't have approved for him.
 */
export const AcceptMemberBooking: Story = {
  render: () => accept({ ask: STORY_MAYA_ASK, title: "Integration lesson, 60 minutes" }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    // The dialog fades in, so its words are read once it has.
    await waitFor(() => expect(dialog.getByText("Accept Maya?")).toBeVisible());
    await expect(dialog.getByText("Maya agreed to Teo Alves’s current terms")).toBeVisible();
    await expect(
      dialog.getByText("Teo Alves approved the booking from their account")
    ).toBeVisible();
    await expect(dialog.queryByText("Your Safe approved the booking")).toBeNull();
    await expect(dialog.getByText("you couldn’t give it for them", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Accept Maya" })).toBeEnabled();
  },
};

export const AcceptMemberBookingEs: Story = {
  render: AcceptMemberBooking.render,
  decorators: [inLocale("es")],
};

export const AcceptMemberBookingPt: Story = {
  render: AcceptMemberBooking.render,
  decorators: [inLocale("pt")],
};

export const ApproveBookingEs: Story = {
  render: () => approve(),
  decorators: [inLocale("es")],
};

export const AcceptBookingEs: Story = {
  render: () => accept(),
  decorators: [inLocale("es")],
};

export const ApproveBookingPt: Story = {
  render: () => approve(),
  decorators: [inLocale("pt")],
};

export const AcceptBookingPt: Story = {
  render: () => accept(),
  decorators: [inLocale("pt")],
};

/** Collective approvals download a proposal and remain unapproved until Safe execution. */
export const SafeFileApproval: Story = {
  render: () =>
    approve({
      ask: {
        ...STORY_LINA_ASK,
        agreedAt: null,
        issuer: { ...STORY_TECH_AND_SUN_VOUCHERS.issuer!, execution: "safe-file" },
      },
    }),
};
