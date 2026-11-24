import {
  bytesToHex,
  decodeAbiParameters,
  decodeEventLog,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toHex,
} from "viem";
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  toUserOperation,
  type UserOperation,
} from "viem/account-abstraction";
import type { Address } from "../../types/domain";
import {
  CHAIN_ID,
  LAUNCH_BLOCK,
  PILOT_ROOT_NONCE_KEY,
  SEQUENCE_MASK,
  getPilotProofExecutionCallData,
  matchesPilotFactoryRecipe,
  matchesPilotCapturedSignature,
  type ProofInput,
  type identity,
} from "./pilot-account-proof-account";
import { equal, hex, object, quantity, type RpcObject } from "./pilot-account-proof-rpc";

const REPLAYABLE_PREFIX = keccak256(
  bytesToHex(new TextEncoder().encode("kernel.replayable.signature"))
);
const FAILED_CALL_ABI = parseAbi([
  "event TryExecuteUnsuccessful(uint256 batchExecutionindex,bytes result)",
]);
const SIGNATURE_ABI = parseAbiParameters(
  "bytes authenticatorData,string clientDataJSON,uint256 responseTypeLocation,uint256 r,uint256 s,bool usePrecompiled"
);
export const USER_OPERATION_TOPIC = keccak256(
  bytesToHex(
    new TextEncoder().encode(
      "UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"
    )
  )
);
const FAILED_CALL_TOPIC = keccak256(
  bytesToHex(new TextEncoder().encode("TryExecuteUnsuccessful(uint256,bytes)"))
);

