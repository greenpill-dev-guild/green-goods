import assert from "node:assert/strict";
import { AbiCoder, getAddress, Interface, ZeroAddress } from "ethers";

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

const ERROR_STRING = "0x08c379a0";
/** OpenZeppelin 5's `ERC721NonexistentToken(uint256)`, in case the garden token moves to it. */
const NONEXISTENT_TOKEN = "0x7e273289";

/**
 * Whether an `ownerOf` failure is the garden token's own refusal of an unminted id. ethers reports every
 * JSON-RPC error on `eth_call` as CALL_EXCEPTION, a node that cannot serve the block included, so only
 * the token's revert data ends discovery; anything else must stop the plan rather than drop gardens.
 */
export function isUnmintedGardenToken(error: unknown): boolean {
  const data = (error as { data?: unknown } | null)?.data;
  if (typeof data !== "string" || !/^0x[0-9a-fA-F]{8}/.test(data)) return false;
  const selector = data.slice(0, 10).toLowerCase();
  if (selector === NONEXISTENT_TOKEN) return true;
  if (selector !== ERROR_STRING) return false;
  try {
    const [reason] = AbiCoder.defaultAbiCoder().decode(["string"], `0x${data.slice(10)}`);
    return reason === "ERC721: invalid token ID";
  } catch {
    return false;
  }
}
