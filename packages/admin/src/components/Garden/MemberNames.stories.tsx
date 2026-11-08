import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useState } from "react";
import { expect, within } from "storybook/test";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_PROFILE } from "../../../../shared/.storybook/fixtures";
import { MemberNameReaders, withMemberName } from "./MemberNames";
import { manageRolesIdentity, manageRolesPeople } from "./manageRolesStoryFixtures";

/** Shows what the readers collect, which is what Members and Manage Roles search by. */
function NamesReadForSearch({ addresses }: { addresses: Address[] }) {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const onName = useCallback(
    (address: Address, name: string | null) =>
      setNames((current) => withMemberName(current, address, name)),
    []
  );
  return (
    <div className="space-y-2">
      <MemberNameReaders addresses={addresses} onName={onName} />
      <ul className="space-y-1 type-body">
        {addresses.map((address) => (
          <li key={address} className="flex gap-3">
            <code className="type-meta text-text-sub">{address.slice(0, 10)}</code>
            <span className="text-text-strong">
              {names.get(address.toLowerCase()) ?? "(no name)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta: Meta<typeof NamesReadForSearch> = {
  title: "Admin/Workflows/Garden/MemberNames",
  component: NamesReadForSearch,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(manageRolesIdentity(FIXTURE_IMAGE_PROFILE)),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "MemberNameReaders renders nothing: it reads the name each person's row shows (their Green Goods name, then ENS, then a passkey name), so a search on the Members tab or in Manage Roles finds people by the words on screen. This story prints what it read.",
      },
    },
  },
  args: { addresses: manageRolesPeople.map((person) => person.address) },
};

export default meta;
type Story = StoryObj<typeof NamesReadForSearch>;

export const ReadsShownNames: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("ana-souza.eth")).toBeVisible();
    await expect(await canvas.findByText("chidinma.greengoods.eth")).toBeVisible();
  },
};
