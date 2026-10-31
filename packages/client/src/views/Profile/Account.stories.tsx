import { ServiceWorkerUpdateProvider } from "@green-goods/shared/hooks/app/useServiceWorkerUpdate";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useENSRegistrationStatus } from "@green-goods/shared/hooks/ens/useENSRegistrationStatus";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, within } from "storybook/test";
import { JOURNEY_GARDEN_RECORD } from "../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAdminIdentityRole,
  withAppPage,
  withRouter,
} from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { ProfileAccount } from "./Account";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;

/**
 * The Profile's Account tab (DL-152): every section a titled, divided fact list under one heading
 * pattern, Username and Your Services as rows with their act in the right slot, and only the
 * install card, when the phone offers one, still a card. The gardens and the name are fictional.
 */
const meta: Meta<typeof ProfileAccount> = {
  title: "Client/Profile/Account",
  component: ProfileAccount,
  tags: ["storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    // The profile's content column: the app's `padded` gutter is 16px on a phone.
    (Story) => (
      <div className="mx-4 flex flex-col gap-4 py-4">
        <ServiceWorkerUpdateProvider>
          <Story />
        </ServiceWorkerUpdateProvider>
      </div>
    ),
    withAdminIdentityRole("deployer"),
    withRouter(["/home/profile"]),
    withAppPage,
  ],
  beforeEach: () => {
    mocked(useGardens).mockReturnValue({
      data: [
        { ...JOURNEY_GARDEN_RECORD, gardeners: [ACCOUNT] },
        {
          ...JOURNEY_GARDEN_RECORD,
          id: "0x00000000000000000000000000000000000000a2",
          name: "Hilltop Market Garden",
          location: "",
          gardeners: [ACCOUNT],
        },
      ],
      isPlaceholderData: false,
      isError: false,
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useActiveGarden).mockReturnValue({
      gardenId: JOURNEY_GARDEN_RECORD.id,
      selectGarden: fn(),
    } as unknown as ReturnType<typeof useActiveGarden>);
    mocked(useOnlineStatus).mockReturnValue(true);
    mocked(useProtocolMemberStatus).mockReturnValue({
      data: true,
      isLoading: false,
    } as ReturnType<typeof useProtocolMemberStatus>);
    mocked(useGreenGoodsEnsName).mockReturnValue({
      data: "amara.greengoods.eth",
      isLoading: false,
    } as ReturnType<typeof useGreenGoodsEnsName>);
    mocked(useEnsName).mockReturnValue({ data: null } as ReturnType<typeof useEnsName>);
    mocked(useENSRegistrationStatus).mockReturnValue({
      data: {
        status: "active",
        registration: { owner: ACCOUNT, nameType: 0, registeredAt: "1768521600" },
      },
      isError: false,
      isFetching: false,
      refetch: fn(),
    } as unknown as ReturnType<typeof useENSRegistrationStatus>);
    return resetHookMocks(
      useGardens,
      useActiveGarden,
      useOnlineStatus,
      useProtocolMemberStatus,
      useGreenGoodsEnsName,
      useEnsName,
      useENSRegistrationStatus
    );
  },
};

export default meta;
type Story = StoryObj<typeof ProfileAccount>;

/** The whole tab on a phone: one heading pattern, and each section's rows in one list. */
export const Current: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sections = ["Settings", "My gardens", "Username", "Your Services", "Account"];
    for (const name of sections) {
      await expect(await canvas.findByRole("heading", { level: 5, name })).toBeVisible();
    }
    await expect(canvasElement.querySelectorAll("h1, h2, h3, h4, h6")).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('[data-component="FactList"]')).toHaveLength(
      sections.length
    );
    const change = canvas.getByRole("button", { name: "Change Username" });
    await expect(change.closest(".gg-fact-action")).not.toBeNull();
    await expect(canvas.getByRole("button", { name: "Hilltop Market Garden" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Riverside Commons Garden" })).toHaveAttribute(
      "aria-describedby"
    );
  },
};
