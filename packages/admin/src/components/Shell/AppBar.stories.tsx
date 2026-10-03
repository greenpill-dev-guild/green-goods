import type { WalletNetworkNoticeState } from "@green-goods/shared/hooks/blockchain/useWalletNetworkNotice";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import {
  RefreshActionProvider,
  useRefreshAction,
} from "@green-goods/shared/components/Canvas/RefreshActionContext";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { AppBar } from "./AppBar";

const gardens = [
  { id: "g1", name: "Rio Claro Community Garden" },
  { id: "g2", name: "Jardim Botafogo" },
];

const gardenChipElement = (
  <GardenChip
    gardens={gardens}
    selectedGarden={gardens[0]}
    onSelectGarden={fn()}
    onCreateGarden={fn()}
  />
);

const meta = {
  title: "Admin/Shell/AppBar",
  component: AppBar,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin fork of the Canvas AppBar (Cockpit M3, finished). 56px transparent bar over the canvas wash: garden switcher pill on the left, 40px round icon buttons with the neutral ink state-layer hover on the right, closing with the 28px profile avatar circle.",
      },
    },
  },
  decorators: [withCanvasFrame({ heightClassName: "min-h-[240px]", workspace: "hub" })],
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenSettings: fn(),
    onOpenNotifications: fn(),
    onOpenProfile: fn(),
  },
} satisfies Meta<typeof AppBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /notifications/i }));
    await expect(args.onOpenNotifications).toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: /profile/i })).toBeInTheDocument();
  },
};

export const SheetContext: Story = {
  args: {
    sheetContext: { label: "Composting rotation — north beds", onBack: fn() },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Composting rotation — north beds")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /back/i })).toBeInTheDocument();
  },
};

/** What the network hook hands over while a wallet is left on Celo and the app acts on Arbitrum One. */
function walletOnCelo(overrides: Partial<WalletNetworkNoticeState> = {}): WalletNetworkNoticeState {
  return {
    message: "Wallet on Celo",
    switchLabel: "Switch to Arbitrum One",
    isSwitching: false,
    switchNetwork: fn(async () => {}),
    ...overrides,
  };
}

/** A wallet on another network: the switch leads the actions, and the icons after it keep their places. */
export const WalletOnAnotherNetwork: Story = {
  args: { walletNetwork: walletOnCelo() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("button", { name: "Wallet on Celo. Switch to Arbitrum One" });
    await expect(control).toHaveTextContent("Switch to Arbitrum One");
    await userEvent.click(control);
    await expect(args.walletNetwork?.switchNetwork).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("button", { name: /notifications/i })).toBeVisible();
  },
};

/** While the wallet is asked, the control is busy and a second tap asks nothing more. */
export const WalletNetworkSwitching: Story = {
  args: { walletNetwork: walletOnCelo({ isSwitching: true }) },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole("button", { name: /switch to arbitrum one/i });
    await expect(control).toHaveAttribute("aria-busy", "true");
    await userEvent.click(control);
    await expect(args.walletNetwork?.switchNetwork).not.toHaveBeenCalled();
  },
};

const longNamedGardens = [
  { id: "g1", name: "Green Goods Community Garden" },
  { id: "g2", name: "TAS HUB" },
];

function WithRefresh({ children }: { children: ReactNode }) {
  useRefreshAction({ onRefresh: () => {} });
  return <>{children}</>;
}

/** On a phone the chip ends before the refresh and bell and truncates a long
 *  garden name, rather than running under them (D16). Mobile passes no search,
 *  settings, or profile action; those live in the Profile tab. */
export const PhoneLongGardenName: Story = {
  globals: { viewport: { value: "mobile" } },
  args: {
    gardenChip: (
      <GardenChip
        gardens={longNamedGardens}
        selectedGarden={longNamedGardens[0]}
        onSelectGarden={fn()}
        onCreateGarden={fn()}
      />
    ),
    onOpenSearch: undefined,
    onOpenSettings: undefined,
    onOpenProfile: undefined,
  },
  render: (args) => (
    <RefreshActionProvider>
      <WithRefresh>
        <AppBar {...args} />
      </WithRefresh>
    </RefreshActionProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /refresh/i })).toBeVisible();
    const chip = canvasElement.querySelector<HTMLElement>("[data-component='GardenChip']");
    const actions = canvasElement.querySelector<HTMLElement>("[data-slot='actions']");
    if (!chip || !actions) throw new Error("The app bar lost its chip or actions");
    await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
      actions.getBoundingClientRect().left
    );
  },
};

/** On a phone the switch is one more 40px icon. The chip still ends before the
 *  actions, and the longest wording stays in the control's name. */
export const PhoneWalletOnAnotherNetwork: Story = {
  ...PhoneLongGardenName,
  args: {
    ...PhoneLongGardenName.args,
    walletNetwork: walletOnCelo({ message: "Wallet still on another network" }),
  },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole("button", {
      name: "Wallet still on another network. Switch to Arbitrum One",
    });
    await expect(control.getBoundingClientRect().width).toBe(40);
    const chip = canvasElement.querySelector<HTMLElement>("[data-component='GardenChip']");
    const actions = canvasElement.querySelector<HTMLElement>("[data-slot='actions']");
    if (!chip || !actions) throw new Error("The app bar lost its chip or actions");
    await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
      actions.getBoundingClientRect().left
    );
  },
};
