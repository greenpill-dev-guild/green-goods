import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useENSClaim } from "@green-goods/shared/hooks/ens/useENSClaim";
import { useENSRegistrationStatus } from "@green-goods/shared/hooks/ens/useENSRegistrationStatus";
import {
  useENSReleaseFee,
  useENSReleaseName,
} from "@green-goods/shared/hooks/ens/useENSReleaseName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import { useUsernameChangeStore } from "@green-goods/shared/stores/useUsernameChangeStore";
import type { Address, ENSRegistrationData } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, waitFor, within } from "storybook/test";
import { withAdminIdentityRole, withRouter } from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { ENSSection } from "./ENSSection";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const LONG_NAME = "community-seed-library-and-water-survey-volunteers";

const active: ENSRegistrationData = {
  status: "active",
  registration: { owner: ACCOUNT, nameType: 0, registeredAt: "1768521600" },
};

interface UsernameStory {
  /** The account's name today, without its suffix; null for none. */
  name?: string | null;
  /** Registration status by name. */
  status?: Record<string, ENSRegistrationData | undefined>;
  statusError?: boolean;
  member?: boolean;
  online?: boolean;
  /** Which typed names read as free. */
  free?: Record<string, boolean>;
  /** A passkey account: its change goes through support (D8). */
  bySupport?: boolean;
  /** The change this device started. */
  change?: { from: string; to: string | null } | null;
  fee?: { isSuccess: boolean; isError: boolean; data: string | null };
}

function withUsername({
  name = "afo",
  status = { afo: active },
  statusError = false,
  member = true,
  online = true,
  free = {},
  bySupport = false,
  change = null,
  fee = { isSuccess: true, isError: false, data: "500000000000000" },
}: UsernameStory = {}) {
  return () => {
    mocked(useOnlineStatus).mockReturnValue(online);
    mocked(useProtocolMemberStatus).mockReturnValue({
      data: member,
      isLoading: false,
    } as ReturnType<typeof useProtocolMemberStatus>);
    mocked(useGreenGoodsEnsName).mockReturnValue({
      data: name ? `${name}.greengoods.eth` : null,
      isLoading: false,
    } as ReturnType<typeof useGreenGoodsEnsName>);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useENSRegistrationStatus).mockImplementation(
      (slug?: string) =>
        ({
          data: slug ? status[slug] : undefined,
          isError: statusError,
          isFetching: false,
          refetch: fn(),
        }) as unknown as ReturnType<typeof useENSRegistrationStatus>
    );
    mocked(useSlugAvailability).mockImplementation(
      (slug?: string) =>
        ({ data: slug ? free[slug] : undefined, isFetching: false }) as ReturnType<
          typeof useSlugAvailability
        >
    );
    mocked(useENSClaim).mockReturnValue({
      mutateAsync: fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useENSClaim>);
    mocked(useENSReleaseName).mockReturnValue({
      mutateAsync: fn(async () => ({ slug: "afo", owner: ACCOUNT, submittedAt: 1 })),
      isPending: false,
      isSponsoredReleaseUnavailable: bySupport,
    } as unknown as ReturnType<typeof useENSReleaseName>);
    mocked(useENSReleaseFee).mockReturnValue(fee as ReturnType<typeof useENSReleaseFee>);
    useUsernameChangeStore.setState({
      changes: change ? { [ACCOUNT.toLowerCase()]: { ...change, releasedAt: 1 } } : {},
    });
    const reset = resetHookMocks(
      useOnlineStatus,
      useProtocolMemberStatus,
      useGreenGoodsEnsName,
      useEnsName,
      useENSRegistrationStatus,
      useSlugAvailability,
      useENSClaim,
      useENSReleaseName,
      useENSReleaseFee
    );
    return () => {
      reset();
      useUsernameChangeStore.setState({ changes: {} });
    };
  };
}

