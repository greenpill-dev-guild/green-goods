// Re-export facade — preserves original import paths for consumers

export {
  getHypercertFromSdkApi,
  hydrateHypercertMetadata,
  hydrateHypercertRecords,
  getHypercertClaims,
  getGardenHypercerts,
  getHypercertById,
} from "./hypercerts-fetch";

export {
  getApprovedAttestations,
  getAttestationsByUIDs,
  type BundledAttestationInfo,
  checkAttestationsBundled,
} from "./hypercerts-attestations";

export {
  extractWorkMetadata,
  normalizeHypercertStatus,
  parseMetadataPayload,
  getHypercertMetadataFromIpfs,
  type AssessmentMetadataPrefill,
  prefillMetadataFromAssessment,
} from "./hypercerts-metadata";

export {
  domainToActionDomain,
  applyAttestationFilters,
  filterAttestationsByAssessment,
} from "./hypercerts-filters";
