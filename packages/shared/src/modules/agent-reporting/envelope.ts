import {
  type Address,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  type Hex,
  isAddress,
  isAddressEqual,
  parseAbiParameters,
  zeroHash,
} from "viem";
import { getEASConfig } from "../../config/blockchain";
import { reportingDigest } from "./canonical";

/**
 * The exact publication a confirmed report or review becomes.
 *
 * The Agent freezes this envelope before any wallet request or delegated signature. The browser
 * rebuilds the schema data and calldata from the envelope's own fields and deployment config and
 * rejects any difference, so a compromised API cannot swap the target, schema, recipient, payload
 * or value behind a matching summary.
 */
export const EAS_ATTEST_ABI = [
  {
    type: "function",
    name: "attest",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const REPORTING_CHAIN_IDS = [42161, 11155111] as const;

/**
 * Encoder-facing addresses use `0x${string}`: this workspace registers viem's `Address` as plain
 * `string`, which would let unchecked text reach calldata and the wire contract.
 */
export interface ReportingDeployment {
  chainId: number;
  easAddress: Hex;
  work: { schemaUID: Hex; schema: string };
  review: { schemaUID: Hex; schema: string };
}

export class ReportingDeploymentError extends Error {}

/** Refuses chains without a real deployment instead of inheriting the silent Arbitrum fallback. */
export function resolveReportingDeployment(chainId: number): ReportingDeployment {
  if (!(REPORTING_CHAIN_IDS as readonly number[]).includes(chainId)) {
    throw new ReportingDeploymentError(`Chain ${chainId} is not configured for agent reporting`);
  }
  const config = getEASConfig(chainId);
  const deployment = {
    chainId,
    easAddress: config.EAS.address as Hex,
    work: { schemaUID: config.WORK.uid as Hex, schema: config.WORK.schema },
    review: { schemaUID: config.WORK_APPROVAL.uid as Hex, schema: config.WORK_APPROVAL.schema },
  };
  if (
    !isAddress(deployment.easAddress) ||
    [deployment.work, deployment.review].some((s) => s.schemaUID === zeroHash || !s.schema)
  ) {
    throw new ReportingDeploymentError(`Chain ${chainId} has an incomplete EAS deployment`);
  }
  return deployment;
}

export interface WorkAttestationFields {
  /** Decimal string so the value round-trips through JSON exactly. */
  actionUID: string;
  title: string;
  feedback: string;
  metadata: string;
  media: string[];
}

export interface ReviewAttestationFields {
  actionUID: string;
  workUID: Hex;
  approved: boolean;
  feedback: string;
  confidence: number;
  verificationMethod: number;
  reviewNotesCID: string;
}

interface EnvelopeCommon {
  version: 1;
  operationId: string;
  revision: number;
  chainId: number;
  accountAddress: Hex;
  gardenAddress: Hex;
  easAddress: Hex;
  schemaUID: Hex;
  encodedData: Hex;
  call: { to: Hex; data: Hex; value: "0" };
}

export interface WorkEnvelope extends EnvelopeCommon {
  kind: "work";
  clientWorkId: string;
  actionDefinitionDigest: Hex;
  fields: WorkAttestationFields;
  media: Array<{ assetId: string; digest: string; cid: string; mime: string }>;
  metadataDigest: Hex;
}

export interface ReviewEnvelope extends EnvelopeCommon {
  kind: "review";
  reviewContentDigest: Hex;
  fields: ReviewAttestationFields;
}

export type UnsignedEnvelope = WorkEnvelope | ReviewEnvelope;
export type PublicationEnvelope = UnsignedEnvelope & { payloadDigest: Hex };

function schemaValues(envelope: UnsignedEnvelope): readonly unknown[] {
  if (envelope.kind === "work") {
    const { actionUID, title, feedback, metadata, media } = envelope.fields;
    return [BigInt(actionUID), title, feedback, metadata, media];
  }
  const f = envelope.fields;
  return [
    BigInt(f.actionUID),
    f.workUID,
    f.approved,
    f.feedback,
    f.confidence,
    f.verificationMethod,
    f.reviewNotesCID,
  ];
}

export function encodeSchemaData(schema: string, values: readonly unknown[]): Hex {
  return encodeAbiParameters(parseAbiParameters(schema), values as unknown[]);
}

/** EAS request defaults every Green Goods work and review attestation uses. */
function attestCall(easAddress: Hex, schemaUID: Hex, recipient: Hex, data: Hex) {
  return {
    to: getAddress(easAddress) as Hex,
    value: "0" as const,
    data: encodeFunctionData({
      abi: EAS_ATTEST_ABI,
      functionName: "attest",
      args: [
        {
          schema: schemaUID,
          data: {
            recipient,
            expirationTime: 0n,
            revocable: false,
            refUID: zeroHash,
            data,
            value: 0n,
          },
        },
      ],
    }),
  };
}

/** Distributes over the envelope kinds so each input keeps its own fields. */
type EnvelopeInput<T extends UnsignedEnvelope> = T extends UnsignedEnvelope
  ? Omit<T, "version" | "easAddress" | "schemaUID" | "encodedData" | "call">
  : never;

export function buildEnvelope<T extends UnsignedEnvelope>(
  deployment: ReportingDeployment,
  input: EnvelopeInput<T>
): PublicationEnvelope {
  if (input.chainId !== deployment.chainId) {
    throw new ReportingDeploymentError("Envelope chain does not match the deployment");
  }
  const schema = input.kind === "work" ? deployment.work : deployment.review;
  const unsigned = {
    ...input,
    version: 1 as const,
    accountAddress: input.accountAddress.toLowerCase() as Hex,
    gardenAddress: input.gardenAddress.toLowerCase() as Hex,
    easAddress: deployment.easAddress.toLowerCase() as Hex,
    schemaUID: schema.schemaUID,
  } as unknown as UnsignedEnvelope;
  const encodedData = encodeSchemaData(schema.schema, schemaValues(unsigned));
  const call = attestCall(
    unsigned.easAddress,
    schema.schemaUID,
    unsigned.gardenAddress,
    encodedData
  );
  const complete = { ...unsigned, encodedData, call } as UnsignedEnvelope;
  return { ...complete, payloadDigest: envelopePayloadDigest(complete) };
}

export function envelopePayloadDigest(envelope: UnsignedEnvelope): Hex {
  const { payloadDigest: _ignored, ...body } = envelope as PublicationEnvelope;
  return reportingDigest("publication-envelope", body);
}

export interface DecodedAttest {
  schema: Hex;
  recipient: Address;
  expirationTime: bigint;
  revocable: boolean;
  refUID: Hex;
  data: Hex;
  value: bigint;
}

export function decodeAttestCall(data: Hex): DecodedAttest {
  const decoded = decodeFunctionData({ abi: EAS_ATTEST_ABI, data });
  const [request] = decoded.args;
  return { schema: request.schema, ...request.data };
}

export type EnvelopeIssue =
  | "digest_mismatch"
  | "wrong_chain"
  | "wrong_account"
  | "wrong_target"
  | "wrong_schema"
  | "wrong_recipient"
  | "nonzero_value"
  | "request_defaults"
  | "payload_mismatch";

/**
 * Independent check a signer runs before authorizing: the envelope must describe exactly one
 * zero-value `attest` to the configured EAS with Green Goods request defaults, and its calldata
 * must be what its own fields encode to.
 */
export function envelopeIssues(
  envelope: PublicationEnvelope,
  expected: { deployment: ReportingDeployment; account: Address }
): EnvelopeIssue[] {
  const issues: EnvelopeIssue[] = [];
  const { deployment } = expected;
  const schema = envelope.kind === "work" ? deployment.work : deployment.review;
  if (envelopePayloadDigest(envelope) !== envelope.payloadDigest) issues.push("digest_mismatch");
  if (envelope.chainId !== deployment.chainId) issues.push("wrong_chain");
  if (!isAddressEqual(envelope.accountAddress, expected.account)) issues.push("wrong_account");
  if (!isAddressEqual(envelope.call.to, deployment.easAddress)) issues.push("wrong_target");
  if (envelope.call.value !== "0") issues.push("nonzero_value");
  let decoded: DecodedAttest | null = null;
  try {
    decoded = decodeAttestCall(envelope.call.data);
  } catch {
    issues.push("payload_mismatch");
  }
  if (decoded) {
    if (decoded.schema !== schema.schemaUID || envelope.schemaUID !== schema.schemaUID) {
      issues.push("wrong_schema");
    }
    if (!isAddressEqual(decoded.recipient, envelope.gardenAddress)) issues.push("wrong_recipient");
    if (decoded.value !== 0n) issues.push("nonzero_value");
    if (decoded.expirationTime !== 0n || decoded.revocable || decoded.refUID !== zeroHash) {
      issues.push("request_defaults");
    }
    const rebuilt = encodeSchemaData(schema.schema, schemaValues(envelope));
    if (decoded.data !== rebuilt || envelope.encodedData !== rebuilt)
      issues.push("payload_mismatch");
  }
  return [...new Set(issues)];
}
