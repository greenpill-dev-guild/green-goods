import { RiAppsLine, RiHammerLine, RiSeedlingLine, RiTeamLine, RiUserLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ToolbarSlot } from "@green-goods/shared/components/Canvas/NavigationBar";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { IntlProvider } from "react-intl";
import { NavigationBar } from "./NavigationBar";

const slots: ToolbarSlot[] = [
  {
    id: "hub",
    label: "Hub",
    labelId: "cockpit.nav.hub",
    icon: RiAppsLine,
    path: "/hub",
    visible: true,
  },
  {
    id: "garden",
    label: "Garden",
    labelId: "cockpit.nav.garden",
    icon: RiSeedlingLine,
    path: "/garden",
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: RiTeamLine,
    path: "/community",
    visible: true,
  },
  {
    id: "actions",
    label: "Actions",
    labelId: "app.admin.nav.actions",
    icon: RiHammerLine,
    path: "/actions",
    visible: true,
  },
];

const meta = {
  title: "Admin/Shell/NavigationBar",
  component: NavigationBar,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin fork of the Canvas navigation dock (Cockpit M3, finished). Centered floating pill of 94px minimum wells that grow for localized labels; the active item carries the tone-primary-container icon pill and a weight-600 ink label — one of the three sanctioned workspace-tone uses. Material comes from the `.canvas-navigation-bar` chrome rules in admin-m3-tokens.css.",
      },
    },
  },
  decorators: [
    withCanvasFrame({
      className: "relative",
      heightClassName: "min-h-[420px]",
      workspace: "hub",
    }),
  ],
  args: {
    slots,
    activePath: "/hub",
    onNavigate: fn(),
  },
} satisfies Meta<typeof NavigationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveRoute: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /hub/i })).toHaveAttribute(
      "data-state",
      "active"
    );
    await userEvent.click(canvas.getByRole("button", { name: /garden/i }));
    await expect(args.onNavigate).toHaveBeenCalledWith("/garden");
  },
};

export const TwoSlots: Story = {
  args: {
    slots: slots.slice(0, 2),
    activePath: "/garden",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /garden/i })).toHaveAttribute(
      "data-state",
      "active"
    );
    await expect(canvas.queryByRole("button", { name: /community/i })).not.toBeInTheDocument();
  },
};

/** The phone bar carries a fifth, mobile-only tab. */
const phoneSlots: ToolbarSlot[] = [
  ...slots,
  {
    id: "profile",
    label: "Profile",
    labelId: "cockpit.nav.profile",
    icon: RiUserLine,
    path: "/profile",
    visible: true,
    mobileOnly: true,
  },
];

/** Every phone tab label shows whole, inside its own tab (D16). */
async function expectPhoneLabelsFit(canvasElement: HTMLElement) {
  const items = canvasElement.querySelectorAll<HTMLElement>(
    "[data-slot='mobile'] [data-slot='item']"
  );
  await expect(items).toHaveLength(phoneSlots.length);
  for (const item of items) {
    const label = item.querySelector<HTMLElement>("[data-slot='label']");
    if (!label) throw new Error("A phone tab has no label");
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
    const itemBox = item.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    await expect(labelBox.left).toBeGreaterThanOrEqual(itemBox.left);
    await expect(labelBox.right).toBeLessThanOrEqual(itemBox.right);
  }
}

/** At 360px, the narrowest phone the cockpit supports. */
const phone = {
  globals: { viewport: { value: "mobileSmall" } },
  args: { slots: phoneSlots },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) =>
    expectPhoneLabelsFit(canvasElement),
} satisfies Story;

export const PhoneLabelsEnglish: Story = { ...phone };

export const PhoneLabelsSpanish: Story = {
  ...phone,
  render: (args) => (
    <IntlProvider locale="es" messages={esMessages}>
      <NavigationBar {...args} />
    </IntlProvider>
  ),
};

export const PhoneLabelsPortuguese: Story = {
  ...phone,
  render: (args) => (
    <IntlProvider locale="pt" messages={ptMessages}>
      <NavigationBar {...args} />
    </IntlProvider>
  ),
};
