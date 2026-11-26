import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { createConfig, http, mock, WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { withSignedOutAuth } from "../../../shared/.storybook/decorators";
import OpenfortSignIn from "@green-goods/shared/providers/OpenfortSignIn";

const wallet = mock({ accounts: ["0x0000000000000000000000000000000000000001"] });
const config = createConfig({
  chains: [sepolia],
  connectors: [
    { id: "io.rabby", name: "Rabby" },
    { id: "me.rainbow", name: "Rainbow" },
    { id: "io.metamask", name: "MetaMask" },
  ].map(({ id, name }) => (config) => ({ ...wallet(config), id, name })),
  transports: { [sepolia.id]: http() },
  multiInjectedProviderDiscovery: false,
});

const meta = {
  title: "Admin/Identity/AdminOpenfortSignIn",
  component: OpenfortSignIn,
  decorators: [
    withSignedOutAuth,
    (Story) => (
      <WagmiProvider config={config} reconnectOnMount={false}>
        <Story />
      </WagmiProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    keys: {
      publishableKey: "pk_test_11111111111111111111111111111111",
      shieldPublishableKey: "pk_test_11111111111111111111111111111111",
    },
    appName: "Green Goods Hub",
    screen: "providers",
    onFinish: fn(),
  },
} satisfies Meta<typeof OpenfortSignIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileChoices: Story = {
  tags: ["storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByPlaceholderText("your@email.com", {}, { timeout: 15_000 })
    ).toBeVisible();
    await expect(
      await page.findByRole("button", { name: "Connect your wallet" }, { timeout: 10_000 })
    ).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Close" }));
    await expect(args.onFinish).toHaveBeenCalledWith("dismissed");
  },
};

export const MobileWallets: Story = {
  tags: ["storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("button", { name: "Connect your wallet" }));
    const wallets = await page.findAllByRole("button", {
      name: /^(Rabby|Rainbow|MetaMask)( Wallet)?$/,
    });
    await expect(
      wallets.map((wallet) => wallet.textContent?.trim().replace(/ Wallet$/, ""))
    ).toEqual(["Rabby", "Rainbow", "MetaMask"]);
    await expect(page.queryByRole("button", { name: /Other Wallets/i })).toBeNull();
  },
};