/**
 * The Account tab's Username section (PRD-1026): the card on the tab's own
 * row, one text chip and one sentence per state, its acts at full width, and
 * the tall Change Username sheet it opens. The ENS reads, the release and the
 * claim are mocked; the change this device started is set in its store.
 */
const meta: Meta<typeof ENSSection> = {
  title: "Client/Profile/ENSSection",
  component: ENSSection,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: { primaryAddress: ACCOUNT },
  decorators: [
    (Story) => (
      <div className="flex min-h-[640px] flex-col gap-3 p-4">
        <Story />
      </div>
    ),
    withAdminIdentityRole("deployer"),
    withRouter(["/home/profile"]),
  ],
};

export default meta;
type Story = StoryObj<typeof ENSSection>;

/** p1: the name, Ready, one sentence, and Change Username below. */
export const Ready: Story = {
  beforeEach: withUsername(),
  play: async () => {
    await expect(await screen.findByText("afo.greengoods.eth")).toBeVisible();
    await expect(screen.getByText("Ready")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Change Username" })).toBeEnabled();
  },
};

/** p9: a wallet's change, the fee read as the sheet opens; it fits a 390 × 844 phone unscrolled. */
export const ChangeUsernameSheet: Story = {
  beforeEach: withUsername({ free: { "afo-dev": true } }),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Username" }));
    const sheet = within(await screen.findByTestId("app-sheet"));
    await expect(sheet.getByTestId("change-username-steps")).toHaveTextContent(
      "your wallet releases afo.greengoods.eth for a 0.0005 ETH fee."
    );
    await userEvent.type(sheet.getByLabelText("New username"), "afo-dev");
    await waitFor(() => expect(sheet.getByTestId("change-username-submit")).toBeEnabled());
    const body = screen
      .getByTestId("app-sheet")
      .querySelector("[data-component='PwaSheet'][data-slot='body']");
    if (body) await expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight + 1);
  },
};

/** No fee read, no release: the sheet says so and holds its action. */
export const FeeUnreadable: Story = {
  beforeEach: withUsername({
    free: { "afo-dev": true },
    fee: { isSuccess: false, isError: true, data: null },
  }),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Username" }));
    const sheet = within(await screen.findByTestId("app-sheet"));
    await expect(sheet.getByTestId("change-username-steps")).toHaveTextContent(
      "The fee couldn’t be read"
    );
    await expect(sheet.getByTestId("change-username-submit")).toBeDisabled();
  },
};

/** p9a: step 1 of 2 while the old name releases; the card names the new one. */
export const ChangingStepOne: Story = {
  beforeEach: withUsername({
    status: { afo: { status: "pending", release: { owner: ACCOUNT } } },
    change: { from: "afo", to: "afo-dev" },
  }),
  play: async () => {
    await expect(await screen.findByText("Changing · 1 of 2")).toBeVisible();
    await expect(screen.getByText(/you’ll claim afo-dev\.greengoods\.eth/)).toBeVisible();
    await expect(screen.getByRole("button", { name: "Check Status" })).toBeEnabled();
  },
};

