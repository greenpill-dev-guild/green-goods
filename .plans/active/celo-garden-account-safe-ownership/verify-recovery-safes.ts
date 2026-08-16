#!/usr/bin/env bun

import {
  Contract,
  Interface,
  JsonRpcProvider,
  ZeroAddress,
  dataSlice,
  getAddress,
  keccak256,
} from "ethers";

import { assertRecoverySafeProof } from "../../../../packages/contracts/script/deploy/recovery-safe-proof";

const RPC_URL = "https://forno.celo.org";
const CHAIN_ID = 42_220;
const CANONICAL_G_DOLLAR = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
const SAFE_SENTINEL = "0x0000000000000000000000000000000000000001";
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const FALLBACK_HANDLER_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const OFFICIAL = {
  safeL2: {
    address: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
    codeHash: "0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff",
  },
  proxyFactory: {
    address: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    codeHash: "0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317",
  },
  multiSend: {
    address: "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526",
    codeHash: "0x0e4f7fc66550a322d1e7688e181b75e217e662a4f3f4d6a29b22bc61217c4b77",
  },
  compatibilityFallbackHandler: {
    address: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    codeHash: "0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9",
  },
} as const;

const RECOVERY_SAFES = {
  greenGoodsProtocol: "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19",
  greenpillDevGuild: "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C",
} as const;

const SAFE_ABI = [
  "function VERSION() view returns (string)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)",
  "function nonce() view returns (uint256)",
] as const;
const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"] as const;
const FACTORY_ABI = ["function proxyRuntimeCode() view returns (bytes)"] as const;
const EIP1271 = new Interface(["function isValidSignature(bytes32 hash,bytes signature) view returns (bytes4)"]);

function storageAddress(value: string): string {
  return getAddress(dataSlice(value, 12));
}

function errorData(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { data?: unknown; info?: { error?: { data?: unknown } } };
  if (typeof candidate.data === "string") return candidate.data;
  const nested = candidate.info?.error?.data;
  return typeof nested === "string" ? nested : null;
}

async function codeIdentity(provider: JsonRpcProvider, address: string, blockTag: number) {
  const code = await provider.getCode(address, blockTag);
  return {
    address: getAddress(address),
    codePresent: code !== "0x",
    codeHash: code === "0x" ? null : keccak256(code),
  };
}

