import { encode7579Calls } from "permissionless/utils";
import {
  bytesToHex,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  getCreate2Address,
  type Hex,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress,
} from "viem";
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction";
import type { Address } from "../../types/domain";
import { getPasskeyAccountRecipe, PILOT_PASSKEY_PROFILE } from "./account-profile";
import { equal, hex, read, type PilotProofClient } from "./pilot-account-proof-rpc";

export const PILOT_PROOF_CALL_ABI = parseAbi(["function rootValidator() view returns (bytes21)"]);
const PROOF_CALL_DATA = encodeFunctionData({
  abi: PILOT_PROOF_CALL_ABI,
  functionName: "rootValidator",
});
export const CHAIN_ID = 100;
export const LAUNCH_BLOCK = 48906502n;
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ZERO_SALT = toHex(0n, { size: 32 });
const recipe = getPasskeyAccountRecipe(PILOT_PASSKEY_PROFILE, CHAIN_ID);
const validator = hex(recipe.validatorAddress, "validator address", 20);
const factory = hex(recipe.factoryAddress, "factory address", 20);
const implementation = hex(recipe.accountLogicAddress, "implementation address", 20);
const metaFactory = hex(recipe.metaFactoryAddress, "meta-factory address", 20);
const rootValidator = concatHex(["0x01", validator]);
export const PILOT_ROOT_NONCE_KEY = BigInt(concatHex(["0x0000", validator, "0x0000"]));
export const SEQUENCE_MASK = (1n << 64n) - 1n;
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

export type ProofInput = {
  client: PilotProofClient;
  accountAddress: Address;
  publicKey: Hex;
  canonicalCredentialId: string;
  transactionHash?: Hex;
};

export function getPilotProofExecutionCallData(accountAddress: Address): Hex {
  return encode7579Calls({
    mode: { type: "call", revertOnError: false, selector: "0x", context: "0x" },
    callData: [{ to: accountAddress, value: 0n, data: PROOF_CALL_DATA }],
  });
}

export function identity(input: ProofInput) {
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
export async function currentIdentity(
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
/** Bind historical initCode to the same fixed initializer and original factory recipe. */
export function matchesPilotFactoryRecipe(
  expected: ReturnType<typeof identity>,
  initCode: Hex
): boolean {
  if (initCode === "0x") return true;
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
  return (
    initCode.toLowerCase() === direct.toLowerCase() || initCode.toLowerCase() === meta.toLowerCase()
  );
}

/** Recheck the public captured signature using the validator's current matching P256 key. */
export async function matchesPilotCapturedSignature(
  input: ProofInput,
  expected: ReturnType<typeof identity>,
  userOperationHash: Hex,
  signature: Hex,
  head: bigint
): Promise<boolean> {
  // The validator selects storage by msg.sender. This read never submits an account transaction.
  return (
    String(
      await read(
        input,
        validator,
        VALIDATOR_ABI,
        "isValidSignatureWithSender",
        [expected.address, userOperationHash, signature],
        toHex(head),
        expected.address
      )
    ).toLowerCase() === "0x1626ba7e"
  );
}
