import { greenGoodsIndexer } from "../data/graphql-client";
import { demoAware } from "./demo/demo-gate";
import { createCommitmentPoolingReadRepository } from "./read-repository";

export {
  createCommitmentPoolingReadRepository,
  type CommitmentPoolingReadRepository,
} from "./read-repository";

const defaultRepository = createCommitmentPoolingReadRepository(greenGoodsIndexer);

export {
  getLinkedWorkUIDs,
  getViewerConfirmedCommitmentIds,
  mapClaim,
  mapCommitmentsWithCycleState,
  mapWorkAttribution,
  rowsByIds,
} from "./data-commitments";
export * from "./data-credit";
export * from "./data-lineage";
export * from "./data-public-pools";
export * from "./data-series";
export * from "./data-settlement";

// The reads the member's screens depend on answer from the demo world in dev
// with `?mockPooling=1`; everywhere else they are the real readers unchanged.
export const getCommitments = demoAware("getCommitments", defaultRepository.getCommitments);
export const getCommitmentDetail = demoAware(
  "getCommitmentDetail",
  defaultRepository.getCommitmentDetail
);
export const getCommitmentClaimRequests = demoAware(
  "getCommitmentClaimRequests",
  defaultRepository.getCommitmentClaimRequests
);
export const getCommitmentWorkAttributionsByWork = demoAware(
  "getCommitmentWorkAttributionsByWork",
  defaultRepository.getCommitmentWorkAttributionsByWork
);
export const getCommitmentPools = demoAware(
  "getCommitmentPools",
  defaultRepository.getCommitmentPools
);
export const getCommitmentPoolDetail = demoAware(
  "getCommitmentPoolDetail",
  defaultRepository.getCommitmentPoolDetail
);
export const getCommitmentCycles = demoAware(
  "getCommitmentCycles",
  defaultRepository.getCommitmentCycles
);
export const getCommitmentCycleDetail = demoAware(
  "getCommitmentCycleDetail",
  defaultRepository.getCommitmentCycleDetail
);
// Activity, member history and the steward console reads have no fixtures; the
// demo world simply has none. The console is an operator surface, not one of
// the member screens `?mockPooling=1` stands in for.
export const getCommitmentActivity = defaultRepository.getCommitmentActivity;
export const getPoolMemberHistory = defaultRepository.getPoolMemberHistory;
export const getPoolClaimRequests = defaultRepository.getPoolClaimRequests;
export const getFallbackConfirmationCandidates =
  defaultRepository.getFallbackConfirmationCandidates;
