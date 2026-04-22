export const WORK_DETAIL_CONTENT_ID_PREFIX = "hub:work-detail:";
export const CERTIFICATION_CONTENT_ID_PREFIX = "hub:certify:";
export const HISTORY_CONTENT_ID_PREFIX = "hub:history:";
export const SUBMIT_WORK_CONTENT_ID = "hub:submit-work";

export function toWorkDetailContentId(workId: string) {
  return `${WORK_DETAIL_CONTENT_ID_PREFIX}${workId}`;
}

export function parseWorkDetailContentId(contentId: string | null) {
  if (!contentId?.startsWith(WORK_DETAIL_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(WORK_DETAIL_CONTENT_ID_PREFIX.length) || null;
}

export function toCertificationContentId(assessmentId: string) {
  return `${CERTIFICATION_CONTENT_ID_PREFIX}${assessmentId}`;
}

export function parseCertificationContentId(contentId: string | null) {
  if (!contentId?.startsWith(CERTIFICATION_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(CERTIFICATION_CONTENT_ID_PREFIX.length) || null;
}

export function toHistoryContentId(eventId: string) {
  return `${HISTORY_CONTENT_ID_PREFIX}${eventId}`;
}

export function parseHistoryContentId(contentId: string | null) {
  if (!contentId?.startsWith(HISTORY_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(HISTORY_CONTENT_ID_PREFIX.length) || null;
}

export function isRouteSheetContentId(contentId: string | null) {
  return (
    contentId === SUBMIT_WORK_CONTENT_ID ||
    Boolean(parseWorkDetailContentId(contentId)) ||
    Boolean(parseCertificationContentId(contentId))
  );
}

export function isRouteSheetRestorable(contentId: string | null, pathname: string, search: string) {
  if (!isRouteSheetContentId(contentId)) return true;

  if (contentId === SUBMIT_WORK_CONTENT_ID) {
    return pathname === "/hub/work/submit";
  }

  const params = new URLSearchParams(search);
  const legacyItemId = params.get("item");
  const leafSegment = getLastPathSegment(pathname);
  const workId = parseWorkDetailContentId(contentId);
  if (workId) {
    return (
      (pathname.startsWith("/hub/work/") && leafSegment === workId) ||
      (isHubWorkSurface(pathname) && legacyItemId === workId)
    );
  }

  const certificationId = parseCertificationContentId(contentId);
  if (certificationId) {
    return (
      (pathname.startsWith("/hub/certify/") && leafSegment === certificationId) ||
      ((pathname === "/hub/certify" || pathname.startsWith("/hub/certify/")) &&
        legacyItemId === certificationId)
    );
  }

  return true;
}

function getLastPathSegment(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isHubWorkSurface(pathname: string) {
  return (
    pathname === "/hub/work" ||
    pathname.startsWith("/hub/work/") ||
    pathname === "/hub/assess" ||
    pathname.startsWith("/hub/assess/") ||
    pathname === "/hub/history" ||
    pathname.startsWith("/hub/history/")
  );
}
