import type { ProfileAvatarRecord } from "@green-goods/shared/profile-avatar/protocol";
import type { Address } from "@green-goods/shared/types";
import {
  BaseError,
  type Chain,
  createPublicClient,
  encodeDeployData,
  erc6492SignatureValidatorAbi,
  erc6492SignatureValidatorByteCode,
  ExecutionRevertedError,
  hashMessage,
  hexToBool,
  http,
  isAddressEqual,
  isErc6492Signature,
  recoverMessageAddress,
  serializeErc6492Signature,
} from "viem";
import * as db from "./db";

export type ProfileAvatarSignatureVerificationInput = {
  chainId: number;
  address: Address;
  message: string;
  signature: `0x${string}`;
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type ProfileAvatarSignatureVerifier = (
  input: ProfileAvatarSignatureVerificationInput
) => Promise<boolean>;

type ProfileAvatarVerificationClient = {
  call(parameters: { data: `0x${string}` }): Promise<{ data?: `0x${string}` }>;
};

export type ProfileAvatarStore = {
  get(chainId: number, address: Address): Promise<ProfileAvatarRecord | undefined>;
  compareAndSwap(input: {
    chainId: number;
    address: Address;
    avatarUri: string | null;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    { ok: true; record: ProfileAvatarRecord } | { ok: false; record?: ProfileAvatarRecord }
  >;
};

export class MemoryProfileAvatarStore implements ProfileAvatarStore {
  private records = new Map<string, ProfileAvatarRecord>();

  async get(chainId: number, address: Address): Promise<ProfileAvatarRecord | undefined> {
    return this.records.get(key(chainId, address));
  }

  async compareAndSwap(input: {
    chainId: number;
    address: Address;
    avatarUri: string | null;
    expectedVersion: number;
    updatedAt: string;
  }): Promise<
    { ok: true; record: ProfileAvatarRecord } | { ok: false; record?: ProfileAvatarRecord }
  > {
    const existing = this.records.get(key(input.chainId, input.address));
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) return { ok: false, record: existing };

    const record: ProfileAvatarRecord = {
      chainId: input.chainId,
      address: input.address,
      avatarUri: input.avatarUri,
      version: currentVersion + 1,
      updatedAt: input.updatedAt,
    };
    this.records.set(key(input.chainId, input.address), record);
    return { ok: true, record };
  }
}

export function createSqliteProfileAvatarStore(): ProfileAvatarStore {
  return {
    get: (chainId, address) => db.getProfileAvatar(chainId, address),
    compareAndSwap: (input) => db.compareAndSwapProfileAvatar(input),
  };
}

export function createViemProfileAvatarSignatureVerifier(options: {
  chain: Chain;
  rpcUrl: string;
  client?: ProfileAvatarVerificationClient;
}): ProfileAvatarSignatureVerifier {
  const client: ProfileAvatarVerificationClient =
    options.client ?? createPublicClient({ chain: options.chain, transport: http(options.rpcUrl) });
  return async ({ address, message, signature, factory, factoryData }) => {
    if (await verifyEoaSignature({ address, message, signature })) return true;

    const hash = hashMessage(message);
    const validatorSignature =
      factory && factoryData && !isErc6492Signature(signature)
        ? serializeErc6492Signature({
            address: factory,
            data: factoryData,
            signature,
          })
        : signature;
    const data = encodeDeployData({
      abi: erc6492SignatureValidatorAbi,
      args: [address, hash, validatorSignature],
      bytecode: erc6492SignatureValidatorByteCode,
    });

    // Viem's verifyMessage action turns ERC-1271/6492 call failures into false.
    // Calling the validator directly preserves provider failures for the route's 503 response.
    try {
      const result = await client.call({ data });
      if (!result.data || result.data === "0x") return false;
      return hexToBool(result.data);
    } catch (error) {
      if (isExecutionRevert(error)) return false;
      throw error;
    }
  };
}

async function verifyEoaSignature(input: {
  address: Address;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  try {
    const recoveredAddress = await recoverMessageAddress({
      message: input.message,
      signature: input.signature,
    });
    return isAddressEqual(recoveredAddress, input.address);
  } catch {
    return false;
  }
}

function isExecutionRevert(error: unknown): boolean {
  if (error instanceof ExecutionRevertedError) return true;
  if (!(error instanceof BaseError)) return false;
  return error.walk((cause) => cause instanceof ExecutionRevertedError) !== null;
}

function key(chainId: number, address: Address): string {
  return `${chainId}:${address}`;
}
