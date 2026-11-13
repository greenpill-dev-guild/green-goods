import assert from "node:assert/strict";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { arbitrum } from "viem/chains";

// PRD-937: production module ownership is already behind this controller.
export const LOCAL_GOVERNANCE_MANAGER: Address = "0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66";
const SAFE: Address = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const RPC = "http://127.0.0.1:3009";
const abi = parseAbi([
  "function canCall(address,address,bytes4) view returns(bool,uint32)",
  "function schedule(address,bytes,uint48) returns(bytes32,uint32)",
  "function execute(address,bytes) payable returns(uint32)",
]);

/** Test-only: the surrounding integration owns the impersonation and restores its snapshot. */
export async function sendLocalGovernanceCall(target: Address, data: Hex, signal: AbortSignal) {
  signal.throwIfAborted();
  const publicClient = createPublicClient({ chain: arbitrum, transport: http(RPC) });
  const wallet = createWalletClient({ account: SAFE, chain: arbitrum, transport: http(RPC) });
  const test = createTestClient({ mode: "anvil", chain: arbitrum, transport: http(RPC) });
  const [immediate, delay] = await publicClient.readContract({
    address: LOCAL_GOVERNANCE_MANAGER,
    abi,
    functionName: "canCall",
    args: [SAFE, target, data.slice(0, 10) as Hex],
  });
  assert(immediate || delay > 0, "Safe lacks governance authorization for this selector");
  if (!immediate) {
    const hash = await wallet.writeContract({
      address: LOCAL_GOVERNANCE_MANAGER,
      abi,
      functionName: "schedule",
      args: [target, data, 0],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
    assert.equal(receipt.status, "success", "governance schedule reverted");
    const scheduledBlock = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    await test.setNextBlockTimestamp({ timestamp: scheduledBlock.timestamp + BigInt(delay) });
    await test.mine({ blocks: 1 });
  }
  signal.throwIfAborted();
  const hash = await wallet.writeContract({
    address: LOCAL_GOVERNANCE_MANAGER,
    abi,
    functionName: "execute",
    args: [target, data],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  assert.equal(receipt.status, "success", "governance execution reverted");
  return receipt;
}
