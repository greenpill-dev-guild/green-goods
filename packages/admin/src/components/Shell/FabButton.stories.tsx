import type { FabAction, FabConfig } from "@green-goods/shared/components/Canvas/NavigationBar";
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiHandCoinLine,
  RiMedalLine,
  RiMoneyDollarCircleLine,
  RiSettings3Line,
  RiUserAddLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FabButton } from "./FabButton";

/** A config as `useViewActions` builds it: the primary first, lending its icon and label. */
function fabConfig(primary: FabAction, ...rest: FabAction[]): FabConfig {
  return { icon: primary.icon, label: primary.label, actions: [primary, ...rest], onAction: fn() };
}

const addMember: FabAction = {
  id: "add-member",
  icon: RiUserAddLine,
  label: "Add Member",
  labelId: "cockpit.community.action.addMember",
};
const depositWithdraw: FabAction = {
  id: "deposit-withdraw",
  icon: RiMoneyDollarCircleLine,
  label: "Deposit / Withdraw",
  labelId: "cockpit.community.action.depositWithdraw",
};
const fundCookieJar: FabAction = {
  id: "fund-payout-jar",
  icon: RiHandCoinLine,
  label: "Fund Cookie Jar",
  labelId: "cockpit.community.action.fundPayoutJar",
};

// Each workspace's action set, as its view declares it.
const hubDial = fabConfig(
  {
    id: "submit-work",
    icon: RiAddLine,
    label: "Submit Work",
    labelId: "cockpit.hub.action.submitWork",
  },
  {
    id: "create-assessment",
    icon: RiCheckLine,
    label: "Create Assessment",
    labelId: "cockpit.hub.action.createAssessment",
  },
  {
    id: "create-hypercert",
    icon: RiMedalLine,
    label: "Create Hypercert",
    labelId: "cockpit.hub.action.createHypercert",
  }
);
const gardenDial = fabConfig(
  {
    id: "edit-garden",
    icon: RiSettings3Line,
    label: "Edit Garden",
    labelId: "cockpit.garden.action.editGarden",
  },
  {
    id: "view-public",
    icon: RiExternalLinkLine,
    label: "View Public",
    labelId: "cockpit.garden.action.viewPublic",
  }
);
const communityDial = fabConfig(addMember, depositWithdraw, fundCookieJar);
const actionsFab = fabConfig({
  id: "create-action",
  icon: RiAddLine,
  label: "Create Action",
  labelId: "cockpit.actions.action.createAction",
});

const meta = {
  title: "Admin/Shell/FabButton",
  component: FabButton,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    workspace: "hub",
    docs: {
      description: {
        component:
          "The cockpit's creation FAB (Cockpit M3, finished): circular, tone-action filled, warm chrome shadow at rest. Closed, it shows a plus in every workspace, whether it fires one act or opens a dial; the workspace tone says which tab it belongs to (DL-078). A multi-action config opens the speed dial, where each act keeps its own icon and label, and shows a close icon while open. Single-action configs fire directly and get a hover tooltip. Floats above the nav bar on tablet/mobile only — desktop carries inline header actions instead.",
      },
    },
  },
  decorators: [
    // The root CanvasLayout renders: the FAB takes its fill from the
    // workspace's [data-tone] scope. A story names its workspace in
    // parameters.workspace.
    (Story, { parameters }) => (
      <div
        className="admin-m3 workspace-canvas flex min-h-[360px] items-end justify-end p-8"
        data-tone={parameters.workspace}
      >
        <Story />
      </div>
    ),
  ],
  args: { config: hubDial, mobileFloating: true },
} satisfies Meta<typeof FabButton>;

export default meta;
type Story = StoryObj<typeof meta>;
type Play = NonNullable<Story["play"]>;

/** The fill is the workspace's own --tone-action, never the no-tone fallback. */
async function expectWorkspaceTone(fab: HTMLElement) {
  const style = getComputedStyle(fab);
  const tone = style.getPropertyValue("--tone-action").trim().split(/\s+/).join(", ");
  await expect(style.backgroundColor).toBe(`rgb(${tone})`);
}

/** Closed, a dial is the plus in its workspace's tone, named for what it opens. */
const restsClosed: Play = async ({ canvasElement }) => {
  const fab = within(canvasElement).getByRole("button", { name: "Open Actions" });
  // A menu control stays expandable while collapsed — dropping the attribute
  // reads to assistive tech as a control that cannot open.
  await expect(fab).toHaveAttribute("aria-expanded", "false");
  await expectWorkspaceTone(fab);
};

