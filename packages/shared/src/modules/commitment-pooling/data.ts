import {
  getCommitmentActivity as realGetCommitmentActivity,
  getPoolMemberHistory as realGetPoolMemberHistory,
} from "./data-activity";
import {
  getCommitmentClaimRequests as realGetCommitmentClaimRequests,
  getCommitmentDetail as realGetCommitmentDetail,
  getCommitments as realGetCommitments,
  getCommitmentWorkAttributionsByWork as realGetCommitmentWorkAttributionsByWork,
} from "./data-commitments";
import {
  getCommitmentCycleDetail as realGetCommitmentCycleDetail,
  getCommitmentCycles as realGetCommitmentCycles,
  getCommitmentPoolDetail as realGetCommitmentPoolDetail,
  getCommitmentPools as realGetCommitmentPools,
} from "./data-pools";
import { demoAware } from "./demo/demo-gate";

export * from "./data-credit";
export * from "./data-lineage";
export * from "./data-public-pools";
export * from "./data-series";
export * from "./data-settlement";
export {
  mapClaim,
  mapCommitmentsWithCycleState,
  mapWorkAttribution,
  rowsByIds,
} from "./data-commitments";

// The reads the member's screens depend on answer from the demo world in dev
// with `?mockPooling=1`; everywhere else they are the real readers unchanged.
export const getCommitments = demoAware("getCommitments", realGetCommitments);
export const getCommitmentDetail = demoAware("getCommitmentDetail", realGetCommitmentDetail);
export const getCommitmentClaimRequests = demoAware(
  "getCommitmentClaimRequests",
  realGetCommitmentClaimRequests
);
export const getCommitmentWorkAttributionsByWork = demoAware(
  "getCommitmentWorkAttributionsByWork",
  realGetCommitmentWorkAttributionsByWork
);
export const getCommitmentPools = demoAware("getCommitmentPools", realGetCommitmentPools);
export const getCommitmentPoolDetail = demoAware(
  "getCommitmentPoolDetail",
  realGetCommitmentPoolDetail
);
export const getCommitmentCycles = demoAware("getCommitmentCycles", realGetCommitmentCycles);
export const getCommitmentCycleDetail = demoAware(
  "getCommitmentCycleDetail",
  realGetCommitmentCycleDetail
);
// Activity and member history have no fixtures; the demo world simply has none.
export const getCommitmentActivity = realGetCommitmentActivity;
export const getPoolMemberHistory = realGetPoolMemberHistory;
