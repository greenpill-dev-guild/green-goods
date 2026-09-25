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

/** What `getActionTitle` returned when the action was missing, before callers passed their own fallback. */
const UNKNOWN_ACTION_TITLE = "Unknown Action";

/** A title the app generated because it could not find the action's own. */
export function isPlaceholderWorkTitle(title: string, actionUID?: number | null): boolean {
  const trimmed = title.trim();
  return (
    trimmed === UNKNOWN_ACTION_TITLE ||
    (typeof actionUID === "number" && trimmed === `Action ${actionUID}`)
  );
}

/**
 * The title worth keeping: the draft's own, else the action's. A placeholder
 * is never one; `undefined` means the real title is not known yet.
 */
export function resolveKnownWorkTitle({
  draftTitle,
  actionTitle,
  actionUID,
}: ResolveWorkSubmissionTitleInput): string | undefined {
  const cleanedDraftTitle = draftTitle
    ? stripGeneratedWorkTitleTimestamp(draftTitle, actionTitle)
    : "";
  if (cleanedDraftTitle && !isPlaceholderWorkTitle(cleanedDraftTitle, actionUID))
    return cleanedDraftTitle;

  const cleanedActionTitle = actionTitle ? stripGeneratedWorkTitleTimestamp(actionTitle) : "";
  if (cleanedActionTitle && !isPlaceholderWorkTitle(cleanedActionTitle, actionUID))
    return cleanedActionTitle;

  return undefined;
}

/** A generated timestamp at the end of a title; older submissions appended one or two. */
const TRAILING_GENERATED_TIMESTAMP_RE =
  /(?:^|\s+)[-–—]\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
/** The name `resolveWorkSubmissionTitle` gives work whose action it could not find. */
const GENERATED_ACTION_NAME_RE = /^Action \d+$/;

/**
 * The title to show for a work: every generated timestamp stripped, and
 * `fallback` when nothing real is left. Display only; submission paths keep
 * `resolveWorkSubmissionTitle`, which never drops a title it cannot match.
 */
export function toWorkDisplayTitle(title: string | null | undefined, fallback: string): string {
  let display = title?.trim() ?? "";
  while (TRAILING_GENERATED_TIMESTAMP_RE.test(display)) {
    display = display.replace(TRAILING_GENERATED_TIMESTAMP_RE, "").trim();
  }
  const generated =
    !display || isPlaceholderWorkTitle(display) || GENERATED_ACTION_NAME_RE.test(display);
  return generated ? fallback : display;
}

export function resolveWorkSubmissionTitle(input: ResolveWorkSubmissionTitleInput): string {
  const known = resolveKnownWorkTitle(input);
  if (known) return known;

  if (typeof input.actionUID === "number" && Number.isFinite(input.actionUID)) {
    return `Action ${input.actionUID}`;
  }

  return input.fallback ?? "Untitled Work";
}
