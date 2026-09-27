import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useENSClaim } from "@green-goods/shared/hooks/ens/useENSClaim";
import { useENSRegistrationStatus } from "@green-goods/shared/hooks/ens/useENSRegistrationStatus";
import { useENSReleaseName } from "@green-goods/shared/hooks/ens/useENSReleaseName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import type { Address, ENSRegistrationData } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, within, waitFor } from "storybook/test";
import { withAdminIdentityRole } from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { ENSSection } from "./ENSSection";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;

function withUsername({ releasing = false, online = true } = {}) {
  return () => {
    mocked(useOnlineStatus).mockReturnValue(online);
    mocked(useProtocolMemberStatus).mockReturnValue({ data: true, isLoading: false } as ReturnType<
      typeof useProtocolMemberStatus
    >);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "afo.greengoods.eth" } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: {
        status: "active",
        registration: { owner: ACCOUNT, nameType: 0, registeredAt: "1768521600" },
      },
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    mocked(useSlugAvailability).mockReturnValue({
      data: undefined,
      isFetching: false,
    } as ReturnType<typeof useSlugAvailability>);
    mocked(useENSClaim).mockReturnValue({
      mutateAsync: fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useENSClaim>);
    mocked(useENSReleaseName).mockReturnValue({
      mutateAsync: fn(async () => ({ slug: "afo" })),
      isPending: releasing,
      isSponsoredReleaseUnavailable: false,
    } as unknown as ReturnType<typeof useENSReleaseName>);
    return resetHookMocks(
      useOnlineStatus,
      useProtocolMemberStatus,
      useGreenGoodsEnsName,
      useEnsName,
      useENSRegistrationStatus,
      useSlugAvailability,
      useENSClaim,
      useENSReleaseName
    );
  };
}

/**
 * The Profile username card for a member who holds a Green Goods name. Releasing it asks first:
 * Release Username in the warning fill over an outlined Cancel in the shared bar (DL-016). The ENS
 * reads and the release mutation are mocked; the account is the dev deployer wallet.
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
  ],
};

export default meta;
type Story = StoryObj<typeof ENSSection>;

export const CurrentUsername: Story = {
  beforeEach: withUsername(),
  play: async () => {
    await expect(await screen.findByText("afo.greengoods.eth")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Release Username" })).toBeEnabled();
  },
};

export const ReleaseConfirm: Story = {
  beforeEach: withUsername(),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Release Username" }));
    const confirm = within(
      await screen.findByRole("alertdialog", { name: "Release this username?" })
    );
    const release = confirm.getByRole("button", { name: "Release Username" });
    await expect(release).toHaveAttribute("data-tone", "warning");
    await expect(release.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      confirm.getByRole("button", { name: "Cancel" }).getBoundingClientRect().top
    );
  },
};

export const Releasing: Story = {
  beforeEach: withUsername({ releasing: true }),
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Release Username" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const Offline: Story = {
  beforeEach: withUsername({ online: false }),
  play: async () => {
    await expect(
      await screen.findByRole("button", { name: "Go Online to Release" })
    ).toBeDisabled();
  },
};

/** A focus read can see our reservation before the wallet receipt comes back. */
export const ClaimReturnFromWallet: Story = {
  beforeEach: () => {
    const cleanup = withUsername()();
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: null, isLoading: false } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useSlugAvailability).mockReturnValue({ data: true, isFetching: false } as ReturnType<
      typeof useSlugAvailability
    >);
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: undefined,
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    return cleanup;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector("[data-ens-card]")!;
    let receive!: (
      value: Awaited<ReturnType<ReturnType<typeof useENSClaim>["mutateAsync"]>>
    ) => void;
    mocked(useENSClaim).mockReturnValue({
      mutateAsync: fn(
        () =>
          new Promise((resolve) => {
            receive = resolve;
          })
      ),
      isPending: false,
    } as unknown as ReturnType<typeof useENSClaim>);
    await userEvent.clear(canvas.getByRole("textbox"));
    await userEvent.type(canvas.getByRole("textbox"), "river");
    const heightBefore = card.getBoundingClientRect().height;
    // The availability result changes at submission; the component must stop displaying it.
    mocked(useSlugAvailability).mockReturnValue({ data: false, isFetching: false } as ReturnType<
      typeof useSlugAvailability
    >);
    await userEvent.click(canvas.getByRole("button", { name: "Claim Name" }));
    await expect(await canvas.findByText("Submitting your request")).toBeVisible();
    await expect(canvas.queryByText("This name is already taken")).not.toBeInTheDocument();
    await expect(card.getBoundingClientRect().height).toBe(heightBefore);
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: { status: "pending", ccipMessageId: "0x1234567890abcdef" },
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    receive({
      slug: "river",
      txHash: "0x1234",
      submittedAt: 1768521600000,
      ccipMessageId: "0x1234567890abcdef",
    });
    await waitFor(() => expect(canvas.getByText("Setting up your name")).toBeVisible());
    await expect(card.getBoundingClientRect().height).toBe(heightBefore);
    await expect(canvas.getByRole("button", { name: "Check status" })).toBeEnabled();
  },
};

export const DelayedRegistration: Story = {
  beforeEach: () => {
    const cleanup = withUsername()();
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: {
        status: "timed_out",
        ccipMessageId: "0x1234567890abcdef",
        submittedAt: 1768521600000,
      } satisfies ENSRegistrationData,
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    return cleanup;
  },
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Release Username" })).toBeEnabled();
    await expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
  },
};

export const RefreshFailed: Story = {
  beforeEach: () => {
    const cleanup = withUsername()();
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: {
        status: "active",
        registration: { owner: ACCOUNT, nameType: 0, registeredAt: "1768521600" },
      },
      isError: true,
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    return cleanup;
  },
  play: async () => {
    await expect(await screen.findByText("Ready to use")).toBeVisible();
    await expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t check your name. Please try again."
    );
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));
    await expect(mocked(useENSRegistrationStatus)("afo").refetch).toHaveBeenCalled();
  },
};

export const ReleaseInTransit: Story = {
  beforeEach: () => {
    const cleanup = withUsername()();
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: {
        status: "pending",
        release: { owner: ACCOUNT },
        submittedAt: 1768521600000,
        ccipMessageId: "0x1234567890abcdef",
      } satisfies ENSRegistrationData,
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    return cleanup;
  },
  play: async () => {
    await expect(await screen.findByText("Releasing your name")).toBeVisible();
    await expect(screen.queryByText("Ready to use")).not.toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Release started" })).toBeDisabled();
    await expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
  },
};

export const DelayedSupportRecovery: Story = {
  beforeEach: () => {
    const cleanup = withUsername()();
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: { status: "timed_out" },
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    mocked(useENSReleaseName).mockReturnValue({
      mutateAsync: fn(),
      isPending: false,
      isSponsoredReleaseUnavailable: true,
    } as unknown as ReturnType<typeof useENSReleaseName>);
    return cleanup;
  },
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Request Username Change" }));
    await expect(screen.getByRole("textbox", { name: "Desired username" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
  },
};
