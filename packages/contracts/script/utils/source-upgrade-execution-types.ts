import type {
  SourceTarget,
  SourceUpgradeDeployment,
  SourceUpgradeManifest,
  SourceUpgradePlan,
} from "./source-upgrade-release";

export type OwnerCall = SourceUpgradePlan["ownerCalls"][number];
export interface SourceSafePins {
  runtimeHash: string;
  singleton: string;
  singletonRuntimeHash: string;
}
export interface SourceSafeState extends SourceSafePins {
  owners: string[];
  threshold: number;
  nonce: number;
  guard: string;
  moduleGuard: string;
  modules: string[];
}
export interface SourceProxyState {
  implementation: string;
  owner: string;
  paused: boolean;
  preserved: Record<string, string>;
}
export interface SourceExecutionBoundary {
  step: number;
  kind: "create" | "safe";
  from: string;
  gasLimit: string;
  maxFeeWei: string;
  priorityFeeWei: "0";
  nonce?: number;
  outerNonce?: number;
  safeNonce?: number;
  safeTxGas?: "0";
  baseGas?: "0";
  runtimeHash?: string;
}
export interface SourceExecutionRuntime {
  bindingHash: string;
  deployments: Array<{ key: string; address: string; runtimeHash: string; compilerJobHash: string }>;
}
export interface SourceExecutionRehearsal {
  planHash: string;
  sourceCommit: string;
  manifestHash: string;
  runtimeBindingHash: string;
  deployments: SourceExecutionRuntime["deployments"];
}
export interface SourceExecutionEnvelope {
  chainId: 42161;
  planHash: string;
  manifestHash: string;
  sourceCommit: string;
  artifactHashes: Record<string, string>;
  runtimeBindingHash: string;
  compilerJobHashes: Record<string, string>;
  rehearsalHash: string;
  maxFeeWei: string;
  hatsSpentWei: string;
  gasBudgetWei: string;
  ccipBudgetWei: string;
  otherArbitrumReservedWei: string;
  safePins: SourceSafePins;
  boundaries: SourceExecutionBoundary[];
  baseline: {
    observation: SourceUpgradeManifest["observation"];
    safe: SourceSafeState;
    sources: Partial<Record<SourceTarget, SourceProxyState>>;
  };
}
export interface SourceExecutionContext {
  plan: SourceUpgradePlan;
  manifest: SourceUpgradeManifest;
  envelope: SourceExecutionEnvelope;
  rehearsal: SourceExecutionRehearsal;
  runtime: SourceExecutionRuntime;
}
export interface SourcePaidAttempt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  actualCostWei: string;
  status: 0 | 1;
}
export interface SourceBoundaryEvidence extends Omit<SourcePaidAttempt, "status"> {
  step: number;
  safeTransactionHash?: string;
  runtimeHash?: string;
}
export type SourcePauseSnapshots = Partial<
  Record<SourceTarget, { blockNumber: number; blockHash: string; preservedHash: string }>
>;
export interface SourceExecutionJournal {
  planHash: string;
  envelopeHash: string;
  completed: SourceBoundaryEvidence[];
  attempts: Record<string, SourcePaidAttempt>;
  pausedSnapshots: SourcePauseSnapshots;
  pending?: {
    step: number;
    from: string;
    nonce: number;
    dataHash: string;
    gasLimit: string;
    maxFeeWei: string;
    transactionHash?: string;
  };
}
export interface SourcePublicTransaction {
  hash: string;
  chainId: bigint;
  from: string;
  to: string | null;
  nonce: number;
  data: string;
  value: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  blockNumber: number;
  blockHash: string;
}
export interface SourcePublicReceipt {
  hash: string;
  status: 0 | 1;
  blockNumber: number;
  blockHash: string;
  gasUsed: bigint;
  gasPrice: bigint;
  contractAddress: string | null;
  logs: Array<{ address: string; topics: string[]; data: string }>;
}
export interface SourceExecutionReadPort {
  revalidateBindings(): Promise<void>;
  assertPreconditions(step: number, journal: SourceExecutionJournal): Promise<void>;
  reverifyCompleted(evidence: SourceBoundaryEvidence, entirePrefixLength: number): Promise<void>;
  getPendingNonce(from: string): Promise<number>;
  getChainId(): Promise<number>;
  getTransaction(hash: string): Promise<SourcePublicTransaction | null>;
  getReceipt(hash: string): Promise<SourcePublicReceipt | null>;
  getBlock(number: number): Promise<{ hash: string }>;
  getCode(address: string, block: number | "latest"): Promise<string>;
  getSafeState(block: number): Promise<SourceSafeState>;
  getProxyState(target: SourceTarget, block: number): Promise<SourceProxyState>;
  verifyImplementationGetters(
    deployment: SourceUpgradeDeployment,
    manifest: SourceUpgradeManifest,
    block: number,
  ): Promise<void>;
  assertNewPeerPinsEmpty(target: SourceTarget, block: number): Promise<void>;
  assertCurrentPrefixState(entirePrefixLength: number): Promise<void>;
}
export type SourceBoundaryAdoption = SourceExecutionContext & {
  step: number;
  transactionHash: string;
  port: SourceExecutionReadPort;
  pausedSnapshots?: SourcePauseSnapshots;
  recordMatchedAttempt(attempt: SourcePaidAttempt): Promise<void>;
};
export type SourceBoundaryInput = SourceExecutionContext & {
  step: number;
  expectedNonce: number;
  receiptHash?: string;
  journal: SourceExecutionJournal;
  port: SourceExecutionReadPort;
  writeJournal(journal: SourceExecutionJournal): Promise<void>;
  operatorSubmitCreate?: (deployment: SourceUpgradeDeployment, boundary: SourceExecutionBoundary) => Promise<string>;
};
