/**
 * A time limit on each wallet's answer while the App restores a wallet session.
 *
 * wagmi restores one session at a time per config: `reconnect()` returns at once,
 * restoring nothing, while an earlier call is still running, and that call asks
 * each remembered wallet in turn with no time limit. One wallet that never answers
 * therefore holds every later restore of the visit: the App's own retries when it
 * comes back to the front or back online, and AppKit's restore of a WalletConnect
 * session that registers a moment after launch (PRD-1575). The person's own
 * Reconnect still works, since `connect()` has no such lock.
 *
 * Bounding the two calls a restore waits on lets the stuck restore finish: a
 * wallet that has not said whether it is authorized, or has not answered a
 * restoring connect, within the limit counts as not restored, and wagmi moves on
 * to the next wallet and then releases the lock. A connect the person starts is
 * never bounded. The limit leaves room for two stuck calls inside the App's
 * 15-second restore deadline, so a wallet that answers behind a silent one is
 * reached before the App says the wallet did not answer.
 *
 * @module modules/auth/connector-restore-deadline
 */

import type { Config, Connector } from "@wagmi/core";
import { logger } from "../app/logger";

/** How long one wallet may take to answer one restore step. */
export const CONNECTOR_RESTORE_DEADLINE_MS = 5_000;

class ConnectorRestoreTimeoutError extends Error {
  constructor(connectorId: string, step: string) {
    super(`Wallet ${connectorId} did not answer ${step} while restoring`);
    this.name = "ConnectorRestoreTimeoutError";
  }
}

function withinDeadline<T>(
  pending: Promise<T>,
  deadlineMs: number,
  connectorId: string,
  step: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      logger.warn("[wallet restore] A wallet did not answer in time", { connectorId, step });
      reject(new ConnectorRestoreTimeoutError(connectorId, step));
    }, deadlineMs);
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const bounded = new WeakSet<Connector>();

function boundConnector(connector: Connector, deadlineMs: number): void {
  if (bounded.has(connector)) return;
  bounded.add(connector);

  const isAuthorized = connector.isAuthorized;
  connector.isAuthorized = () =>
    withinDeadline(isAuthorized.call(connector), deadlineMs, connector.id, "isAuthorized");

  const connect = connector.connect;
  const boundedConnect = (parameters?: Parameters<Connector["connect"]>[0]) => {
    const pending = connect.call(connector, parameters);
    return parameters?.isReconnecting
      ? withinDeadline(pending, deadlineMs, connector.id, "reconnect")
      : pending;
  };
  connector.connect = boundedConnect as Connector["connect"];
}

/**
 * Bound every wallet the config knows now, and each one it learns of later (an
 * EIP-6963 wallet announced after launch, AppKit's WalletConnect connector).
 * Returns the subscription's removal.
 */
export function boundConnectorRestores(
  config: Config,
  deadlineMs: number = CONNECTOR_RESTORE_DEADLINE_MS
): () => void {
  for (const connector of config.connectors) boundConnector(connector, deadlineMs);
  return config._internal.connectors.subscribe((connectors) => {
    for (const connector of connectors) boundConnector(connector, deadlineMs);
  });
}
