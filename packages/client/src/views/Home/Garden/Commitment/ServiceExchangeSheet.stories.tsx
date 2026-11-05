import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  type ServiceExchangeQuote,
  ServiceExchangeSheet,
  type ServiceExchangeState,
} from "./ServiceExchangeSheet";

type Lang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;

const asset = (token: `0x${string}`, symbol: string) => ({
  chainId: 100,
  token,
  symbol,
  decimals: 6,
});

/**
 * Maya exchanges 2 of the 6 coaching vouchers she issued for 1 of Teo's lesson vouchers, at the
 * rate their offers agree (2:1), with no pool fee proposed. Fictional people, from the design lab.
 */
const MAYA_TO_TEO: ServiceExchangeQuote = {
  input: {
    amount: 2_000_000n,
    asset: asset("0x000000000000000000000000000000000000a701", "MAYA"),
    issuer: { name: "Maya Ruiz", gender: "feminine", kind: "individual" },
    own: true,
  },
  output: {
    amount: 1_000_000n,
    asset: asset("0x000000000000000000000000000000000000a702", "TEO"),
    issuer: { name: "Teo Alves", gender: "masculine", kind: "individual" },
  },
  gross: 1_000_000n,
  poolFee: 0n,
  protocolFee: 0n,
  minimum: 1_000_000n,
  deadline: Date.UTC(2026, 9, 26, 14, 5) / 1000,
  held: 6_000_000n,
  available: 2_000_000n,
  settledAt: Date.UTC(2026, 9, 26, 14, 3) / 1000,
};

function MemberExchange({ state, lang }: { state: ServiceExchangeState; lang: Lang }) {
  return (
    <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
      <ServiceExchangeSheet
        open
        onOpenChange={fn()}
        quote={MAYA_TO_TEO}
        state={state}
        isPending={false}
        onReview={fn()}
        onExchange={fn()}
        onCheck={fn()}
        onRequote={fn()}
        onSmaller={null}
        onBack={fn()}
      />
    </IntlProvider>
  );
}

/**
 * Exchange Vouchers between two members' vouchers (PRD-1299 SExchange, slice 2): the rate their
 * offers agree rather than the pilot's 1:1, zero pool fees proposed, and a note when the vouchers
 * spent are the reader's own. The sheet opens over the lesson's promise page; pick the language
 * with `lang`.
 */
const meta: Meta<typeof MemberExchange> = {
  title: "Client/Commitments/ServiceExchangeSheet",
  component: MemberExchange,
  tags: ["storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  argTypes: {
    state: { control: false },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { lang: "en" },
};
export default meta;
type Story = StoryObj<typeof MemberExchange>;

/** The sheet, wherever its dialog renders, and the catalog of the language picked. */
function sheetOf(canvasElement: HTMLElement, lang: Lang) {
  const sheet = within(canvasElement.ownerDocument.body);
  const words = MESSAGES[lang] as Record<string, string>;
  return { sheet, say: (id: string) => words[`app.voucher.${id}`]! };
}

/** Maya spends her own vouchers: the quote says so, with the agreed rate and the fee proposal. */
export const MayaToTeoQuote: Story = {
  args: { state: "quote" },
  play: async ({ canvasElement, args }) => {
    const { sheet, say } = sheetOf(canvasElement, args.lang);
    await expect(await sheet.findByText(say("ex.n.own.t"))).toBeVisible();
    await expect(sheet.getByText(say("ex.n.own.b"))).toBeVisible();
    await expect(sheet.getByText(say("ex.f.rateS"))).toBeVisible();
    await expect(sheet.getByText(say("ex.f.feesZero"))).toBeVisible();
    await expect(sheet.queryByText(say("ex.f.rateSH"))).toBeNull();
  },
};

/** The review before her passkey asks: what she spends, at least what she gets, and the fees. */
export const MayaToTeoReview: Story = {
  args: { state: "review" },
  play: async ({ canvasElement, args }) => {
    const { sheet, say } = sheetOf(canvasElement, args.lang);
    await waitFor(() => expect(sheet.getByText(say("ex.sh.title"))).toBeVisible());
    await expect(sheet.getByText(say("ex.f.feesZero"))).toBeVisible();
    await expect(sheet.getByRole("button", { name: say("ex.sh.cta") })).toBeEnabled();
    await userEvent.click(sheet.getByText(say("c.tech")));
    await expect(sheet.getByText(/Gnosis/)).toBeVisible();
  },
};

/** Done: the receipt for 1 Teo voucher, which books nothing until she redeems it. */
export const MayaToTeoDone: Story = {
  args: { state: "done" },
  play: async ({ canvasElement, args }) => {
    const { sheet, say } = sheetOf(canvasElement, args.lang);
    await expect(await sheet.findByText(say("ex.n.done.t"))).toBeVisible();
    await expect(sheet.getByText(say("ex.rc.title"))).toBeVisible();
    await expect(sheet.queryByText(say("ex.n.own.t"))).toBeNull();
  },
};

/** The pool already holds as many of Maya's vouchers as its limit allows: nothing moved. */
export const MayaToTeoLimitReached: Story = {
  args: { state: "limit" },
  play: async ({ canvasElement, args }) => {
    const { sheet, say } = sheetOf(canvasElement, args.lang);
    await expect(await sheet.findByText(say("ex.n.limit.b"))).toBeVisible();
    await expect(sheet.getByRole("button", { name: say("ex.a.back2") })).toBeVisible();
    await expect(sheet.queryByRole("button", { name: say("ex.a.review") })).toBeNull();
  },
};
