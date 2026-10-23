import { encode7579Calls } from "permissionless/utils";
import {
  type Abi,
  bytesToHex,
  concatHex,
  decodeAbiParameters,
  decodeEventLog,
  decodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  getCreate2Address,
  type Hex,
  keccak256,
  type PublicClient,
  parseAbi,
  parseAbiParameters,
  toHex,
  zeroAddress,
} from "viem";
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  toUserOperation,
  type UserOperation,
} from "viem/account-abstraction";
import type { Address } from "../../types/domain";
import { getPasskeyAccountRecipe, PILOT_PASSKEY_PROFILE } from "./account-profile";

export const PILOT_PROOF_CALL_ABI = parseAbi(["function rootValidator() view returns (bytes21)"]);
const PROOF_CALL_DATA = encodeFunctionData({
  abi: PILOT_PROOF_CALL_ABI,
  functionName: "rootValidator",
});
const CHAIN_ID = 100;
const LAUNCH_BLOCK = 48906502n;
const PAGE_BLOCKS = 2000n;
const MAX_PAGES = 64;
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ZERO_SALT = toHex(0n, { size: 32 });
const recipe = getPasskeyAccountRecipe(PILOT_PASSKEY_PROFILE, CHAIN_ID);
const validator = hex(recipe.validatorAddress, "validator address", 20);
const factory = hex(recipe.factoryAddress, "factory address", 20);
const implementation = hex(recipe.accountLogicAddress, "implementation address", 20);
const metaFactory = hex(recipe.metaFactoryAddress, "meta-factory address", 20);
const rootValidator = concatHex(["0x01", validator]);
export const PILOT_ROOT_NONCE_KEY = BigInt(concatHex(["0x0000", validator, "0x0000"]));
const SEQUENCE_MASK = (1n << 64n) - 1n;
const REPLAYABLE_PREFIX = keccak256(
  bytesToHex(new TextEncoder().encode("kernel.replayable.signature"))
);
// Full public Gnosis runtimes at block 48907029, checked against verified Arbitrum sources.
// Kernel's chain/domain immutables differ by chain; this implementation pin is Gnosis-specific.
const DEPENDENCIES = [
  [validator, "0x726d987ac55574f77f5184326631c5c51142f94c16c9b9281b751f97519c9eea"],
  [factory, "0xcc4b1b98f5716bf61042d87bfedd4709a5c9a597c41f3bb0e6fb6fe1a4ebd37a"],
  [implementation, "0xd322a16215a673b882523b404f7c71c1b34a9172aa282308090daedb3dd69025"],
  [metaFactory, "0x4527f3642a53f1f4ce76beb05f955a8859b7245a1ff20da5be9a518d2fcd64aa"],
  [entryPoint07Address, "0x8db5ff695839d655407cc8490bb7a5d82337a86a6b39c3f0258aa6c3b582fc58"],
] as const;
// The canonical factory's Solady ERC1967 proxy runtime is independent of its implementation slot.
const PROXY_RUNTIME =
  "0x363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3";
const ACCOUNT_ABI = parseAbi([
  "function accountId() view returns (string)",
  "function entrypoint() view returns (address)",
  "function rootValidator() view returns (bytes21)",
  "function initialize(bytes21,address,bytes,bytes,bytes[])",
]);
const FACTORY_ABI = parseAbi([
  "function getAddress(bytes,bytes32) view returns (address)",
  "function createAccount(bytes,bytes32) payable returns (address)",
]);
const META_FACTORY_ABI = parseAbi([
  "function deployWithFactory(address,bytes,bytes32) payable returns (address)",
]);
const VALIDATOR_ABI = parseAbi([
  "function webAuthnValidatorStorage(address) view returns (uint256 pubKeyX,uint256 pubKeyY)",
  "function isValidSignatureWithSender(address,bytes32,bytes) view returns (bytes4)",
]);
const FAILED_CALL_ABI = parseAbi([
  "event TryExecuteUnsuccessful(uint256 batchExecutionindex,bytes result)",
]);
const SIGNATURE_ABI = parseAbiParameters(
  "bytes authenticatorData,string clientDataJSON,uint256 responseTypeLocation,uint256 r,uint256 s,bool usePrecompiled"
);
const USER_OPERATION_TOPIC = keccak256(
  bytesToHex(
    new TextEncoder().encode(
      "UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)"
    )
  )
);
const FAILED_CALL_TOPIC = keccak256(
  bytesToHex(new TextEncoder().encode("TryExecuteUnsuccessful(uint256,bytes)"))
);

/** Only ordinary public JSON-RPC reads are needed; no bundler, wallet or browser credential port. */
type PilotAccountProofClient = Pick<PublicClient, "request">;
type ProofInput = {
  client: PilotAccountProofClient;
  accountAddress: Address;
  publicKey: Hex;
  canonicalCredentialId: string;
  transactionHash?: Hex;
};
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
type RpcObject = Record<string, unknown>;

export function getPilotProofExecutionCallData(accountAddress: Address): Hex {
  return encode7579Calls({
    mode: { type: "call", revertOnError: false, selector: "0x", context: "0x" },
    callData: [{ to: accountAddress, value: 0n, data: PROOF_CALL_DATA }],
  });
}

