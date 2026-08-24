import { EAS, SchemaEncoder, type Transaction } from "@ethereum-attestation-service/eas-sdk";
import { type Eip1193Provider, ethers } from "ethers";
import type { WalletClient } from "viem";
import { getEASConfig } from "../../config/blockchain";
import type { AssessmentWorkflowParams } from "../../types/domain";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroBytes32 } from "../../utils/blockchain/vaults";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../data/ipfs/upload";
import { ensureAppKitWalletChain } from "../transactions/chain-guard";

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

interface AssessmentSchemaConfig {
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
  walletClient: WalletClient;
  reportEvidenceFailures(details: { failedCount: number; totalCount: number }): void;
  reportMetricsFailure(error: unknown): void;
}): CreateAssessmentPorts {
  let eas: EAS | null = null;

  return {
    reader: {
      configuration: (chainId) => {
        const contracts = getNetworkContracts(chainId);
        const easConfig = getEASConfig(chainId);
        return {
          easAddress: contracts.eas,
          schemaUid: easConfig.ASSESSMENT.uid,
          schema: easConfig.ASSESSMENT.schema,
        };
      },
      encode: (schema, values) => new SchemaEncoder(schema).encodeData(values),
    },
    sender: {
      ensureChain: ensureAppKitWalletChain,
      connect: async (easAddress) => {
        eas = new EAS(easAddress);
        const { account, transport } = input.walletClient;
        if (!account) throw new Error("Wallet client account unavailable");
        const provider = new ethers.BrowserProvider(transport as Eip1193Provider);
        eas.connect(await provider.getSigner(account.address));
      },
      attest: async ({ schemaUid, gardenId, encodedData }) => {
        if (!eas) throw new Error("Assessment sender was not prepared");
        const transaction: Transaction<string> = await eas.attest({
          schema: schemaUid,
          data: {
            recipient: gardenId,
            expirationTime: 0n,
            revocable: false,
            data: encodedData,
          },
        });
        return transaction.wait();
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
