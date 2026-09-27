import type { Hex } from "viem";

/**
 * Chain reads the reporting workflow depends on. A verified receipt, not an HTTP response or a
 * browser hint, is the authority for publication; the indexer is only a projection. Every method
 * throws on transport failure so callers can tell "unknown" from "no".
 */
export type Addr = `0x${string}`;

export interface GardenRoles {
  gardener: boolean;
  operator: boolean;
  owner: boolean;
}

export type AccountKind = "eoa" | "kernel" | "unsupported";

export interface ReceiptLog {
  address: Addr;
  topics: readonly Hex[];
  data: Hex;
  logIndex: number;
}

export interface TransactionReceiptView {
  transactionHash: Hex;
  blockHash: Hex;
  blockNumber: bigint;
  status: "success" | "reverted";
  logs: readonly ReceiptLog[];
}

export interface AttestationView {
  uid: Hex;
  schema: Hex;
  recipient: Addr;
  attester: Addr;
  expirationTime: bigint;
  revocable: boolean;
  refUID: Hex;
  data: Hex;
}

export interface AttestedEvent {
  uid: Hex;
  recipient: Addr;
  attester: Addr;
  schemaUID: Hex;
  transactionHash: Hex;
  blockHash: Hex;
  blockNumber: bigint;
  logIndex: number;
}

export interface PublishedWorkView {
  workUID: Hex;
  gardenAddress: Addr;
  gardenerAddress: Addr;
  actionUID: number;
  title: string;
  feedback: string;
  mediaCids: readonly string[];
}

export interface ReportingChain {
  gardenRoles(chainId: number, garden: string, account: string): Promise<GardenRoles>;
  gardenDomainMask(chainId: number, garden: string): Promise<number | null>;
  /** Classifies an account: code at the address, or the counterfactual factory used in its proof. */
  accountKind(
    chainId: number,
    account: string,
    factory?: string,
    factoryData?: Hex
  ): Promise<AccountKind>;
  blockNumber(chainId: number): Promise<bigint>;
  transactionReceipt(chainId: number, hash: Hex): Promise<TransactionReceiptView | null>;
  /** Resolves a UserOperation to its bundled transaction once included. */
  userOperationTransaction(chainId: number, userOperationHash: Hex): Promise<Hex | null>;
  attestation(chainId: number, uid: Hex): Promise<AttestationView | null>;
  /** Bounded scan used when a broadcast hash was never reported. */
  attestedEvents(
    chainId: number,
    filter: {
      eas: Addr;
      schemaUID: Hex;
      recipient: Addr;
      attester: Addr;
      fromBlock: bigint;
      toBlock: bigint;
    }
  ): Promise<AttestedEvent[]>;
  /** Published work awaiting review in a garden, newest first. */
  pendingWork(chainId: number, garden: string): Promise<PublishedWorkView[]>;
  work(chainId: number, workUID: Hex): Promise<PublishedWorkView | null>;
  /** Whether a Kernel permission is installed and enforceable for the account right now. */
  permissionInstalled(chainId: number, account: string, permissionId: Hex): Promise<boolean>;
}

/** keccak256("Attested(address,address,bytes32,bytes32)") */
export const ATTESTED_TOPIC =
  "0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35" as const;
