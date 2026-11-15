import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, userEvent, within } from "storybook/test";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import {
  AIYELOJA,
  activeGarden,
  memberGarden,
  STORY_ACCOUNT,
  TAS_HUB,
} from "../../../../shared/.storybook/homeFixtures";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { ProfileHelp } from "./Help";

/**
 * Signed in as the story account with these gardens, their roles deciding the Hub row; with
 * none, a member of no garden. The tab reads the account and its gardens, so every story sets
 * them: the real hooks need the app's wallet runtime, which a story does not mount.
 */
const signedInWith =
  (gardens: Parameters<typeof activeGarden>[1] = [], gardenId: string | null = null) =>
  () => {
    mocked(usePrimaryAddress).mockReturnValue(STORY_ACCOUNT);
    mocked(useActiveGarden).mockReturnValue(
      gardenId ? activeGarden("ready", gardens, gardenId) : activeGarden("none")
    );
    return resetHookMocks(usePrimaryAddress, useActiveGarden);
  };

/**
 * Profile › Help: guides and socials under Learn & Connect, the policies and support
 * requests under Privacy & Safety, then the questions by category. A question that a
 * gardener guide walks through ends with a link to it. Promises have their own
 * category, where How Promises Work in the Offer or Ask sheet leads. A steward's
 * Learn & Connect starts with the Green Goods Hub (PRD-1492).
 */
const meta: Meta<typeof ProfileHelp> = {
  title: "Client/Profile/Help",
  component: ProfileHelp,
  parameters: { layout: "fullscreen" },
  decorators: [
    // The profile's content column: the app's `padded` gutter is 16px on a phone.
    (Story) => (
      <div className="mx-4 flex flex-col gap-4 py-4">
        <Story />
      </div>
    ),
    withAppPage,
  ],
  beforeEach: signedInWith(),
};

export default meta;
type Story = StoryObj<typeof ProfileHelp>;

/** The Promises category, with its first question open. */
export const Promises: Story = {
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Promises" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "What are promises?" }));
    await expect(canvas.getByTestId("faq-content-whatArePromises")).toBeVisible();
    // Promises moved out of Funds and Wallet: no question there says "pool" any more.
    await expect(canvas.queryByText(/What are pools\?/)).toBeNull();
  },
};

/** A steward of TAS HUB: the Green Goods Hub leads Learn & Connect and opens this build's Hub. */
export const Steward: Story = {
  tags: ["storybook-ci"],
  args: { hubUrl: "https://hub.example.org" },
  beforeEach: signedInWith([memberGarden(TAS_HUB, ["steward"])], TAS_HUB.id),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole("link");
    await expect(first).toHaveAccessibleName(/Green Goods Hub/);
    await expect(first).toHaveAttribute("href", "https://hub.example.org");
  },
};

/** A gardener only: no Hub row, and Learn & Connect starts with the guides. */
export const Gardener: Story = {
  tags: ["storybook-ci"],
  args: { hubUrl: "https://hub.example.org" },
  beforeEach: signedInWith([memberGarden(AIYELOJA, ["gardener"])], AIYELOJA.id),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("link", { name: /Green Goods Hub/ })).toBeNull();
  },
};
