import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import {
  type SendableTokenBalance,
  useSendableTokens,
} from "@green-goods/shared/hooks/blockchain/useSendableTokens";
import { useSendToken } from "@green-goods/shared/hooks/blockchain/useSendToken";
import { useSendFlowController } from "@green-goods/shared/hooks/client-ui/wallet/useSendFlowController";
import {
  type SelectedRecipient,
  type SendStep,
  validateSendAmount,
} from "@green-goods/shared/modules/wallet/send-flow";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, within } from "storybook/test";
import { SendTab } from "./SendTab";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;

const DAI: SendableTokenBalance = {
  symbol: "DAI",
  label: "DAI",
  address: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as Address,
  decimals: 18,
  confersGovernance: false,
  supported: true,
  balance: 9_354_300_000_000_000_000n,
  errored: false,
};

const RECIPIENT: SelectedRecipient = {
  address: "0xfbaf2a9734eae75497e1695706cc45ddfa346ad6" as Address,
  source: "garden",
  ensName: "together.eth",
  gardenName: "Green Goods Community Garden",
};

type Controller = ReturnType<typeof useSendFlowController>;

function controller({
  step,
  amountInput = "",
  showConfirm = false,
  isSending = false,
  isOnline = true,
}: {
  step: Exclude<SendStep, "recipient">;
  amountInput?: string;
  showConfirm?: boolean;
  isSending?: boolean;
  isOnline?: boolean;
}): Controller {
  const validation = validateSendAmount(DAI, amountInput);
  return {
    mode: "send",
    step,
    recipient: RECIPIENT,
    selectedToken: DAI,
    amountInput,
    note: "",
    showConfirm,
    canAdvance: step === "amount" ? validation.valid : validation.valid && isOnline && !isSending,
    isOnline,
    isSending,
    primaryLabel: step === "amount" ? "Review" : "Send",
    recipientDisplayName: "together.eth",
    validation,
    acts: {
      back: fn(),
      changeAmount: fn(),
      changeNote: fn(),
      closeConfirm: fn(),
      editAmount: fn(),
      editRecipient: fn(),
      executeSend: fn(),
      max: fn(),
      primary: fn(),
      selectMode: fn(),
      selectRecipient: fn(),
      selectToken: fn(),
      startSend: fn(),
    },
  } as unknown as Controller;
}

function withSendFlow(state: Parameters<typeof controller>[0]) {
  return () => {
    mocked(useUser).mockReturnValue({ primaryAddress: ACCOUNT } as ReturnType<typeof useUser>);
    mocked(useCurrentChain).mockReturnValue(42161);
    mocked(useOffline).mockReturnValue({ isOnline: state.isOnline ?? true } as ReturnType<
      typeof useOffline
    >);
    mocked(useSendableTokens).mockReturnValue({
      tokens: [DAI],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: fn(async () => undefined),
    });
    mocked(useSendToken).mockReturnValue({
      isPending: state.isSending ?? false,
      mutate: fn(),
    } as unknown as ReturnType<typeof useSendToken>);
    mocked(useEnsName).mockReturnValue({ data: "together.eth" } as ReturnType<typeof useEnsName>);
    mocked(useSendFlowController).mockReturnValue(controller(state));
    return resetHookMocks(
      useUser,
      useCurrentChain,
      useOffline,
      useSendableTokens,
      useSendToken,
      useEnsName,
      useSendFlowController
    );
  };
}

const bar = () =>
  within(screen.getByText("Back").closest('[data-component="SheetActions"]') as HTMLElement);

/**
 * Sending tokens from the wallet sheet. Each step keeps Back and the next action in one row of
 * the shared bar (DL-016), and Send opens a confirmation. The send flow controller and the wallet
 * reads are mocked per story, so each step renders directly.
 */
const meta: Meta<typeof SendTab> = {
  title: "Client/Sheets/Wallet Send",
  component: SendTab,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <div className="flex h-[717px] flex-col overflow-hidden rounded-t-[var(--radius-2xl)] border border-stroke-soft-200 bg-bg-white-0">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SendTab>;

export const EnterAmount: Story = {
  beforeEach: withSendFlow({ step: "amount" }),
  play: async () => {
    const review = await screen.findByRole("button", { name: "Review" });
    const back = screen.getByRole("button", { name: "Back" });
    await expect(review).toBeDisabled();
    await expect(
      Math.abs(back.getBoundingClientRect().top - review.getBoundingClientRect().top)
    ).toBeLessThanOrEqual(1);
    await expect(bar().getAllByRole("button")).toHaveLength(2);
  },
};

export const ReviewSend: Story = {
  beforeEach: withSendFlow({ step: "review", amountInput: "0.5" }),
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Send" })).toBeEnabled();
    await expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
  },
};

export const ConfirmSend: Story = {
  beforeEach: withSendFlow({ step: "review", amountInput: "0.5", showConfirm: true }),
  play: async () => {
    // A default-tone confirmation is a plain dialog; warning and danger tones use alertdialog.
    const confirm = within(await screen.findByRole("dialog", { name: "Confirm Send" }));
    await expect(confirm.getByText("Send 0.5 DAI to together.eth?")).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeVisible();
  },
};

export const Sending: Story = {
  beforeEach: withSendFlow({ step: "review", amountInput: "0.5", isSending: true }),
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Send" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const Offline: Story = {
  beforeEach: withSendFlow({ step: "review", amountInput: "0.5", isOnline: false }),
  play: async () => {
    await expect(await screen.findByText("You're offline. Reconnect to send.")).toBeVisible();
    await expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  },
};