/** p9c: the old name cleared; one act left, or another name. */
export const ChangingStepTwo: Story = {
  beforeEach: withUsername({
    name: null,
    status: { afo: { status: "available", release: { owner: ACCOUNT } } },
    free: { "afo-dev": true },
    change: { from: "afo", to: "afo-dev" },
  }),
  play: async () => {
    await expect(await screen.findByText("Changing · 2 of 2")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Claim afo-dev" })).toBeEnabled();
    await expect(screen.getByRole("button", { name: "Choose Another" })).toBeEnabled();
  },
};

/** p9x: the chosen name was claimed by someone else while the old one cleared. */
export const ChooseAgain: Story = {
  beforeEach: withUsername({
    name: null,
    status: { afo: { status: "available", release: { owner: ACCOUNT } } },
    free: { "afo-dev": false },
    change: { from: "afo", to: "afo-dev" },
  }),
  play: async () => {
    await expect(await screen.findByText("No username right now")).toBeVisible();
    await expect(screen.getByText("Choose again")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Claim Name" })).toBeDisabled();
  },
};

/** p3: registered and on its way; Check Status is the only act. */
export const SettingUp: Story = {
  beforeEach: withUsername({ status: { afo: { status: "pending", submittedAt: 1 } } }),
  play: async () => {
    await expect(await screen.findByText("Setting up")).toBeVisible();
    await expect(screen.queryByRole("button", { name: "Change Username" })).toBeNull();
  },
};

/** p4: taking longer, with Get Help beside Check Status. */
export const TakingLonger: Story = {
  beforeEach: withUsername({ status: { afo: { status: "timed_out", submittedAt: 1 } } }),
  play: async () => {
    await expect(await screen.findByText("Taking longer")).toBeVisible();
    await expect(screen.getByRole("link", { name: "Get Help" })).toBeVisible();
  },
};

/** p5, D10: a failed check with nothing known offers only another check. */
export const StatusUnknown: Story = {
  beforeEach: withUsername({ status: {}, statusError: true }),
  play: async () => {
    await expect(await screen.findByText("Status unknown")).toBeVisible();
    await expect(screen.queryByRole("button", { name: "Change Username" })).toBeNull();
    await expect(screen.getByRole("button", { name: "Check Status" })).toBeEnabled();
  },
};

export const Offline: Story = {
  beforeEach: withUsername({ status: {}, statusError: true, online: false }),
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Go Online to Check" })).toBeDisabled();
  },
};

/** p7: no name yet; the field keeps its line for availability and the count. */
export const NoUsernameYet: Story = {
  beforeEach: withUsername({ name: null, status: {}, free: { afo: true } }),
  play: async () => {
    await expect(await screen.findByText("No username yet")).toBeVisible();
    await userEvent.type(screen.getByLabelText("Username"), "afo");
    await expect(await screen.findByText("Name available")).toBeVisible();
    await expect(screen.getByText("3/50")).toBeVisible();
  },
};

/** p8: outside every garden, the way in is Open Gardens. */
export const NotAvailableYet: Story = {
  beforeEach: withUsername({ name: null, status: {}, member: false }),
  play: async () => {
    await expect(await screen.findByText("Not available yet")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Open Gardens" })).toBeEnabled();
  },
};

/** p10: a passkey account's change is a support request, in the same tall sheet. */
export const PasskeyChange: Story = {
  beforeEach: withUsername({ bySupport: true }),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Username" }));
    const sheet = within(await screen.findByTestId("app-sheet"));
    await expect(sheet.getByLabelText("Desired username")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Prepare Request" })).toBeVisible();
  },
};

/** A claim in flight: a read may already call the name taken, by this very claim. */
export const ClaimReturnFromWallet: Story = {
  beforeEach: withUsername({ name: null, status: {}, free: { river: true } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The wallet keeps the claim: it never answers in this story.
    mocked(useENSClaim).mockReturnValue({
      mutateAsync: fn(() => new Promise(() => undefined)),
      isPending: false,
    } as unknown as ReturnType<typeof useENSClaim>);
    await userEvent.type(await canvas.findByLabelText("Username"), "river");
    await userEvent.click(await canvas.findByRole("button", { name: "Claim Name" }));
    mocked(useSlugAvailability).mockReturnValue({ data: false, isFetching: false } as ReturnType<
      typeof useSlugAvailability
    >);
    await expect(await canvas.findByText("Claiming")).toBeVisible();
    await expect(canvas.queryByText("This name is already taken")).toBeNull();
  },
};

/** p11: the longest name wraps beside the icon and is never cut off. */
export const LongName: Story = {
  beforeEach: withUsername({ name: LONG_NAME, status: { [LONG_NAME]: active } }),
  globals: { viewport: { value: "mobile" } },
  play: async () => {
    const name = await screen.findByText(`${LONG_NAME}.greengoods.eth`);
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1);
  },
};
