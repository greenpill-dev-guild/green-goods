import type { createProviderProofRegistry } from "@green-goods/shared/public-contracts";
import type { FundingIntentStore } from "../../services/funding-intents";
import type { ServerDeps } from "../http/server.types";
import type { ThirdwebCheckoutClient } from "./thirdweb";

export interface FundingRouteContext {
  deps: ServerDeps;
  fundingIntents: FundingIntentStore;
  providerProofRegistry: ReturnType<typeof createProviderProofRegistry>;
  now: () => number;
  thirdwebCheckout?: ThirdwebCheckoutClient;
  confirmationDeps: Pick<
    ServerDeps,
    "confirmFundingTransaction" | "confirmFundingTuple" | "readVaultShareBalance"
  >;
}
