import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useENSClaim } from "@green-goods/shared/hooks/ens/useENSClaim";
import { useENSRegistrationStatus } from "@green-goods/shared/hooks/ens/useENSRegistrationStatus";
import { useENSReleaseName } from "@green-goods/shared/hooks/ens/useENSReleaseName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import { ENSSection } from "./ENSSection";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;

function withUsername({ releasing = false, online = true } = {}) {
  return () => {
    mocked(useOffline).mockReturnValue({ isOnline: online } as ReturnType<typeof useOffline>);
    mocked(useProtocolMemberStatus).mockReturnValue({ data: true, isLoading: false } as ReturnType<
      typeof useProtocolMemberStatus
    >);
    mocked(useGreenGoodsEnsName).mockReturnValue({ data: "afo.greengoods.eth" } as ReturnType<
      typeof useGreenGoodsEnsName
    >);
    mocked(useENSRegistrationStatus).mockReturnValue({ data: undefined } as ReturnType<
      typeof useENSRegistrationStatus
    >);
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
      useOffline,
      useProtocolMemberStatus,
      useGreenGoodsEnsName,
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
 * reads and the release mutation are mocked.
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
  ],
};

export default meta;
type Story = StoryObj<typeof ENSSection>;

export const CurrentUsername: Story = {
  beforeEach: withUsername(),
  play: async () => {
    await expect(
      await screen.findByText("People can find you as afo.greengoods.eth.")
    ).toBeVisible();
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
