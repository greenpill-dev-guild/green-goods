export const PUBLIC_IMPACT_DEFAULT_PAGE_SIZE = 12;
export const PUBLIC_IMPACT_GARDEN_FETCH_CAP = 50;
export const PUBLIC_IMPACT_RECORD_FETCH_CAP = 100;
/** Certificates read per Garden; a Garden with more is reported as capped. */
export const PUBLIC_IMPACT_CERTIFICATE_FETCH_CAP = 50;

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
  /**
   * Impact Certificates in the Gardens read, counted before the record cap trims `records`;
   * `null` when a certificate read failed or a Garden had more than the per-Garden cap, so
   * the total is unknown.
   */
  certificateCount: number | null;
  status: "loading" | "empty" | "ready" | "partial" | "error";
  errorCode?: "eas_unavailable";
};

export function createPublicImpactSlice(input: {
  gardens: readonly PublicImpactGardenSource[];
  records: readonly PublicImpactEvidenceRecord[];
  page?: number;
  pageSize?: number;
  easFailed?: boolean;
  certificatesFailed?: boolean;
  /** A Garden had more certificates than `PUBLIC_IMPACT_CERTIFICATE_FETCH_CAP`. */
  certificatesCapped?: boolean;
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
  const gardenRecords = input.records.filter((record) => cappedGardenIds.has(record.gardenId));
  const scopedRecords = [...gardenRecords]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, PUBLIC_IMPACT_RECORD_FETCH_CAP);
  const certificateCount =
    input.certificatesFailed || input.certificatesCapped
      ? null
      : gardenRecords.filter((record) => record.kind === "certificate").length;

  const start = (page - 1) * pageSize;
  const pageRecords = scopedRecords.slice(start, start + pageSize);
  const sourceLimitReached =
    input.gardens.length > PUBLIC_IMPACT_GARDEN_FETCH_CAP ||
    gardenRecords.length > PUBLIC_IMPACT_RECORD_FETCH_CAP ||
    Boolean(input.certificatesCapped);
  const partialData = Boolean(input.partialData || sourceLimitReached);

  if (input.easFailed) {
    return {
      records: pageRecords,
      page,
      pageSize,
      totalFetchedRecords: scopedRecords.length,
      partialData: true,
      sourceLimitReached,
      certificateCount,
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
    certificateCount,
    status: scopedRecords.length === 0 ? "empty" : partialData ? "partial" : "ready",
  };
}
