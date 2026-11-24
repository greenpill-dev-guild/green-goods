import assert from "node:assert/strict";
import { getAddress, Interface, ZeroAddress } from "ethers";

export interface GardenSyncState {
  garden: string;
  community: string;
  powerRegistry: string;
  registeredStrategies: string[];
  pools: {
    address: string;
    community: string;
    powerRegistry: string;
    council: string;
    authorized: boolean;
  }[];
}

const calls = new Interface(["function setAuthorizedSyncCaller(address caller,bool authorized)"]);
const address = (value: string) => {
  const result = getAddress(value);
  assert.notEqual(result, ZeroAddress, "missing conviction-sync address");
  return result;
};

/** Validate both sides of the integration before granting the module any authority. */
export function convictionSyncCalls(state: GardenSyncState, hatsModule: string, safe: string) {
  address(state.garden);
  const module = address(hatsModule);
  const council = address(safe);
  const community = address(state.community);
  const registry = address(state.powerRegistry);
  assert.equal(state.pools.length, 2, "garden must have two signal pools");
  const pools = state.pools.map((pool) => address(pool.address));
  assert.equal(new Set(pools).size, 2, "duplicate signal pool");
  assert.deepEqual(
    state.registeredStrategies.map(address).sort(),
    [...pools].sort(),
    "Hats strategies do not match garden signal pools",
  );
  for (const pool of state.pools) {
    assert.equal(address(pool.community), community, "pool community mismatch");
    assert.equal(address(pool.powerRegistry), registry, "pool voting power registry mismatch");
    assert.equal(address(pool.council), council, "pool council must be the reviewed Safe");
  }
  return state.pools
    .filter((pool) => !pool.authorized)
    .map((pool) => ({
      to: address(pool.address),
      value: "0",
      data: calls.encodeFunctionData("setAuthorizedSyncCaller", [module, true]),
    }));
}

export function requireConvictionSyncReady(state: GardenSyncState, hatsModule: string, safe: string) {
  assert.equal(convictionSyncCalls(state, hatsModule, safe).length, 0, "pool sync authorization is pending");
}

/**
 * A garden token can have an account of each kind (anyone can deploy the other one), so the garden is the
 * account the Hats module configured, and exactly one must be.
 */
export function configuredGardenAccount(
  tokenId: number,
  candidates: readonly { account: string; configured: boolean }[],
): string {
  const configured = candidates.filter((candidate) => candidate.configured);
  assert.equal(configured.length, 1, `exactly one account must be configured for garden token ${tokenId}`);
  return address(configured[0].account);
}
