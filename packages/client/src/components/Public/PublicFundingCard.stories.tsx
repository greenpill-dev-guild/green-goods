import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import {
  AmountInput,
  InlineErrorBlock,
  LoadingBody,
  SuccessBody,
  TokenPicker,
  UnavailableBody,
} from "./PublicFundingCard";

const messages: Record<string, string> = {
  "public.fund.dialog.donate.title": "Donate",
  "public.fund.dialog.endow.title": "Endow",
  "public.fund.dialog.close": "Close",
  "public.fund.card.title": "{intent} to",
  "public.fund.card.amountLabel": "Amount",
  "public.fund.card.payWithLabel": "Pay with",
  "public.fund.card.tokenSubtitle.dai": "Stablecoin",
  "public.fund.card.tokenSubtitle.weth": "Wrapped Ether",
  "public.fund.card.wethEstimate": "≈ {amount} WETH at {price}/ETH",
  "public.fund.card.wethStale": "Price last updated {minutes} minutes ago",
  "public.fund.card.wethUnavailable":
    "ETH price feed unavailable on this network. Pick DAI or check back later.",
  "public.fund.card.unavailable.donate": "This Garden hasn't enabled donations yet.",
  "public.fund.card.unavailable.endow": "This Garden hasn't enabled endowments yet.",
  "public.fund.card.successDonate": "Donated {amount} to {garden}",
  "public.fund.card.successEndow": "Endowed {amount} to {garden}",
  "public.fund.card.donateAgain": "Donate again",
  "public.fund.card.endowAgain": "Endow again",
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={messages}>
    <div className="min-h-screen bg-editorial-warm p-8">
      <div className="mx-auto w-full max-w-md bg-bg-white-0 p-6 shadow-[var(--shadow-editorial-panel)] sm:p-8">
        {children}
      </div>
    </div>
  </IntlProvider>
);

/* ────────────────────────────────────────────────────────────────────────── */
/* LoadingBody                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const loadingMeta: Meta<typeof LoadingBody> = {
  title: "Public/PublicFundingCard/LoadingBody",
  component: LoadingBody,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
};
export default loadingMeta;
export const Loading: StoryObj<typeof LoadingBody> = { args: {} };

/* ────────────────────────────────────────────────────────────────────────── */
/* UnavailableBody                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export const UnavailableDonate: StoryObj<typeof UnavailableBody> = {
  render: () => (
    <Frame>
      <UnavailableBody isDonate={true} />
    </Frame>
  ),
};
export const UnavailableEndow: StoryObj<typeof UnavailableBody> = {
  render: () => (
    <Frame>
      <UnavailableBody isDonate={false} />
    </Frame>
  ),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* SuccessBody                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const SuccessDonate: StoryObj<typeof SuccessBody> = {
  render: () => (
    <Frame>
      <SuccessBody
        usdInput="20"
        gardenName="Aiyeloja Family Garden"
        isDonate={true}
        onDonateAgain={() => {}}
        onClose={() => {}}
      />
    </Frame>
  ),
};
export const SuccessEndow: StoryObj<typeof SuccessBody> = {
  render: () => (
    <Frame>
      <SuccessBody
        usdInput="100"
        gardenName="Aiyeloja Family Garden"
        isDonate={false}
        onDonateAgain={() => {}}
        onClose={() => {}}
      />
    </Frame>
  ),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* AmountInput                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const AmountInputEmpty: StoryObj<typeof AmountInput> = {
  render: () => (
    <Frame>
      <AmountInput usdInput="" symbol="DAI" onChange={() => {}} disabled={false} />
    </Frame>
  ),
};
export const AmountInputWithValue: StoryObj<typeof AmountInput> = {
  render: () => (
    <Frame>
      <AmountInput usdInput="20.00" symbol="DAI" onChange={() => {}} disabled={false} />
    </Frame>
  ),
};
export const AmountInputWethEstimate: StoryObj<typeof AmountInput> = {
  render: () => (
    <Frame>
      <AmountInput
        usdInput="20.00"
        symbol="WETH"
        onChange={() => {}}
        disabled={false}
        wethSubtitle="≈ 0.005388 WETH at $3,712.50/ETH"
      />
    </Frame>
  ),
};
export const AmountInputWethStale: StoryObj<typeof AmountInput> = {
  render: () => (
    <Frame>
      <AmountInput
        usdInput="20.00"
        symbol="WETH"
        onChange={() => {}}
        disabled={false}
        wethSubtitle="≈ 0.005388 WETH at $3,712.50/ETH"
        wethStaleSubtitle="Price last updated 142 minutes ago"
      />
    </Frame>
  ),
};
export const AmountInputWethUnavailable: StoryObj<typeof AmountInput> = {
  render: () => (
    <Frame>
      <AmountInput
        usdInput="20.00"
        symbol="WETH"
        onChange={() => {}}
        disabled={false}
        wethUnavailable={true}
      />
    </Frame>
  ),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* TokenPicker                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const SAMPLE_OPTIONS = [
  {
    symbol: "DAI",
    assetAddress: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1" as `0x${string}`,
    decimals: 18,
    destinationAddress: "0x0" as `0x${string}`,
  },
  {
    symbol: "WETH",
    assetAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" as `0x${string}`,
    decimals: 18,
    destinationAddress: "0x0" as `0x${string}`,
  },
];

export const TokenPickerDaiSelected: StoryObj<typeof TokenPicker> = {
  render: () => (
    <Frame>
      <TokenPicker
        options={SAMPLE_OPTIONS}
        selectedAddress={SAMPLE_OPTIONS[0].assetAddress}
        onSelect={() => {}}
        disabled={false}
      />
    </Frame>
  ),
};
export const TokenPickerWethSelected: StoryObj<typeof TokenPicker> = {
  render: () => (
    <Frame>
      <TokenPicker
        options={SAMPLE_OPTIONS}
        selectedAddress={SAMPLE_OPTIONS[1].assetAddress}
        onSelect={() => {}}
        disabled={false}
      />
    </Frame>
  ),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* InlineErrorBlock                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const ErrorUserRejected: StoryObj<typeof InlineErrorBlock> = {
  render: () => (
    <Frame>
      <InlineErrorBlock title="Transaction cancelled" message="You dismissed the wallet prompt." />
    </Frame>
  ),
};
export const ErrorGenericFailure: StoryObj<typeof InlineErrorBlock> = {
  render: () => (
    <Frame>
      <InlineErrorBlock
        title="Transaction failed"
        message="execution reverted: ERC20: insufficient allowance"
      />
    </Frame>
  ),
};
