import { track } from "./posthog";

/** Why the app asked a wallet to change network: before a write, on its retry, or when its connection came up. */
export type WalletNetworkSwitchReason = "write" | "retry" | "sign-in";

/**
 * How a requested network switch ended. `pending`: a switch is already waiting
 * in the wallet. `unconfirmed`: the request resolved but the wallet still
 * reports another network.
 */
export type WalletNetworkSwitchOutcome =
  | "switched"
  | "rejected"
  | "pending"
  | "unknown_network"
  | "unconfirmed"
  | "failed";

export interface WalletNetworkSwitchEvent {
  reason: WalletNetworkSwitchReason;
  outcome: WalletNetworkSwitchOutcome;
  fromChainId?: number;
  toChainId: number;
  connectorType?: string;
  /** Which switch moved the wallet, or was refused. */
  via?: "appkit" | "wagmi";
}

/** Records one requested switch as aggregate wallet health, without the address or the session. */
export function trackWalletNetworkSwitch(event: WalletNetworkSwitchEvent): void {
  track(
    "wallet_network_switch",
    {
      reason: event.reason,
      outcome: event.outcome,
      from_chain_id: event.fromChainId,
      to_chain_id: event.toChainId,
      connector_type: event.connectorType,
      via: event.via,
    },
    { anonymizeIdentity: true, includeSessionId: false }
  );
}
