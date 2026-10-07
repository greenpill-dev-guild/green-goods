import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { parseEventLogs, zeroHash, type TransactionReceipt } from "viem";
import { getAssessmentSchemas } from "./schemas";
import { getEASConfig } from "../../config/blockchain";
import type { Address, AssessmentWorkflowParams } from "../../types/domain";
import { createClients, EASABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import {
  TransactionConfirmationPendingError,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";
import { reconcileTransaction } from "../transactions/confirmation";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../data/ipfs/upload";

const DOMAIN_MAP: Record<string, number> = {
  solar: 0,
  agro: 1,
  edu: 2,
  waste: 3,
};

export interface CreateAssessmentCommand {
  params: AssessmentWorkflowParams;
  chainId: number;
  onReady(): void;
}

export interface AssessmentSubmission {
  account: Address;
  chainId: number;
  gardenId: Address;
  easAddress: string;
  schemaUid: string;
  result: TxResult;
}

export class AssessmentSubmissionPendingError extends TransactionConfirmationPendingError {
  constructor(readonly assessmentSubmission: AssessmentSubmission) {
    super(assessmentSubmission.result);
  }
}

export class AssessmentConfirmationUnavailableError extends Error {
  constructor(
    readonly assessmentSubmission: AssessmentSubmission,
    message = "assessment-confirmation-unavailable"
  ) {
    super(message);
    this.name = "AssessmentConfirmationUnavailableError";
  }
}

interface AssessmentSchemaConfig {
  schemaVersion: 2 | 3 | undefined;
  easAddress: string;
  schemaUid: string;
  schema: string;
}

interface AssessmentSchemaValue {
  name: string;
  value: string | number;
  type: string;
}

export interface CreateAssessmentPorts {
  reader: {
    configuration(chainId: number): AssessmentSchemaConfig;
    encode(schema: string, values: AssessmentSchemaValue[]): string;
  };
  sender: {
    ensureChain(chainId: number): Promise<void>;
    connect(easAddress: string): Promise<void>;
    attest(input: {
      schemaUid: string;
      gardenId: `0x${string}`;
      encodedData: string;
    }): Promise<string>;
  };
  documents: {
    uploadFile(file: File): Promise<string>;
    uploadJson(value: Record<string, unknown>): Promise<string>;
    reportEvidenceFailures(input: { failedCount: number; totalCount: number }): void;
    reportMetricsFailure(error: unknown): void;
  };
  clock: {
    toUnixSeconds(value?: string | number | null): number;
  };
}

export function resolveAssessmentDomain(assessmentType: string): number | null {
  const lower = assessmentType.toLowerCase();
  if (lower.startsWith("domain-")) {
    const domain = Number.parseInt(lower.replace("domain-", ""), 10);
    return Number.isInteger(domain) && domain >= 0 && domain <= 3 ? domain : null;
  }
  return DOMAIN_MAP[lower] ?? null;
}

export async function createAssessment(
  command: CreateAssessmentCommand,
  ports: CreateAssessmentPorts
): Promise<string> {
  const { params, chainId } = command;
  const config = ports.reader.configuration(chainId);

  await ports.sender.ensureChain(chainId);

  const domain = params.domain ?? resolveAssessmentDomain(params.assessmentType);
  if (domain === null) {
    throw new Error(
      `Unrecognized assessment domain "${params.assessmentType}" — refusing to encode a fabricated domain`
    );
  }
  command.onReady();

  if (
    !config.easAddress ||
    !config.schemaUid ||
    isZeroBytes32(config.schemaUid) ||
    !config.schema
  ) {
    throw new Error(`EAS configuration missing for chain ${chainId}`);
  }

  await ports.sender.connect(config.easAddress);

  let evidenceMediaCids: string[] = [];
  if (params.evidenceMedia?.length) {
    const results = await Promise.allSettled(
      params.evidenceMedia.map((file) => ports.documents.uploadFile(file))
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
      ports.documents.reportEvidenceFailures({
        failedCount,
        totalCount: params.evidenceMedia.length,
      });
    }
    evidenceMediaCids = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map((result) => result.value);
  }

  const metricsPayload = parseMetrics(params.metrics);
  let metricsCid: string;
  try {
    metricsCid = await ports.documents.uploadJson(metricsPayload);
  } catch (error) {
    ports.documents.reportMetricsFailure(error);
    throw error;
  }

  const assessmentConfig = {
    assessmentType: params.assessmentType,
    capitals: params.capitals,
    metricsCid,
    evidenceMediaCids,
    reportDocuments: (params.reportDocuments || []).filter(Boolean),
    impactAttestations: (params.impactAttestations || []).map((uid) => uid.trim().toLowerCase()),
    tags: params.tags,
  };
  const assessmentConfigCID = await ports.documents.uploadJson(assessmentConfig);
  const encodedData = ports.reader.encode(config.schema, [
    { name: "title", value: params.title, type: "string" },
    { name: "description", value: params.description, type: "string" },
    { name: "assessmentConfigCID", value: assessmentConfigCID, type: "string" },
    { name: "domain", value: domain, type: "uint8" },
    {
      name: "startDate",
      value: ports.clock.toUnixSeconds(params.startDate),
      type: "uint256",
    },
    {
      name: "endDate",
      value: ports.clock.toUnixSeconds(params.endDate),
      type: "uint256",
    },
    { name: "location", value: params.location, type: "string" },
    // This garden-level workflow records a baseline, outside a module cycle.
    ...(config.schemaVersion === 3
      ? [
          { name: "assessmentKind", value: 0, type: "uint8" },
          { name: "cycleId", value: 0, type: "uint256" },
          { name: "baselineUID", value: zeroHash, type: "bytes32" },
        ]
      : []),
  ]);

  return ports.sender.attest({
    schemaUid: config.schemaUid,
    gardenId: params.gardenId as `0x${string}`,
    encodedData,
  });
}

function parseMetrics(metrics: AssessmentWorkflowParams["metrics"]): Record<string, unknown> {
  if (typeof metrics !== "string") return metrics;
  try {
    return JSON.parse(metrics) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid metrics JSON. Please provide valid JSON content.");
  }
}

function toUnixSeconds(value?: string | number | null): number {
  if (!value) return 0;
  if (typeof value === "number") return Math.floor(value);
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : Math.floor(timestamp / 1_000);
}

export function createDefaultCreateAssessmentPorts(input: {
  /** The account the assessment was prepared for; the sender must still belong to it. */
  account: Address;
  transactionSender: TransactionSender;
  reportEvidenceFailures(details: { failedCount: number; totalCount: number }): void;
  reportMetricsFailure(error: unknown): void;
}): CreateAssessmentPorts {
  let chain: number | null = null;
  let easAddress: string | null = null;

  return {
    reader: {
      configuration: (chainId) => {
        const contracts = getNetworkContracts(chainId);
        const [schema] = getAssessmentSchemas(getEASConfig(chainId));
        return {
          easAddress: contracts.eas,
          schemaUid: schema?.uid ?? zeroHash,
          schema: schema?.schema ?? "",
          schemaVersion: schema?.version,
        };
      },
      encode: (schema, values) => new SchemaEncoder(schema).encodeData(values),
    },
    sender: {
      ensureChain: async (chainId) => {
        chain = chainId;
        await input.transactionSender.assertOwnership?.(input.account, chainId);
      },
      connect: async (address) => {
        easAddress = address;
        if (chain === null) throw new Error("Assessment sender was not prepared");
        await input.transactionSender.assertOwnership?.(input.account, chain);
      },
      attest: async ({ schemaUid, gardenId, encodedData }) => {
        if (chain === null || !easAddress) throw new Error("Assessment sender was not prepared");
        const sender = input.transactionSender;
        const sendOn = chain;
        const sendTo = easAddress;
        const assertOwnership = () => sender.assertOwnership?.(input.account, sendOn);
        await assertOwnership();
        const result = await sender.sendContractCall(
          {
            address: sendTo as Address,
            account: input.account,
            chainId: sendOn,
            abi: EASABI,
            functionName: "attest",
            args: [
              {
                schema: schemaUid,
                data: {
                  recipient: gardenId,
                  expirationTime: 0n,
                  revocable: false,
                  refUID: zeroHash,
                  data: encodedData,
                  value: 0n,
                },
              },
            ],
          },
          { assertOwnership }
        );
        const submission = {
          account: input.account,
          chainId: sendOn,
          gardenId,
          easAddress: sendTo,
          schemaUid,
          result,
        };
        if (result.confirmation === "pending")
          throw new AssessmentSubmissionPendingError(submission);
        const publicClient = createClients(sendOn).publicClient;
        let receipt: TransactionReceipt;
        try {
          receipt = await publicClient.waitForTransactionReceipt({
            hash: result.hash,
            timeout: TX_RECEIPT_TIMEOUT_MS,
          });
        } catch {
          // The sender confirmed execution. Do not expose the RPC request or imply it failed.
          throw new AssessmentConfirmationUnavailableError(submission);
        }
        if (receipt.status !== "success") throw new Error("Assessment transaction reverted");
        const uid = readAssessmentUid(receipt, submission);
        if (!uid)
          throw new AssessmentConfirmationUnavailableError(
            submission,
            "Assessment receipt has no matching attestation"
          );
        return uid;
      },
    },
    documents: {
      uploadFile: async (file) => (await uploadFileToIPFS(file)).cid,
      uploadJson: async (value) => (await uploadJSONToIPFS(value)).cid,
      reportEvidenceFailures: input.reportEvidenceFailures,
      reportMetricsFailure: input.reportMetricsFailure,
    },
    clock: { toUnixSeconds },
  };
}

function readAssessmentUid(
  receipt: TransactionReceipt,
  submission: AssessmentSubmission
): string | undefined {
  const attested = parseEventLogs({
    abi: EASABI,
    eventName: "Attested",
    logs: receipt.logs,
  }).find((log) => {
    const args = log.args as {
      recipient?: string;
      attester?: string;
      schemaUID?: string;
      uid?: string;
    };
    return (
      log.address.toLowerCase() === submission.easAddress.toLowerCase() &&
      args.recipient?.toLowerCase() === submission.gardenId.toLowerCase() &&
      args.attester?.toLowerCase() === submission.account.toLowerCase() &&
      args.schemaUID?.toLowerCase() === submission.schemaUid.toLowerCase() &&
      Boolean(args.uid && !isZeroBytes32(args.uid))
    );
  });
  const uid = (attested?.args as { uid?: string } | undefined)?.uid;
  return uid?.toLowerCase();
}

/** Recover the exact EAS record of an accepted submission without another attest. */
export async function reconcileAssessmentSubmission(
  submission: AssessmentSubmission,
  sender: TransactionSender
): Promise<
  { status: "confirmed"; uid: string } | { status: "unresolved" } | { status: "reverted" }
> {
  let receipt: TransactionReceipt | undefined;
  const client = createClients(submission.chainId).publicClient;
  const outcome = await reconcileTransaction(sender, submission.result, async (hash) => {
    receipt = await client.getTransactionReceipt({ hash });
    return receipt;
  });
  if (outcome.status !== "confirmed") return outcome;
  try {
    receipt ??= await client.getTransactionReceipt({ hash: outcome.transactionHash });
    if (receipt.status === "reverted") return { status: "reverted" };
    const uid = readAssessmentUid(receipt, submission);
    return uid ? { status: "confirmed", uid } : { status: "unresolved" };
  } catch {
    return { status: "unresolved" };
  }
}
