import * as z from "zod";

/**
 * Wire contract for the browser ceremony API (`/api/messaging/*`). The Agent validates requests
 * with these schemas and the browser validates responses with them, so neither side trusts the
 * other's shape. Failures are typed and never reveal another resource.
 */
import { address, digest, hex, hexOf } from "./api-values";

export const REPORTING_ERROR_CODES = [
  "access_required",
  "stale_revision",
  "unsupported_scope",
  "dependency_unavailable",
  "outcome_unknown",
  "unavailable",
  "conflict",
  "forbidden",
  "invalid_request",
  "paused",
  "rate_limited",
] as const;

export const reportingErrorSchema = z.object({
  ok: z.literal(false),
  errorCode: z.enum(REPORTING_ERROR_CODES),
});
export type ReportingErrorCode = (typeof REPORTING_ERROR_CODES)[number];

const purposeSchema = z.enum([
  "link_account",
  "publish_work",
  "review_decision",
  "grant_reporting",
  "grant_review",
  "recovery",
]);

const proofFieldsSchema = z.object({
  purpose: purposeSchema,
  challengeId: z.string(),
  browserNonce: z.string(),
  origin: z.string(),
  chainId: z.number().int(),
  providerRealm: z.string(),
  source: z.string(),
  resourceDigest: z.string(),
  identityEpoch: z.number().int(),
  issuedAt: z.string(),
  expiresAt: z.string(),
});

export const challengeCreateRequestSchema = z.object({ requestId: z.string().min(16).max(128) });

const challengeStateSchema = z.enum([
  "issued",
  "proof_verified",
  "paired",
  "session_issued",
  "superseded",
  "expired",
  "rejected",
]);

export const challengeResponseSchema = z.object({
  ok: z.literal(true),
  challengeId: z.string(),
  csrfToken: z.string().optional(),
  state: challengeStateSchema,
  purpose: purposeSchema,
  /** Allowlisted presentation label for the originating chat, e.g. "WhatsApp". */
  channelLabel: z.string(),
  proof: proofFieldsSchema,
  pairingCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  account: address.optional(),
});

export const proofRequestSchema = z.object({
  account: address,
  signature: hex,
  factory: address.optional(),
  factoryData: hex.optional(),
});

const accessScopeSchema = z.object({
  purpose: purposeSchema,
  resourceKind: z.enum(["draft", "review", "grant", "recovery", "account"]),
  resourceId: z.string().nullable(),
  resourceRevision: z.number().int().nullable(),
});

export const accessResponseSchema = z.object({
  ok: z.literal(true),
  accessId: z.string(),
  csrfToken: z.string(),
  expiresAt: z.number().int(),
  account: address,
  accountKind: z.enum(["eoa", "kernel"]),
  scope: accessScopeSchema,
});

const envelopeCommon = {
  version: z.literal(1),
  operationId: z.string(),
  revision: z.number().int(),
  chainId: z.number().int(),
  accountAddress: address,
  gardenAddress: address,
  easAddress: address,
  schemaUID: digest,
  encodedData: hex,
  call: z.object({ to: address, data: hex, value: z.literal("0") }),
  payloadDigest: digest,
};

export const envelopeSchema = z.discriminatedUnion("kind", [
  z.object({
    ...envelopeCommon,
    kind: z.literal("work"),
    clientWorkId: z.string(),
    actionDefinitionDigest: digest,
    fields: z.object({
      actionUID: z.string(),
      title: z.string(),
      feedback: z.string(),
      metadata: z.string(),
      media: z.array(z.string()),
    }),
    media: z.array(
      z.object({ assetId: z.string(), digest: z.string(), cid: z.string(), mime: z.string() })
    ),
    metadataDigest: digest,
  }),
  z.object({
    ...envelopeCommon,
    kind: z.literal("review"),
    reviewContentDigest: digest,
    fields: z.object({
      actionUID: z.string(),
      workUID: digest,
      approved: z.boolean(),
      feedback: z.string(),
      confidence: z.number().int(),
      verificationMethod: z.number().int(),
      reviewNotesCID: z.string(),
    }),
  }),
]);

const operationViewSchema = z.object({
  operationId: z.string(),
  kind: z.enum(["work", "review"]),
  state: z.string(),
  authorizationMode: z.enum(["owner", "delegated"]).nullable(),
  attemptVersion: z.number().int(),
  envelope: envelopeSchema.nullable(),
  attempt: z
    .object({ attemptId: z.string(), attemptNumber: z.number().int(), state: z.string() })
    .nullable(),
  transactionHash: hex.nullable(),
  attestationUid: hex.nullable(),
  failureCode: z.string().nullable(),
});

const summaryLineSchema = z.object({ label: z.string(), value: z.string() });

