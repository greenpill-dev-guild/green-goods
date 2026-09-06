import type { SmartAccountClient } from "permissionless";
import type { P256Credential } from "viem/account-abstraction";
import type { SmartAccountClientResolver } from "../../types/auth";
import type { Address } from "../../types/domain";

export class SmartAccountClientError extends Error {
  constructor(
    readonly code:
      | "session_expired"
      | "chain_mismatch"
      | "address_mismatch"
      | "resolver_unavailable"
      | "policy_unavailable"
  ) {
    super(`Smart account unavailable: ${code}`);
    this.name = "SmartAccountClientError";
  }
}

const sessions = new WeakMap<SmartAccountClientResolver, { active: boolean; clear: () => void }>();

export function assertSmartAccountClientResolverActive(
  resolve: SmartAccountClientResolver | null | undefined
): void {
  if (resolve && sessions.get(resolve)?.active === false) {
    throw new SmartAccountClientError("session_expired");
  }
}

export function invalidateSmartAccountClientResolver(
  resolve: SmartAccountClientResolver | null | undefined
): void {
  const session = resolve ? sessions.get(resolve) : undefined;
  if (session) {
    session.active = false;
    session.clear();
  }
}

export function assertSmartAccountClient(
  client: SmartAccountClient,
  chainId: number,
  expectedAddress: Address
): void {
  if (client.chain?.id !== chainId) throw new SmartAccountClientError("chain_mismatch");
  if (!client.account || client.account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new SmartAccountClientError("address_mismatch");
  }
}

/** A credential never leaves this session; discarded capabilities fail even after their build finishes. */
export function createSmartAccountClientResolver(input: {
  credential: P256Credential;
  primaryClient: SmartAccountClient;
  primaryChainId: number;
  expectedAddress: Address;
  buildSmartAccount: (
    credential: P256Credential,
    chainId: number
  ) => Promise<{ client: SmartAccountClient; address: Address }>;
}): SmartAccountClientResolver {
  const clients = new Map<number, Promise<SmartAccountClient>>([
    [input.primaryChainId, Promise.resolve(input.primaryClient)],
  ]);

  const resolve: SmartAccountClientResolver = async (chainId) => {
    assertSmartAccountClientResolverActive(resolve);
    let pending = clients.get(chainId);
    if (!pending) {
      pending = Promise.resolve().then(async () => {
        assertSmartAccountClientResolverActive(resolve);
        const { client, address } = await input.buildSmartAccount(input.credential, chainId);
        if (address.toLowerCase() !== input.expectedAddress.toLowerCase()) {
          throw new SmartAccountClientError("address_mismatch");
        }
        return client;
      });
      clients.set(chainId, pending);
    }
    try {
      const client = await pending;
      assertSmartAccountClientResolverActive(resolve);
      assertSmartAccountClient(client, chainId, input.expectedAddress);
      return client;
    } catch (error) {
      if (clients.get(chainId) === pending) clients.delete(chainId);
      throw error;
    }
  };
  sessions.set(resolve, { active: true, clear: () => clients.clear() });
  return resolve;
}