/** Open, the button is named for closing, and each act says what it does. */
function opensDial(...labels: string[]): Play {
  return async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: "Open Actions" });
    await userEvent.click(fab);
    await expect(fab).toHaveAccessibleName("Close Actions");
    await expect(fab).toHaveAttribute("aria-expanded", "true");
    const items = await canvas.findAllByRole("menuitem");
    await expect(items.map((item) => item.textContent)).toEqual(labels);
  };
}

export const Hub: Story = { play: restsClosed };

export const HubOpen: Story = {
  play: opensDial("Submit Work", "Create Assessment", "Create Hypercert"),
};

export const Garden: Story = {
  args: { config: gardenDial },
  parameters: { workspace: "garden" },
  play: restsClosed,
};

export const GardenOpen: Story = { ...Garden, play: opensDial("Edit Garden", "View Public") };

export const Community: Story = {
  args: { config: communityDial },
  parameters: { workspace: "community" },
  play: restsClosed,
};

export const CommunityOpen: Story = {
  ...Community,
  play: opensDial("Add Member", "Deposit / Withdraw", "Fund Cookie Jar"),
};

/** Actions declares one act, so its FAB fires directly: the same plus, beside the act's label. */
export const Actions: Story = {
  args: { config: actionsFab },
  parameters: { workspace: "actions" },
  play: async ({ args, canvasElement }) => {
    const fab = within(canvasElement).getByRole("button", { name: "Create Action" });
    await expectWorkspaceTone(fab);
    await userEvent.click(fab);
    await expect(args.config.onAction).toHaveBeenCalledWith("create-action");
    // Single-action mode is a direct-fire button, not a menu.
    await expect(fab).not.toHaveAttribute("aria-expanded");
  },
};

/** Choosing an act fires it and closes the dial. */
export const ActionChosen: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: "Open Actions" });
    await userEvent.click(fab);
    await userEvent.click(await canvas.findByRole("menuitem", { name: "Submit Work" }));
    await expect(args.config.onAction).toHaveBeenCalledWith("submit-work");
    await expect(fab).toHaveAttribute("data-state", "closed");
    // The chosen item unmounts with the dial; focus returns to the FAB rather
    // than falling to <body>.
    await expect(fab).toHaveFocus();
  },
};

/** A disabled action stays in the dial and says why, since touch has no hover (D10). */
export const DisabledActionSaysWhy: Story = {
  args: {
    config: fabConfig(addMember, {
      ...fundCookieJar,
      disabled: true,
      disabledReasonId: "cockpit.community.action.fundPayoutJarNoJar",
      disabledReason: "This garden has no payout jar yet.",
    }),
  },
  parameters: { workspace: "community" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open/i }));
    const fund = await canvas.findByRole("menuitem", { name: "Fund Cookie Jar" });
    // Inert but focusable, so a keyboard reaches the reason too.
    await expect(fund).toHaveAttribute("aria-disabled", "true");
    await expect(fund).toHaveTextContent("This garden has no payout jar yet.");
    await expect(fund).toHaveAccessibleDescription("This garden has no payout jar yet.");
    await expect(args.config.onAction).not.toHaveBeenCalled();
  },
};

/**
 * Regression guard for WCAG 2.5.3 (Label in Name): the accessible name has to
 * be the visible label. The FAB renders the *translated action* label, so a
 * config whose own `label` differs must not leak into `aria-label` — speech
 * input activates a control by what it says.
 */
export const SingleActionLabelMismatch: Story = {
  args: {
    config: {
      icon: RiCheckboxCircleLine,
      // Deliberately different from the translated action label below.
      label: "Create",
      actions: [
        {
          id: "assessment",
          icon: RiCheckboxCircleLine,
          label: "Create Assessment",
          labelId: "cockpit.hub.fab.createAssessment",
        },
      ],
      onAction: fn(),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolving the button by that exact name proves the accessible name is the
    // translated action label, not config.label ("Create").
    const fab = canvas.getByRole("button", { name: "Create Assessment" });
    // The same string is the label rendered inside the button. The hover
    // tooltip carries it too, so scope to the button rather than the canvas.
    await expect(within(fab).getByText("Create Assessment")).toBeInTheDocument();
  },
};
