import record from "@green-goods/contracts/deployments/100-aiyeloja-test-pool.json";
import type { Address, Hex } from "viem";

type ProxyComponent = "index" | "limiter" | "quoter" | "feePolicy" | "protocolFee" | "pool";
type VoucherId = "garden" | "member-a" | "member-b";

interface DeployedProxy {
  address: Address;
  receipt: { transactionHash: Hex; blockNumber: bigint; blockHash: Hex };
}

function pin(component: string): DeployedProxy {
  const entry = record.contracts.find((contract) => contract.component === component);
  if (!entry) throw new Error(`Aiyeloja test pool record has no ${component}`);
  const { transactionHash, blockNumber, blockHash } = entry.receipt;
  return {
    address: entry.address as Address,
    receipt: {
      transactionHash: transactionHash as Hex,
      blockNumber: BigInt(blockNumber),
      blockHash: blockHash as Hex,
    },
  };
}

const proxies: readonly ProxyComponent[] = [
  "index",
  "limiter",
  "quoter",
  "feePolicy",
  "protocolFee",
  "pool",
];
const vouchers: readonly VoucherId[] = ["garden", "member-a", "member-b"];

/**
 * The Aiyeloja Family Garden's test exchange pool on Gnosis (PRD-1481), for test and QA
 * harnesses only. No App or Hub surface reads it, and none of its vouchers is listed in the
 * Green Goods or Tech and Sun pools. Any one of the test Safe's six owners can act for it, so it
 * only ever holds test value.
 *
 * Projected from `@green-goods/contracts/deployments/100-aiyeloja-test-pool.json`, whose
 * addresses the contracts release test checks against the release tooling's CREATE2 plan.
 */
export const AIYELOJA_TEST_POOL = {
  chainId: 100,
  garden: record.garden as Address,
  safe: record.safe as Address,
  automation: record.automation as Address,
  contracts: Object.fromEntries(proxies.map((component) => [component, pin(component)])) as Record<
    ProxyComponent,
    DeployedProxy
  >,
  vouchers: Object.fromEntries(vouchers.map((id) => [id, pin(`fixture:${id}`)])) as Record<
    VoucherId,
    DeployedProxy
  >,
} as const;
