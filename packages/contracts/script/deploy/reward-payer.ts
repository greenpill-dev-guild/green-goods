#!/usr/bin/env bun
import { AbiCoder, Interface, keccak256 } from "ethers";
import { runStandaloneContract } from "../utils/standalone-contract";
import type { StandaloneContract } from "../utils/standalone-deployment";

const PAYER = new Interface([
  "function shareIdOf((uint256 promiseChainId,address promiseModule,uint256 commitmentId,address token,address recipient,uint256 amount) share) pure returns (bytes32)",
]);
/** A fixed share; the payer must hash it exactly as the app and indexer do. */
const PROBE_SHARE = [
  42161n,
  "0x0000000000000000000000000000000000000A11",
  7n,
  "0x0000000000000000000000000000000000000B22",
  "0x0000000000000000000000000000000000000C33",
  1_000_000n,
] as const;
const PROBE_SHARE_ID = keccak256(
  AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256", "address", "address", "uint256"], PROBE_SHARE),
);

/**
 * Pays one share of a promise's reward from the caller's wallet, once. No constructor, owner,
 * roles or immutables, and it holds no funds. Its verified address and CREATE block are promoted
 * to `rewardPayer` and `rewardPayerDeployBlock` in `deployments/<chainId>-latest.json`, where
 * Shared resolves contract addresses and the app starts reading RewardSharePaid logs.
 */
export const REWARD_PAYER: StandaloneContract = {
  noun: "reward payer",
  target: "src/modules/RewardPayer.sol:RewardPayer",
  script: "DeployRewardPayer",
  id: "REWARD_PAYER",
  slug: "reward-payer",
  sources: ["script/deploy/reward-payer.ts", "script/utils/release-artifacts.ts"],
  localhostSigner: "unlocked",
  latest: { address: "rewardPayer", deployBlock: "rewardPayerDeployBlock" },
  async assertAbi(call) {
    const [shareId] = PAYER.decodeFunctionResult(
      "shareIdOf",
      await call(PAYER.encodeFunctionData("shareIdOf", [PROBE_SHARE])),
    );
    if (shareId !== PROBE_SHARE_ID) throw new Error("Deployed reward payer ABI is incompatible");
  },
};

if (import.meta.main) runStandaloneContract(REWARD_PAYER, process.argv.slice(2));
