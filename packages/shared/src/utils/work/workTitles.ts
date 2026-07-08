const GENERATED_WORK_TITLE_TIMESTAMP_RE =
  /\s+-\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export interface ResolveWorkSubmissionTitleInput {
  draftTitle?: string | null;
  actionTitle?: string | null;
  actionUID?: number | null;
  fallback?: string;
}

export function stripGeneratedWorkTitleTimestamp(
  title: string,
  actionTitle?: string | null
): string {
  const trimmedTitle = title.trim();
  const match = trimmedTitle.match(GENERATED_WORK_TITLE_TIMESTAMP_RE);
  if (!match || match.index === undefined) return trimmedTitle;

  const titleWithoutTimestamp = trimmedTitle.slice(0, match.index).trim();
  if (!titleWithoutTimestamp) return trimmedTitle;

  const normalizedActionTitle = actionTitle?.trim();
  if (
    normalizedActionTitle &&
    titleWithoutTimestamp.toLowerCase() !== normalizedActionTitle.toLowerCase()
  ) {
    return trimmedTitle;
  }

  return titleWithoutTimestamp;
}

export function resolveWorkSubmissionTitle({
  draftTitle,
  actionTitle,
  actionUID,
  fallback,
}: ResolveWorkSubmissionTitleInput): string {
  const cleanedDraftTitle = draftTitle
    ? stripGeneratedWorkTitleTimestamp(draftTitle, actionTitle)
    : "";
  if (cleanedDraftTitle) return cleanedDraftTitle;

  const cleanedActionTitle = actionTitle ? stripGeneratedWorkTitleTimestamp(actionTitle) : "";
  if (cleanedActionTitle) return cleanedActionTitle;

  if (typeof actionUID === "number" && Number.isFinite(actionUID)) {
    return `Action ${actionUID}`;
  }

  return fallback ?? "Untitled Work";
}