export type PilotAccountProof = {
  accountAddress: Address;
  chainId: 100;
  transactionHash: Hex;
  userOperationHash: Hex;
  blockNumber: bigint;
  nonce: bigint;
};
/** A canonical, signed proof was mined but its TRY-mode inner call failed; a fresh quote may retry. */
export class PilotProofExecutionFailedError extends Error {
  constructor() {
    super("Pilot proof inner call failed");
    this.name = "PilotProofExecutionFailedError";
  }
}
function nonProof(discovering: boolean, message: string): null {
  if (!discovering) throw new Error(message);
  return null;
}
export function operationEvent(log: RpcObject) {
  if (!Array.isArray(log.topics) || log.topics.length !== 4)
    throw new Error("Invalid pilot event topics");
  const topics = log.topics.map((value) => hex(value, "event topic", 32)) as [Hex, ...Hex[]];
  try {
    return decodeEventLog({
      abi: entryPoint07Abi,
      eventName: "UserOperationEvent",
      data: hex(log.data, "event data"),
      topics,
      strict: true,
    });
  } catch {
    throw new Error("Invalid pilot UserOperation event");
  }
}
export async function receiptProof(
  input: ProofInput,
  expected: ReturnType<typeof identity>,
  transactionHash: Hex,
  head: bigint,
  sequence: bigint,
  discovering = false
): Promise<PilotAccountProof | null> {
  const receiptValue = await input.client.request({
    method: "eth_getTransactionReceipt",
    params: [transactionHash],
  });
  if (receiptValue === null) return null;
  const receipt = object(receiptValue, "receipt");
  equal(receipt.transactionHash, transactionHash, "receipt hash");
  equal(quantity(receipt.status, "receipt status"), 1n, "receipt status");
  const blockNumber = quantity(receipt.blockNumber, "receipt block");
  if (blockNumber < LAUNCH_BLOCK || blockNumber > head)
    throw new Error("Pilot proof block is outside the observed chain");
  const blockHash = hex(receipt.blockHash, "receipt block hash", 32);
  const block = object(
    await input.client.request({
      method: "eth_getBlockByNumber",
      params: [toHex(blockNumber), false],
    }),
    "canonical block"
  );
  equal(block.hash, blockHash, "canonical receipt block");
  if (!Array.isArray(receipt.logs)) throw new Error("Invalid pilot receipt logs");
  const matches = [];
  let innerFailed = false;
  for (const value of receipt.logs) {
    const log = object(value, "receipt log");
    if (String(log.address).toLowerCase() === expected.address.toLowerCase()) {
      if (Array.isArray(log.topics) && String(log.topics[0]).toLowerCase() === FAILED_CALL_TOPIC) {
        try {
          decodeEventLog({
            abi: FAILED_CALL_ABI,
            data: hex(log.data, "failed inner event"),
            topics: log.topics as [Hex, ...Hex[]],
            strict: true,
          });
        } catch {
          throw new Error("Invalid pilot failed inner event");
        }
        equal(log.blockHash, blockHash, "failed inner event block");
        equal(log.transactionHash, transactionHash, "failed inner event transaction");
        if (log.removed === true) throw new Error("Pilot failed inner event was removed");
        innerFailed = true;
      }
      continue;
    }
    if (String(log.address).toLowerCase() !== entryPoint07Address.toLowerCase()) continue;
    if (!Array.isArray(log.topics) || String(log.topics[0]).toLowerCase() !== USER_OPERATION_TOPIC)
      continue;
    const event = operationEvent(log);
    if (event.args.sender.toLowerCase() !== expected.address.toLowerCase()) continue;
    equal(log.blockHash, blockHash, "event block hash");
    equal(quantity(log.blockNumber, "event block"), blockNumber, "event block");
    equal(log.transactionHash, transactionHash, "event transaction hash");
    if (log.removed === true) throw new Error("Pilot event was removed");
    if (!event.args.success) return nonProof(discovering, "Pilot UserOperation failed");
    if (event.args.nonce >> 64n !== PILOT_ROOT_NONCE_KEY)
      return nonProof(discovering, "Pilot event nonce key mismatch");
    if ((event.args.nonce & SEQUENCE_MASK) >= sequence)
      throw new Error("Pilot proof nonce has not been consumed");
    matches.push(event.args);
  }
  if (matches.length !== 1)
    return nonProof(discovering, "Pilot receipt requires one unambiguous UserOperation event");
  const event = matches[0];
  const tx = object(
    await input.client.request({ method: "eth_getTransactionByHash", params: [transactionHash] }),
    "outer transaction"
  );
  equal(tx.hash, transactionHash, "outer hash");
  equal(tx.to, entryPoint07Address, "outer target");
  equal(tx.blockHash, blockHash, "outer block hash");
  equal(quantity(tx.blockNumber, "outer block"), blockNumber, "outer block");
  equal(quantity(tx.chainId, "outer chain"), BigInt(CHAIN_ID), "outer chain");
  equal(quantity(tx.value, "outer value"), 0n, "outer value");
  const outerData = hex(tx.input, "outer calldata");
  const decoded = (() => {
    try {
      return decodeFunctionData({ abi: entryPoint07Abi, data: outerData });
    } catch {
      throw new Error("Invalid pilot outer calldata");
    }
  })();
  if (decoded.functionName !== "handleOps")
    return nonProof(discovering, "Pilot proof requires direct EntryPoint handleOps");
  equal(
    encodeFunctionData({ abi: entryPoint07Abi, functionName: "handleOps", args: decoded.args }),
    outerData,
    "canonical outer calldata"
  );
  const operations = decoded.args[0].filter(
    (op) => op.sender.toLowerCase() === expected.address.toLowerCase()
  );
  if (operations.length !== 1)
    return nonProof(discovering, "Pilot proof requires one account operation in the outer batch");
  const op = operations[0];
  equal(op.nonce, event.nonce, "operation nonce");
  const expectedCallData = getPilotProofExecutionCallData(expected.address);
  if (op.callData.toLowerCase() !== expectedCallData.toLowerCase()) {
    return nonProof(discovering, "Pilot zero-value rootValidator call mismatch");
  }
  if (op.signature === "0x" || op.signature.toLowerCase().startsWith(REPLAYABLE_PREFIX))
    return nonProof(discovering, "Pilot proof requires a normal chain-bound signature");
  try {
    equal(
      encodeAbiParameters(SIGNATURE_ABI, decodeAbiParameters(SIGNATURE_ABI, op.signature)),
      op.signature,
      "canonical WebAuthn signature"
    );
  } catch {
    return nonProof(discovering, "Invalid pilot WebAuthn signature encoding");
  }
  if (!matchesPilotFactoryRecipe(expected, op.initCode))
    return nonProof(discovering, "Pilot proof factory recipe mismatch");
  // viem's installed Ox alias unpacks at runtime but its generic return type retains Packed.
  const unpacked = toUserOperation({
    ...op,
    sender: hex(op.sender, "operation sender", 20),
  }) as unknown as UserOperation<"0.7">;
  const userOperationHash = getUserOperationHash({
    userOperation: unpacked,
    chainId: CHAIN_ID,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
  });
  equal(userOperationHash, event.userOpHash, "UserOperation hash");
  if (
    !(await matchesPilotCapturedSignature(input, expected, userOperationHash, op.signature, head))
  )
    return nonProof(discovering, "Pilot captured signature mismatch");
  if (innerFailed) {
    if (discovering) return null;
    throw new PilotProofExecutionFailedError();
  }
  return {
    accountAddress: expected.address,
    chainId: CHAIN_ID,
    transactionHash,
    userOperationHash,
    blockNumber,
    nonce: op.nonce,
  };
}
