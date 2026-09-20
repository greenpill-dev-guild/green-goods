import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSendFlowController } from "../../../../hooks/client-ui/wallet/useSendFlowController";
import type { SendableTokenBalance } from "../../../../hooks/blockchain/useSendableTokens";
import { CELO_G_DOLLAR_TOKEN } from "../../../../config/tokens";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), mutate: vi.fn() }));
vi.mock("../../../../modules/wallet/good-dollar-fees", () => ({
  quoteGoodDollarTransfer: mocks.quote,
}));
vi.mock("../../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: "0x1111111111111111111111111111111111111111" }),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
const recipient = {
  address: "0x2222222222222222222222222222222222222222" as const,
  source: "manual" as const,
};
const token: SendableTokenBalance = {
  ...CELO_G_DOLLAR_TOKEN,
  balance: 100n * 10n ** 18n,
  errored: false,
};
const amount = 10n ** 18n;
const quote = {
  amount,
  fee: amount / 10n,
  senderPays: true,
  totalDebit: (amount * 11n) / 10n,
  recipientAmount: amount,
};
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(
    (props: { isOnline: boolean; canSendCelo: boolean; tokens: SendableTokenBalance[] }) =>
      useSendFlowController({
        ...props,
        sendMutation: { isPending: false, mutate: mocks.mutate },
      }),
    {
      initialProps: { isOnline: true, canSendCelo: true, tokens: [token] },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  );
}
async function fill(result: ReturnType<typeof setup>["result"]) {
  act(() => {
    result.current.acts.startSend(token);
    result.current.acts.selectRecipient(recipient);
    result.current.acts.changeAmount("1");
  });
  await waitFor(() => expect(result.current.feeLoading).toBe(false));
}
describe("useSendFlowController Celo review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quote.mockResolvedValue(quote);
  });
  it("quotes before review, hides unsafe Max, and requires another fresh quote for confirmation", async () => {
    const { result } = setup();
    await fill(result);
    expect(result.current.canMax).toBe(false);
    await act(async () => {
      await result.current.acts.primary();
    });
    expect(result.current.step).toBe("review");
    expect(mocks.quote).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.acts.primary();
    });
    expect(result.current.showConfirm).toBe(true);
    act(() => result.current.acts.executeSend());
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedFee: quote, amount, to: recipient.address }),
      expect.anything()
    );
  });
  it("retains recipient and amount when confirmation is cancelled or wallet rejects", async () => {
    const { result } = setup();
    await fill(result);
    await act(async () => {
      await result.current.acts.primary();
    });
    await act(async () => {
      await result.current.acts.primary();
    });
    act(() => result.current.acts.closeConfirm());
    expect(result.current.showConfirm).toBe(false);
    expect(result.current.recipient).toEqual(recipient);
    expect(result.current.amountInput).toBe("1");
    act(() => result.current.acts.executeSend());
    expect(result.current.amountInput).toBe("1");
  });
  it("blocks offline, disabled delivery, failed quotes and insufficient gross balance", async () => {
    const { result, rerender } = setup();
    await fill(result);
    rerender({ isOnline: false, canSendCelo: true, tokens: [token] });
    expect(result.current.canAdvance).toBe(false);
    rerender({ isOnline: true, canSendCelo: false, tokens: [token] });
    expect(result.current.canAdvance).toBe(false);
    rerender({ isOnline: true, canSendCelo: true, tokens: [{ ...token, balance: amount }] });
    await waitFor(() => expect(result.current.feeInsufficient).toBe(true));
    expect(result.current.canAdvance).toBe(false);
  });
  it("blocks changed fees until the new quote is reviewed", async () => {
    const { result } = setup();
    await fill(result);
    await act(async () => {
      await result.current.acts.primary();
    });
    mocks.quote.mockResolvedValue({ ...quote, fee: 2n, totalDebit: amount + 2n });
    await act(async () => {
      await result.current.acts.primary();
    });
    expect(result.current.showConfirm).toBe(false);
    expect(result.current.feeChanged).toBe(true);
  });
  it("recovers from a quote failure only after a fresh successful quote", async () => {
    mocks.quote.mockRejectedValue(new Error("unavailable"));
    const { result } = setup();
    await fill(result);
    await waitFor(() => expect(result.current.feeError).toBe(true));
    expect(result.current.canAdvance).toBe(false);
    mocks.quote.mockResolvedValue(quote);
    await act(async () => {
      await result.current.retryFee();
    });
    await waitFor(() => expect(result.current.feeError).toBe(false));
    expect(result.current.canAdvance).toBe(true);
  });
});
