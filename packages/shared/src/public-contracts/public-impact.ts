export const PUBLIC_IMPACT_DEFAULT_PAGE_SIZE = 12;
export const PUBLIC_IMPACT_GARDEN_FETCH_CAP = 50;
export const PUBLIC_IMPACT_RECORD_FETCH_CAP = 100;

export type PublicImpactGardenSource = {
  id: string;
  address?: string;
  name: string;
  location?: string;
  latestActivityAt?: number;
};

export type PublicImpactEvidenceKind = "assessment" | "work" | "certificate";

export type PublicImpactEvidenceRecord = {
  id: string;
  kind: PublicImpactEvidenceKind;
  gardenId: string;
  gardenName: string;
  title: string;
  domain?: string | number;
  summary?: string;
  timeWindow?: { start?: number | null; end?: number | null };
  media?: readonly string[];
  easUid?: string;
  hypercertId?: string;
  sourceAvailable: boolean;
  createdAt: number;
};

export type PublicImpactSlice = {
  records: PublicImpactEvidenceRecord[];
  page: number;
  pageSize: number;
  totalFetchedRecords: number;
  partialData: boolean;
  sourceLimitReached: boolean;
  status: "loading" | "empty" | "ready" | "partial" | "error";
  errorCode?: "eas_unavailable";
};

export function createPublicImpactSlice(input: {
  gardens: readonly PublicImpactGardenSource[];
  records: readonly PublicImpactEvidenceRecord[];
  page?: number;
  pageSize?: number;
  easFailed?: boolean;
  partialData?: boolean;
}): PublicImpactSlice {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, input.pageSize ?? PUBLIC_IMPACT_DEFAULT_PAGE_SIZE);
  const sortedGardens = [...input.gardens].sort((left, right) => {
    const activityDelta = (right.latestActivityAt ?? 0) - (left.latestActivityAt ?? 0);
    if (activityDelta !== 0) return activityDelta;
    return (left.address ?? left.id).localeCompare(right.address ?? right.id);
  });
  const cappedGardenIds = new Set(
    sortedGardens.slice(0, PUBLIC_IMPACT_GARDEN_FETCH_CAP).map((garden) => garden.id)
  );
  const scopedRecords = input.records
    .filter((record) => cappedGardenIds.has(record.gardenId))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, PUBLIC_IMPACT_RECORD_FETCH_CAP);

  const start = (page - 1) * pageSize;
  const pageRecords = scopedRecords.slice(start, start + pageSize);
  const sourceLimitReached =
    input.gardens.length > PUBLIC_IMPACT_GARDEN_FETCH_CAP ||
    input.records.filter((record) => cappedGardenIds.has(record.gardenId)).length >
      PUBLIC_IMPACT_RECORD_FETCH_CAP;
  const partialData = Boolean(input.partialData || sourceLimitReached);

  if (input.easFailed) {
    return {
      records: pageRecords,
      page,
      pageSize,
      totalFetchedRecords: scopedRecords.length,
      partialData: true,
      sourceLimitReached,
      status: "error",
      errorCode: "eas_unavailable",
    };
  }

  return {
    records: pageRecords,
    page,
    pageSize,
    totalFetchedRecords: scopedRecords.length,
    partialData,
    sourceLimitReached,
    status: scopedRecords.length === 0 ? "empty" : partialData ? "partial" : "ready",
  };
}