async function inspectSafe(
  provider: JsonRpcProvider,
  proxyRuntimeHash: string,
  address: string,
  blockTag: number,
) {
  const safeAddress = getAddress(address);
  const safe = new Contract(safeAddress, SAFE_ABI, provider);
  const token = new Contract(CANONICAL_G_DOLLAR, ERC20_ABI, provider);
  const [
    code,
    singletonStorage,
    version,
    owners,
    threshold,
    modulesPage,
    guardStorage,
    fallbackStorage,
    nonce,
    nativeBalance,
    canonicalGdBalance,
  ] = await Promise.all([
    provider.getCode(safeAddress, blockTag),
    provider.getStorage(safeAddress, 0, blockTag),
    safe.VERSION({ blockTag }),
    safe.getOwners({ blockTag }),
    safe.getThreshold({ blockTag }),
    safe.getModulesPaginated(SAFE_SENTINEL, 32, { blockTag }),
    provider.getStorage(safeAddress, GUARD_SLOT, blockTag),
    provider.getStorage(safeAddress, FALLBACK_HANDLER_SLOT, blockTag),
    safe.nonce({ blockTag }),
    provider.getBalance(safeAddress, blockTag),
    token.balanceOf(safeAddress, { blockTag }),
  ]);

  let invalidEip1271Probe: { reverted: boolean; data: string | null };
  try {
    const data = await provider.call(
      {
        to: safeAddress,
        data: EIP1271.encodeFunctionData("isValidSignature", [
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x",
        ]),
      },
      blockTag,
    );
    invalidEip1271Probe = { reverted: false, data };
  } catch (error) {
    invalidEip1271Probe = { reverted: true, data: errorData(error) };
  }

  const normalizedOwners = (owners as string[]).map(getAddress);
  const modules = (modulesPage[0] as string[]).map(getAddress);
  return {
    address: safeAddress,
    codeHash: keccak256(code),
    proxyRuntimeHashMatchesOfficialFactory: keccak256(code) === proxyRuntimeHash,
    singleton: storageAddress(singletonStorage),
    version: String(version),
    owners: normalizedOwners,
    ownersUnique: new Set(normalizedOwners.map((owner) => owner.toLowerCase())).size === normalizedOwners.length,
    threshold: String(threshold),
    nonce: String(nonce),
    modules,
    modulesNext: getAddress(modulesPage[1]),
    guard: storageAddress(guardStorage),
    fallbackHandler: storageAddress(fallbackStorage),
    nativeBalance: String(nativeBalance),
    canonicalGdBalance: String(canonicalGdBalance),
    invalidEip1271Probe,
    liveStateChecks: {
      officialSafeL2Singleton: storageAddress(singletonStorage) === getAddress(OFFICIAL.safeL2.address),
      version141: String(version) === "1.4.1",
      uniqueOwners: new Set(normalizedOwners.map((owner) => owner.toLowerCase())).size === normalizedOwners.length,
      thresholdValid: Number(threshold) >= 1 && Number(threshold) <= normalizedOwners.length,
      noModules: modules.length === 0 && getAddress(modulesPage[1]) === getAddress(SAFE_SENTINEL),
      noGuard: storageAddress(guardStorage) === ZeroAddress,
      officialCompatibilityFallbackHandler:
        storageAddress(fallbackStorage) === getAddress(OFFICIAL.compatibilityFallbackHandler.address),
    },
  };
}

const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Expected Celo ${CHAIN_ID}, got ${network.chainId}`);
const finalized = await provider.getBlock("finalized");
if (!finalized) throw new Error("Celo RPC did not return a finalized block");
const blockTag = finalized.number;

const officialEntries = Object.entries(OFFICIAL);
const officialCode = Object.fromEntries(
  await Promise.all(
    officialEntries.map(async ([name, expected]) => {
      const actual = await codeIdentity(provider, expected.address, blockTag);
      return [name, { ...actual, expectedCodeHash: expected.codeHash, matches: actual.codeHash === expected.codeHash }];
    }),
  ),
);

const factory = new Contract(OFFICIAL.proxyFactory.address, FACTORY_ABI, provider);
const proxyRuntimeCode = String(await factory.proxyRuntimeCode({ blockTag }));
const proxyRuntimeHash = keccak256(proxyRuntimeCode);

const recoverySafes = Object.fromEntries(
  await Promise.all(
    Object.entries(RECOVERY_SAFES).map(async ([name, address]) => [
      name,
      await inspectSafe(provider, proxyRuntimeHash, address, blockTag),
    ]),
  ),
);

assertRecoverySafeProof(officialCode, recoverySafes);

console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      kind: "CELO_RECOVERY_SAFE_IDENTITY_PROOF",
      generatedAt: new Date().toISOString(),
      rpc: "https://forno.celo.org",
      chainId: CHAIN_ID,
      blockNumber: blockTag,
      blockHash: finalized.hash,
      sources: {
        safeDeployments:
          "https://github.com/safe-global/safe-deployments/tree/main/src/assets/v1.4.1",
        safeSignatures: "https://docs.safe.global/advanced/smart-account-signatures",
      },
      officialCode,
      officialProxyRuntimeHash: proxyRuntimeHash,
      recoverySafes,
      proofLimits: [
        "The invalid-signature EIP-1271 probe proves the Safe fallback path rejects malformed signatures; it does not prove a valid nested recovery signature.",
        "Valid nested EIP-1271 execution requires a pinned Celo fork test using the live owner and threshold state.",
        "Arbitrary ERC-20, ERC-721, and ERC-1155 inventory is not enumerated by these reads.",
      ],
    },
    null,
    2,
  ),
);