function object(value: unknown, label: string): RpcObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid pilot ${label}`);
  return value as RpcObject;
}
function hex(value: unknown, label: string, bytes?: number): Hex {
  if (
    typeof value !== "string" ||
    !/^0x(?:[\da-f]{2})*$/i.test(value) ||
    (bytes !== undefined && value.length !== 2 + 2 * bytes)
  )
    throw new Error(`Invalid pilot ${label}`);
  return value.toLowerCase() as Hex;
}
function quantity(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-f][\da-f]*)$/i.test(value))
    throw new Error(`Invalid pilot ${label}`);
  return BigInt(value);
}
function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Pilot ${label} mismatch`);
}
function nonProof(discovering: boolean, message: string): null {
  if (!discovering) throw new Error(message);
  return null;
}
async function read(
  input: ProofInput,
  to: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  block: Hex,
  from?: Address
) {
  try {
    const data = encodeFunctionData({ abi, functionName, args });
    const result = await input.client.request({
      method: "eth_call",
      params: [{ to, data, ...(from ? { from } : {}) }, block],
    });
    return decodeFunctionResult({ abi, functionName, data: result });
  } catch {
    // RPC/ABI errors can contain the complete captured WebAuthn signature in their request.
    throw new Error(`Pilot proof read failed: ${functionName}`);
  }
}
function identity(input: ProofInput) {
  const key = hex(input.publicKey, "public key")
    .slice(2)
    .replace(/^04(?=[\da-f]{128}$)/, "");
  if (key.length !== 128) throw new Error("Invalid pilot public key");
  const x = BigInt(`0x${key.slice(0, 64)}`),
    y = BigInt(`0x${key.slice(64)}`);
  if (x === 0n || y === 0n) throw new Error("Invalid pilot public key");
  const id = input.canonicalCredentialId;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid pilot credential ID");
  const decoded = atob(id.replace(/-/g, "+").replace(/_/g, "/"));
  if (btoa(decoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== id)
    throw new Error("Invalid pilot credential ID");
  const credentialHash = keccak256(bytesToHex(Uint8Array.from(decoded, (c) => c.charCodeAt(0))));
  const validatorData = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "bytes32" }],
    [x, y, credentialHash]
  );
  const initializer = encodeFunctionData({
    abi: ACCOUNT_ABI,
    functionName: "initialize",
    args: [rootValidator, zeroAddress, validatorData, "0x", []],
  });
  const creationCode = concatHex([
    "0x603d3d8160223d3973",
    implementation,
    "0x60095155f3",
    PROXY_RUNTIME,
  ]);
  const address = getCreate2Address({
    from: factory,
    salt: keccak256(concatHex([initializer, ZERO_SALT])),
    bytecode: creationCode,
  });
  equal(address, getAddress(input.accountAddress), "credential-derived account");
  return { x, y, initializer, address };
}
async function currentIdentity(
  input: ProofInput,
  expected: ReturnType<typeof identity>,
  block: Hex
) {
  await Promise.all(
    DEPENDENCIES.map(async ([address, hash]) => {
      const code = await input.client.request({ method: "eth_getCode", params: [address, block] });
      equal(keccak256(hex(code, "dependency runtime")), hash, "dependency runtime");
    })
  );
  equal(
    await read(input, factory, FACTORY_ABI, "getAddress", [expected.initializer, ZERO_SALT], block),
    expected.address,
    "factory derivation"
  );
  const code = await input.client.request({
    method: "eth_getCode",
    params: [expected.address, block],
  });
  if (code === "0x") return 0n;
  equal(code, PROXY_RUNTIME, "proxy runtime");
  const slot = await input.client.request({
    method: "eth_getStorageAt",
    params: [expected.address, IMPLEMENTATION_SLOT, block],
  });
  equal(
    hex(slot, "implementation slot", 32),
    toHex(BigInt(implementation), { size: 32 }),
    "implementation"
  );
  const [id, ep, root, publicKey, nonce] = await Promise.all([
    read(input, expected.address, ACCOUNT_ABI, "accountId", [], block),
    read(input, expected.address, ACCOUNT_ABI, "entrypoint", [], block),
    read(input, expected.address, ACCOUNT_ABI, "rootValidator", [], block),
    read(input, validator, VALIDATOR_ABI, "webAuthnValidatorStorage", [expected.address], block),
    read(
      input,
      entryPoint07Address,
      entryPoint07Abi,
      "getNonce",
      [expected.address, PILOT_ROOT_NONCE_KEY],
      block
    ),
  ]);
  equal(id, "kernel.advanced.v0.3.3", "account version");
  equal(ep, entryPoint07Address, "EntryPoint");
  equal(root, rootValidator, "root validator");
  if (!Array.isArray(publicKey)) throw new Error("Invalid pilot validator public key");
  equal(publicKey[0], expected.x, "validator public key");
  equal(publicKey[1], expected.y, "validator public key");
  if (typeof nonce !== "bigint" || nonce >> 64n !== PILOT_ROOT_NONCE_KEY)
    throw new Error("Pilot nonce key mismatch");
  return nonce & SEQUENCE_MASK;
}
function operationEvent(log: RpcObject) {
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
async function receiptProof(
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
  if (op.initCode !== "0x") {
    const direct = concatHex([
      factory,
      encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: "createAccount",
        args: [expected.initializer, ZERO_SALT],
      }),
    ]);
    const meta = concatHex([
      metaFactory,
      encodeFunctionData({
        abi: META_FACTORY_ABI,
        functionName: "deployWithFactory",
        args: [factory, expected.initializer, ZERO_SALT],
      }),
    ]);
    if (
      op.initCode.toLowerCase() !== direct.toLowerCase() &&
      op.initCode.toLowerCase() !== meta.toLowerCase()
    )
      return nonProof(discovering, "Pilot proof factory recipe mismatch");
  }
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
  // Recheck the public captured signature against the current matching P256 key. The validator
  // selects key storage by msg.sender; this read-only call never submits an account transaction.
  if (
    String(
      await read(
        input,
        validator,
        VALIDATOR_ABI,
        "isValidSignatureWithSender",
        [expected.address, userOperationHash, op.signature],
        toHex(head),
        expected.address
      )
    ).toLowerCase() !== "0x1626ba7e"
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
