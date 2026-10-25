import { keccak256, type JsonRpcProvider } from "ethers";
import type { CLCMemberPlan } from "./clc-member-release";

type ReadClient = Pick<JsonRpcProvider, "getTransaction" | "getTransactionReceipt" | "getBlock" | "getCode">;
export interface CLCAdoptionReceipts {
  transactions: Record<string, string>;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`CLC member ${label} mismatch`);
}
/** Only a contiguous, exact canonical receipt prefix may be adopted. Existing code alone is insufficient. */
export async function verifyCLCAdoptionPrefix(
  client: ReadClient,
  plan: CLCMemberPlan,
  input: unknown = { transactions: {} },
) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).join() !== "transactions")
    throw new Error("Invalid CLC adoption receipts");
  const receipts = (input as CLCAdoptionReceipts).transactions;
  if (!receipts || typeof receipts !== "object" || Array.isArray(receipts))
    throw new Error("Invalid CLC adoption transactions");
  const components = new Set(plan.transactions.map((tx) => tx.component));
  if (Object.keys(receipts).some((key) => !components.has(key as never)))
    throw new Error("Unknown CLC adoption component");
  if (Object.values(receipts).some((hash) => typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)))
    throw new Error("Invalid CLC adoption transaction hash");
  const adopted: Array<{
    component: string;
    address: string;
    transactionHash: string;
    runtimeHash: string;
    adopted: true;
  }> = [];
  let gap = false;
  for (const expected of plan.transactions) {
    const hash = receipts[expected.component];
    const code = await client.getCode(expected.address);
    if (!hash) {
      gap = true;
      if (code !== "0x") throw new Error("Existing CLC deployment requires its exact canonical receipt");
      continue;
    }
    if (gap) throw new Error("CLC adoption must be a contiguous deployment prefix");
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
      throw new Error("Invalid CLC adoption transaction hash");
    const tx = await client.getTransaction(hash);
    const receipt = await client.getTransactionReceipt(hash);
    if (!tx || !receipt || receipt.status !== 1 || code === "0x")
      throw new Error("CLC adoption receipt missing or unsuccessful");
    if (
      !Number.isSafeInteger(receipt.blockNumber) ||
      receipt.blockNumber < 0 ||
      !/^0x[0-9a-fA-F]{64}$/.test(receipt.blockHash)
    )
      throw new Error("Invalid canonical CLC receipt block");
    equal(tx.hash, hash, "adopted transaction hash");
    equal(receipt.hash, hash, "adopted receipt hash");
    equal(receipt.from, expected.from, "adopted receipt sender");
    equal(receipt.to, expected.to, "adopted receipt target");
    equal(tx.chainId, 100, "adopted chain");
    equal(tx.from, expected.from, "adopted sender");
    equal(tx.to, expected.to, "adopted target");
    equal(tx.nonce, expected.nonce, "adopted nonce");
    equal(tx.value, 0, "adopted value");
    equal(tx.data, expected.data, "adopted calldata");
    equal(tx.blockNumber, receipt.blockNumber, "adopted block number");
    equal(tx.blockHash, receipt.blockHash, "adopted transaction block");
    equal(receipt.contractAddress, expected.to === null ? expected.address : null, "adopted CREATE address");
    const block = await client.getBlock(receipt.blockNumber);
    equal(block?.hash, receipt.blockHash, "canonical adopted block");
    adopted.push({
      component: expected.component,
      address: expected.address,
      transactionHash: hash,
      runtimeHash: keccak256(code),
      adopted: true,
    });
  }
  return adopted;
}
