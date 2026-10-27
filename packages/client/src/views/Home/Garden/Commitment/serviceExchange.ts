import {
  type ServiceAccessAction,
  type ServiceAccessSnapshot,
  type ServiceAsset,
  selectServiceAccessAction,
  type VoucherIssuer,
} from "@green-goods/shared/commitment-pooling";
import type { ServiceExchangeQuote, ServiceExchangeState } from "./ServiceExchangeSheet";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The exchange the rehearsal's pool quoted, in the sheet's terms. Only the DEV rehearsal quotes
 * today: the live pool is not configured before the deployment is adopted, so there is no quote
 * and the offer's door to exchange stays closed.
 */
export function exchangeQuoteFromPilot(
  snapshot: ServiceAccessSnapshot,
  issuers: readonly VoucherIssuer[],
  holdings: readonly { issuer: VoucherIssuer; available: bigint }[]
): ServiceExchangeQuote | null {
  const pilot = snapshot.pilot;
  const quote = pilot?.exchange.quote;
  if (!pilot || !quote) return null;
  const assets = [pilot.assets.a, pilot.assets.b];
  const side = (token: string, amount: bigint) => {
    const asset = assets.find((entry) => same(entry.token, token)) as ServiceAsset;
    const issuer = issuers.find((entry) => same(entry.asset.token, token));
    return {
      amount,
      asset,
      issuer: issuer ?? { name: asset.symbol ?? "", gender: null },
    };
  };
  return {
    input: side(quote.inputToken, quote.input),
    output: side(quote.outputToken, quote.netOutput),
    gross: quote.grossOutput,
    poolFee: quote.poolFee,
    protocolFee: quote.protocolFee,
    minimum: quote.minimumOutput,
    deadline: Number(quote.deadline),
    held:
      holdings.find((holding) => same(holding.issuer.asset.token, quote.inputToken))?.available ??
      0n,
    available: pilot.exchange.inventory,
  };
}

/** Whether Exchange Vouchers leads anywhere: a quote to show, or one the pool can make now. */
export function exchangeAvailable(snapshot: ServiceAccessSnapshot): boolean {
  return (
    Boolean(snapshot.pilot?.exchange.quote) ||
    selectServiceAccessAction(snapshot, { action: "quotePilotExchange" }).allowed
  );
}

/**
 * Where the rehearsal's exchange stands, read from its pool record rather than kept here. A quote
 * past its time or its minimum expired; an approval or a transfer that failed is its own answer.
 */
export function exchangeStateFromPilot(
  snapshot: ServiceAccessSnapshot,
  reviewing: boolean
): ServiceExchangeState {
  const exchange = snapshot.pilot?.exchange;
  if (!exchange) return "quote";
  if (exchange.status === "unknown") return "waiting";
  if (exchange.status === "confirmed") return "done";
  if (exchange.status === "failed")
    return exchange.failure === "inventory"
      ? "short"
      : exchange.failure === "limit"
        ? "limit"
        : exchange.failure === "listing"
          ? "listed"
          : exchange.failure === "deadline" || exchange.failure === "minimum"
            ? "expired"
            : "failed";
  return reviewing ? "review" : "quote";
}

/**
 * What a short pool can still exchange: the input whose output before fees fits what the pool
 * has left, at the failed quote's own rate. Null when there is nothing smaller to ask for.
 */
export function smallerExchangeInput(snapshot: ServiceAccessSnapshot | null): bigint | null {
  const exchange = snapshot?.pilot?.exchange;
  const quote = exchange?.quote;
  if (exchange?.status !== "failed" || exchange.failure !== "inventory" || !quote) return null;
  if (quote.grossOutput <= 0n) return null;
  const input = (quote.input * exchange.inventory) / quote.grossOutput;
  return input > 0n && input < quote.input ? input : null;
}

/** One exchange: allow exactly its input, then the pool's bounded swap; the quote is reviewed. */
export function exchangeStep(snapshot: ServiceAccessSnapshot): ServiceAccessAction | null {
  const exchange = snapshot.pilot?.exchange;
  const quote = exchange?.quote;
  if (!exchange || exchange.status !== "quoted" || !quote) return null;
  if (exchange.allowance < quote.input)
    return { action: "approvePilotExchange", expectedQuoteId: quote.id };
  return { action: "executePilotExchange", quote };
}
