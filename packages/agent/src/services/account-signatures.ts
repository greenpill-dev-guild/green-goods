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
  recoverAddress,
  type Hex,
  serializeErc6492Signature,
} from "viem";

export type AccountSignatureVerificationInput = {
  chainId: number;
  address: Address;
  message: string;
  signature: `0x${string}`;
  factory?: Address;
  factoryData?: `0x${string}`;
};

export type AccountSignatureVerifier = (
  input: AccountSignatureVerificationInput
) => Promise<boolean>;

type AccountVerificationClient = {
  call(parameters: { data: `0x${string}` }): Promise<{ data?: `0x${string}` }>;
};

export type AccountHashVerificationInput = Omit<AccountSignatureVerificationInput, "message"> & {
  hash: Hex;
};
export function createViemAccountSignatureVerifier(options: {
  chain: Chain;
  rpcUrl: string;
  client?: AccountVerificationClient;
}): AccountSignatureVerifier {
  const verifyHash = createViemAccountHashVerifier(options);
  return ({ message, ...input }) => verifyHash({ ...input, hash: hashMessage(message) });
}

/** The same EOA/ERC-1271/ERC-6492 authority boundary for an already hashed EIP-712 message. */
export function createViemAccountHashVerifier(options: {
  chain: Chain;
  rpcUrl: string;
  client?: AccountVerificationClient;
}): (input: AccountHashVerificationInput) => Promise<boolean> {
  const client: AccountVerificationClient =
    options.client ?? createPublicClient({ chain: options.chain, transport: http(options.rpcUrl) });
  return async ({ address, hash, signature, factory, factoryData }) => {
    if (await verifyEoaHash({ address, hash, signature })) return true;
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

async function verifyEoaHash(input: {
  address: Address;
  hash: Hex;
  signature: `0x${string}`;
}): Promise<boolean> {
  try {
    const recoveredAddress = await recoverAddress({
      hash: input.hash,
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
