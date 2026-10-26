import type {
  ServiceAccessAction,
  ServiceAccessSnapshot,
  ServiceAsset,
  VoucherIssuer,
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

/** Where the rehearsal's exchange stands, read from its pool record rather than kept here. */
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
          : "expired";
  return reviewing ? "review" : "quote";
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