export const resourceViewSchema = z.object({
  ok: z.literal(true),
  kind: z.enum(["draft", "review"]),
  resourceId: z.string(),
  revision: z.number().int(),
  state: z.string(),
  gardenLabel: z.string(),
  title: z.string(),
  lines: z.array(summaryLineSchema),
  evidence: z.array(z.object({ assetId: z.string(), mime: z.string(), digest: z.string() })),
  summaryDigest: digest.nullable(),
  operation: operationViewSchema.nullable(),
});

export const operationCreateRequestSchema = z.object({
  resourceId: z.string(),
  expectedRevision: z.number().int(),
  summaryDigest: digest,
});

export const attemptRequestSchema = z.object({
  expectedAttemptVersion: z.number().int().min(0),
  payloadDigest: digest,
  idempotencyKey: z.string().min(8).max(128),
});

export const attemptResponseSchema = z.object({
  ok: z.literal(true),
  attemptId: z.string(),
  attemptNumber: z.number().int(),
  permitVersion: z.number().int(),
  payloadDigest: digest,
});

const outcomeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("broadcast"),
    transactionHash: digest.optional(),
    userOperationHash: digest.optional(),
  }),
  z.object({ kind: z.literal("rejected_before_send"), reason: z.string().max(64) }),
  z.object({ kind: z.literal("preparation_failed"), reason: z.string().max(64) }),
  z.object({
    kind: z.literal("uncertain"),
    reason: z.string().max(64),
    transactionHash: digest.optional(),
    userOperationHash: digest.optional(),
  }),
]);

export const outcomeRequestSchema = z.object({
  attemptId: z.string(),
  idempotencyKey: z.string().min(8).max(128),
  payloadDigest: digest,
  outcome: outcomeSchema,
});

export const operationResponseSchema = z.object({
  ok: z.literal(true),
  operation: operationViewSchema,
});

export const recoveryStepSchema = z.object({
  ok: z.literal(true),
  state: z.enum([
    "started",
    "account_verified",
    "channel_verified",
    "confirmed",
    "applied",
    "expired",
    "failed",
  ]),
  account: address.nullable(),
});

export const outcomeResponseSchema = z.object({
  ok: z.literal(true),
  operationState: z.string(),
  attemptState: z.string(),
});

export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;
export type AccessResponse = z.infer<typeof accessResponseSchema>;
export type ResourceView = z.infer<typeof resourceViewSchema>;
export type OperationView = z.infer<typeof operationViewSchema>;
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;
export type OutcomeRequest = z.infer<typeof outcomeRequestSchema>;
export type AttemptOutcome = z.infer<typeof outcomeSchema>;
export type RecoveryStep = z.infer<typeof recoveryStepSchema>;

const grantPolicySchema = z.object({
  version: z.literal(1),
  purpose: z.enum(["reporting", "review"]),
  chainId: z.number().int(),
  account: address,
  gardenAddress: address,
  easAddress: address,
  schemaUID: digest,
  signerAddress: address,
  moduleRef: z.string(),
  validAfter: z.number().int(),
  validUntil: z.number().int(),
  maxSubmissions: z.number().int().min(1).max(5),
  gasCap: z.number().int().positive(),
  gasCostCapWei: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .optional(),
  approvedPaymaster: address.optional(),
  singleCallPolicy: address.optional(),
});
export const grantResponseSchema = z.object({
  ok: z.literal(true),
  grant: z.object({
    grantId: z.string(),
    gardenLabel: z.string().optional(),
    purpose: z.enum(["reporting", "review"]),
    state: z.string(),
    version: z.number().int(),
    policy: grantPolicySchema,
    policyDigest: digest,
    permissionId: hex.nullable(),
    submissionsUsed: z.number().int(),
    revocationDescriptor: z
      .object({
        version: z.literal(1),
        chainId: z.number().int(),
        account: address,
        kernelVersion: z.literal("0.3.1"),
        entryPointVersion: z.literal("0.7"),
        moduleRef: z.string(),
        validatorAddress: address,
        validatorCodeHash: digest,
        permissionId: hexOf(/^0x[0-9a-fA-F]{8}$/, "Expected permission ID"),
        signerAddress: address,
        purpose: z.enum(["reporting", "review"]),
        gardenAddress: address,
        validUntil: z.number().int().positive(),
        policyDigest: digest,
      })
      .nullable(),
  }),
});
export type GrantView = z.infer<typeof grantResponseSchema>["grant"];

export const grantActivationRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    policyDigest: digest,
  })
  .strict();
export const grantActivationResponseSchema = z.object({
  ok: z.literal(true),
  resource: resourceViewSchema,
});
export {
  grantActivationOperationSchema,
  grantActivationSignatureRequestSchema,
  grantActivationSignatureResponseSchema,
  type GrantActivationOperation,
  type GrantActivationSignatureRequest,
} from "./activation-api-contract";
