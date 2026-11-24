import { toHex } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  CHAIN_ID,
  LAUNCH_BLOCK,
  PILOT_ROOT_NONCE_KEY,
  currentIdentity,
  identity,
  type ProofInput,
} from "./pilot-account-proof-account";
import {
  USER_OPERATION_TOPIC,
  operationEvent,
  receiptProof,
  type PilotAccountProof,
} from "./pilot-account-proof-receipt";
import { equal, hex, object, quantity } from "./pilot-account-proof-rpc";

export {
  PILOT_PROOF_CALL_ABI,
  PILOT_ROOT_NONCE_KEY,
  getPilotProofExecutionCallData,
} from "./pilot-account-proof-account";
export { PilotProofExecutionFailedError } from "./pilot-account-proof-receipt";
export type { PilotAccountProof } from "./pilot-account-proof-receipt";

const PAGE_BLOCKS = 2000n;
const MAX_PAGES = 64;

/** Discovery is evidence only: callers retain legacy selection until explicit enrollment confirms it. */
export async function discoverPilotAccountProof(
  input: ProofInput
): Promise<PilotAccountProof | null> {
  equal(
    quantity(await input.client.request({ method: "eth_chainId" }), "RPC chain"),
    BigInt(CHAIN_ID),
    "Gnosis chain"
  );
  const expected = identity(input);
  const head = quantity(await input.client.request({ method: "eth_blockNumber" }), "head block");
  if (head < LAUNCH_BLOCK) return null;
  const sequence = await currentIdentity(input, expected, toHex(head));
  if (sequence === 0n) return null;
  if (input.transactionHash)
    return receiptProof(
      input,
      expected,
      hex(input.transactionHash, "transaction hash", 32),
      head,
      sequence
    );
  const senderTopic = toHex(BigInt(expected.address), { size: 32 });
  const seen = new Set<string>();
  for (let page = 0, from = LAUNCH_BLOCK; from <= head; page++, from += PAGE_BLOCKS) {
    if (page >= MAX_PAGES)
      throw new Error(
        "Pilot proof discovery limit reached; reconcile using the public transaction hash"
      );
    const end = from + PAGE_BLOCKS - 1n > head ? head : from + PAGE_BLOCKS - 1n;
    const logs = await input.client.request({
      method: "eth_getLogs",
      params: [
        {
          address: entryPoint07Address,
          fromBlock: toHex(from),
          toBlock: toHex(end),
          topics: [USER_OPERATION_TOPIC, null, senderTopic],
        },
      ],
    });
    if (!Array.isArray(logs)) throw new Error("Invalid pilot discovery logs");
    for (const value of logs) {
      const log = object(value, "discovery log");
      equal(log.address, entryPoint07Address, "discovery event address");
      const logBlock = quantity(log.blockNumber, "discovery event block");
      if (logBlock < from || logBlock > end || log.removed === true)
        throw new Error("Invalid pilot discovery event range");
      const event = operationEvent(log);
      equal(event.args.sender, expected.address, "discovery event sender");
      if (!event.args.success || event.args.nonce >> 64n !== PILOT_ROOT_NONCE_KEY) continue;
      const hash = hex(log.transactionHash, "discovery transaction hash", 32);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const proof = await receiptProof(input, expected, hash, head, sequence, true);
      if (proof) return proof;
    }
  }
  return null;
}
