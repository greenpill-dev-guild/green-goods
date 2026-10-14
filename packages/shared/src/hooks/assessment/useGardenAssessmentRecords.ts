import { type UseQueryResult, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { assessmentsKeys } from "../../config/query-keys/garden";
import {
  type AssessmentDetail,
  readAssessmentDetail,
} from "../../modules/assessment/assessment-detail";
import type { EASGardenAssessment } from "../../types/eas-responses";
import { useGardenAssessments } from "./useGardenAssessments";

/**
 * Where the read of an assessment's stored detail stands. `unavailable` means
 * the files could not be read, which is not the same as nothing recorded.
 */
export type AssessmentDetailState =
  | { status: "pending" }
  | { status: "unavailable" }
  | { status: "loaded"; value: AssessmentDetail };

/** An assessment as a reader meets it: what the attestation carries, and the detail stored beside it. */
export interface GardenAssessmentRecord {
  summary: EASGardenAssessment;
  detail: AssessmentDetailState;
}

const PENDING: AssessmentDetailState = { status: "pending" };
const UNAVAILABLE: AssessmentDetailState = { status: "unavailable" };
/** An attestation that names no config has nothing more to read. */
const NOTHING_STORED: AssessmentDetailState = {
  status: "loaded",
  value: {
    diagnosis: "",
    smartOutcomes: [],
    cynefinPhase: null,
    selectedActionUIDs: [],
    sdgTargets: [],
    evidenceCids: [],
  },
};

// Module scope, so `useQueries` keeps one combined result until a read changes.
function toDetailStates(results: UseQueryResult<AssessmentDetail>[]): AssessmentDetailState[] {
  return results.map((result) => {
    if (result.data) return { status: "loaded", value: result.data };
    // A read that has failed says so at once, and goes on saying so while it is
    // retried or read again later: a file nobody pins costs a full timeout per
    // read, and a reader already told it is unavailable is not put back on a
    // placeholder for each one.
    const hasFailed = result.failureCount > 0 || result.errorUpdateCount > 0;
    // Offline with nothing cached, the read is paused: it cannot be shown now.
    if (hasFailed || result.fetchStatus === "paused") return UNAVAILABLE;
    return PENDING;
  });
}

/**
 * A garden's assessments, newest first, each with the detail it stores on IPFS.
 * The detail reads never hold the list back, and one that fails leaves its
 * assessment on screen with the detail marked unavailable.
 *
 * A failed read is reported two ways, by what is left to show. With nothing to
 * show (no list yet, or an earlier empty one) the status is `error`: an empty
 * list from before a failed read does not show the garden has none. With
 * assessments from an earlier read the status stays `success` and
 * `refreshFailed` is set: they are worth showing, but one missing from them may
 * have been attested since, so a caller looking for it cannot call it absent.
 */
export function useGardenAssessmentRecords(gardenAddress?: string, chainId?: number) {
  const list = useGardenAssessments(gardenAddress, chainId);
  const assessments = list.data;

  const details = useQueries({
    queries: (assessments ?? []).map((assessment) => ({
      queryKey: assessmentsKeys.detail(assessment.assessmentConfigCID),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readAssessmentDetail(assessment.assessmentConfigCID, { signal }),
      enabled: Boolean(assessment.assessmentConfigCID),
      // Content-addressed: what a CID names never changes.
      staleTime: Number.POSITIVE_INFINITY,
    })),
    combine: toDetailStates,
  });

  const records = useMemo<GardenAssessmentRecord[]>(
    () =>
      (assessments ?? [])
        .map((summary, index) => ({
          summary,
          detail: summary.assessmentConfigCID ? (details[index] ?? PENDING) : NOTHING_STORED,
        }))
        .sort((a, b) => b.summary.createdAt - a.summary.createdAt),
    [assessments, details]
  );

  const hasAssessments = records.length > 0;
  const status: "pending" | "success" | "error" = hasAssessments
    ? "success"
    : list.isError
      ? "error"
      : assessments
        ? "success"
        : "pending";

  return { records, status, refreshFailed: hasAssessments && list.isError };
}
