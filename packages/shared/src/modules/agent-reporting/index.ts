// Agent reporting domain: server-safe, framework-free rules shared by the Agent and browser.
// Browser transport and wallet adapters live in their own leaf exports.
export type {
  ActionDefinition,
  ActionDefinitionSnapshot,
  ActionDefinitionSource,
  ActionEligibilityIssue,
} from "./action-snapshot";
export {
  ActionSnapshotError,
  actionEligibilityIssues,
  parseActionSnapshot,
  serializeActionSnapshot,
  snapshotActionDefinition,
} from "./action-snapshot";
export type { ReportingDigestKind } from "./canonical";
export { CanonicalEncodingError, canonicalJson, reportingDigest } from "./canonical";
export type {
  DecodedAttest,
  EnvelopeIssue,
  PublicationEnvelope,
  ReportingDeployment,
  ReviewAttestationFields,
  ReviewEnvelope,
  UnsignedEnvelope,
  WorkAttestationFields,
  WorkEnvelope,
} from "./envelope";
export {
  buildEnvelope,
  decodeAttestCall,
  EAS_ATTEST_ABI,
  encodeSchemaData,
  envelopeIssues,
  envelopePayloadDigest,
  REPORTING_CHAIN_IDS,
  ReportingDeploymentError,
  resolveReportingDeployment,
} from "./envelope";
export type { AnswerFailure, AnswerResult, DetailCheck } from "./field-answers";
export {
  MAX_DETAIL_TEXT_LENGTH,
  pageChoices,
  parseDurationAnswer,
  parseFieldAnswer,
  parseNumberAnswer,
  validateDetailValue,
} from "./field-answers";
export type {
  DescriptorIssue,
  GrantPolicy,
  GrantPolicyIssue,
  GrantPurpose,
  PermissionModuleEntry,
  RevocationDescriptor,
} from "./grants";
export {
  GRANT_LIMITS,
  grantPolicyDigest,
  grantPolicyIssues,
  isDelegationAvailable,
  revocationDescriptorIssues,
  VERIFIED_PERMISSION_MODULES,
} from "./grants";
export type {
  ChangeOutcome,
  ChangeRejectionReason,
  DetailValue,
  EvidenceItem,
  FactKind,
  FactOrigin,
  FieldChange,
  FieldConflict,
  FieldProvenance,
  GardenRef,
  ReportContent,
  ReportField,
  SourceRef,
} from "./report";
export {
  applyReportChanges,
  emptyReport,
  findInput,
  MAX_FEEDBACK_LENGTH,
  MAX_TIME_SPENT_MINUTES,
  MAX_TITLE_LENGTH,
  reconcileDetailsWithAction,
  reportContentDigest,
} from "./report";
export type { ReportRequirement, ReportSummary } from "./report-summary";
export {
  buildReportSummary,
  minimumEvidence,
  outstandingRequirements,
  ReportNotReadyError,
  reportSummaryDigest,
} from "./report-summary";
export type { ReviewContent, ReviewIssue, ReviewRequirement, ReviewSummary } from "./review";
export {
  MAX_REVIEW_FEEDBACK_LENGTH,
  newReview,
  reviewContentDigest,
  reviewIssues,
  reviewRequirements,
  reviewSummaryDigest,
  toApprovalDraft,
  withConfidence,
  withDecision,
  withFeedback,
} from "./review";
export type {
  AccessResponse,
  AttemptOutcome,
  AttemptResponse,
  ChallengeResponse,
  OperationView,
  OutcomeRequest,
  ReportingErrorCode,
  ResourceView,
} from "./api-contract";
export {
  accessResponseSchema,
  attemptRequestSchema,
  attemptResponseSchema,
  challengeCreateRequestSchema,
  challengeResponseSchema,
  envelopeSchema,
  operationCreateRequestSchema,
  outcomeRequestSchema,
  outcomeResponseSchema,
  proofRequestSchema,
  REPORTING_ERROR_CODES,
  resourceViewSchema,
} from "./api-contract";
export type { ReportingProofFields, ReportingPurpose } from "./proof";
export { buildReportingProofMessage, REPORTING_PROOF_AUDIENCE } from "./proof";
