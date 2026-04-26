export type AdminSheetSide = "left" | "right";

export interface AdminSheetTitleDescriptor {
  id: string;
  defaultMessage: string;
}

export interface AdminRightSheetRegistryEntry {
  id: string;
  side: "right";
  title: AdminSheetTitleDescriptor;
}

export const PROFILE_SHEET_CONTENT_ID = "profile";
export const SETTINGS_SHEET_CONTENT_ID = "settings";
export const NOTIFICATIONS_SHEET_CONTENT_ID = "notifications";

export const WORK_DETAIL_CONTENT_ID_PREFIX = "hub:work-detail:";
export const CERTIFICATION_CONTENT_ID_PREFIX = "hub:certify:";
export const HISTORY_CONTENT_ID_PREFIX = "hub:history:";
export const SUBMIT_WORK_CONTENT_ID = "hub:submit-work";
export const ACTION_CREATE_CONTENT_ID = "actions:create";
export const ACTION_DETAIL_CONTENT_ID_PREFIX = "actions:detail:";
export const ACTION_EDIT_CONTENT_ID_PREFIX = "actions:edit:";

export const ADMIN_RIGHT_SHEET_REGISTRY = {
  [PROFILE_SHEET_CONTENT_ID]: {
    id: PROFILE_SHEET_CONTENT_ID,
    side: "right",
    title: { id: "cockpit.profile.title", defaultMessage: "Profile" },
  },
  [SETTINGS_SHEET_CONTENT_ID]: {
    id: SETTINGS_SHEET_CONTENT_ID,
    side: "right",
    title: { id: "cockpit.settings.title", defaultMessage: "Settings" },
  },
  [NOTIFICATIONS_SHEET_CONTENT_ID]: {
    id: NOTIFICATIONS_SHEET_CONTENT_ID,
    side: "right",
    title: { id: "cockpit.notifications.title", defaultMessage: "Notifications" },
  },
} satisfies Record<string, AdminRightSheetRegistryEntry>;

export type AdminRightSheetContentId = keyof typeof ADMIN_RIGHT_SHEET_REGISTRY;

interface ExactRouteSheetRegistryEntry {
  kind: "exact";
  id: string;
  side: AdminSheetSide;
  isRestorable: (pathname: string) => boolean;
}

interface PrefixRouteSheetRegistryEntry {
  kind: "prefix";
  prefix: string;
  side: AdminSheetSide;
  parse: (contentId: string | null) => string | null;
  isRestorable: (value: string, pathname: string) => boolean;
}

type RouteSheetRegistryEntry = ExactRouteSheetRegistryEntry | PrefixRouteSheetRegistryEntry;

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

export function toActionDetailContentId(actionId: string) {
  return `${ACTION_DETAIL_CONTENT_ID_PREFIX}${actionId}`;
}

export function parseActionDetailContentId(contentId: string | null) {
  if (!contentId?.startsWith(ACTION_DETAIL_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(ACTION_DETAIL_CONTENT_ID_PREFIX.length) || null;
}

export function toActionEditContentId(actionId: string) {
  return `${ACTION_EDIT_CONTENT_ID_PREFIX}${actionId}`;
}

export function parseActionEditContentId(contentId: string | null) {
  if (!contentId?.startsWith(ACTION_EDIT_CONTENT_ID_PREFIX)) return null;
  return contentId.slice(ACTION_EDIT_CONTENT_ID_PREFIX.length) || null;
}

const ADMIN_ROUTE_SHEET_REGISTRY: RouteSheetRegistryEntry[] = [
  {
    kind: "exact",
    id: SUBMIT_WORK_CONTENT_ID,
    side: "left",
    isRestorable: (pathname) => pathname === "/hub/work/submit",
  },
  {
    kind: "prefix",
    prefix: WORK_DETAIL_CONTENT_ID_PREFIX,
    side: "left",
    parse: parseWorkDetailContentId,
    isRestorable: (workId, pathname) =>
      pathname.startsWith("/hub/work/") && getLastPathSegment(pathname) === workId,
  },
  {
    kind: "prefix",
    prefix: CERTIFICATION_CONTENT_ID_PREFIX,
    side: "left",
    parse: parseCertificationContentId,
    isRestorable: (assessmentId, pathname) =>
      pathname.startsWith("/hub/certify/") && getLastPathSegment(pathname) === assessmentId,
  },
  {
    kind: "prefix",
    prefix: HISTORY_CONTENT_ID_PREFIX,
    side: "left",
    parse: parseHistoryContentId,
    isRestorable: (historyId, pathname) =>
      pathname.startsWith("/hub/history/") && getLastPathSegment(pathname) === historyId,
  },
  {
    kind: "exact",
    id: ACTION_CREATE_CONTENT_ID,
    side: "left",
    isRestorable: (pathname) => pathname === "/actions/create",
  },
  {
    kind: "prefix",
    prefix: ACTION_DETAIL_CONTENT_ID_PREFIX,
    side: "left",
    parse: parseActionDetailContentId,
    isRestorable: (actionId, pathname) => getActionRouteSegment(pathname) === actionId,
  },
  {
    kind: "prefix",
    prefix: ACTION_EDIT_CONTENT_ID_PREFIX,
    side: "left",
    parse: parseActionEditContentId,
    isRestorable: (actionId, pathname) => getActionEditRouteSegment(pathname) === actionId,
  },
];

export function getRightSheetRegistryEntry(
  contentId: string | null
): AdminRightSheetRegistryEntry | null {
  if (!contentId) return null;
  return ADMIN_RIGHT_SHEET_REGISTRY[contentId as AdminRightSheetContentId] ?? null;
}

export function isRightSheetContentId(
  contentId: string | null
): contentId is AdminRightSheetContentId {
  return Boolean(getRightSheetRegistryEntry(contentId));
}

export function isRouteSheetContentId(contentId: string | null) {
  return Boolean(getRouteSheetRegistryEntry(contentId));
}

export function isActionsRouteSheetContentId(contentId: string | null) {
  return Boolean(
    contentId === ACTION_CREATE_CONTENT_ID ||
      contentId?.startsWith(ACTION_DETAIL_CONTENT_ID_PREFIX) ||
      contentId?.startsWith(ACTION_EDIT_CONTENT_ID_PREFIX)
  );
}

export function getRouteSheetSide(contentId: string | null): AdminSheetSide | null {
  return getRouteSheetRegistryEntry(contentId)?.entry.side ?? null;
}

export function isRouteSheetRestorable(contentId: string | null, pathname: string) {
  const resolved = getRouteSheetRegistryEntry(contentId);
  if (!resolved) return true;

  const { entry, value } = resolved;
  if (entry.kind === "exact") {
    return entry.isRestorable(pathname);
  }

  return value ? entry.isRestorable(value, pathname) : false;
}

function getRouteSheetRegistryEntry(contentId: string | null): {
  entry: RouteSheetRegistryEntry;
  value: string | null;
} | null {
  if (!contentId) return null;

  for (const entry of ADMIN_ROUTE_SHEET_REGISTRY) {
    if (entry.kind === "exact" && contentId === entry.id) {
      return { entry, value: contentId };
    }

    if (entry.kind === "prefix" && contentId.startsWith(entry.prefix)) {
      const value = entry.parse(contentId);
      if (value) {
        return { entry, value };
      }
    }
  }

  return null;
}

function getLastPathSegment(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function decodePathSegment(segment: string | undefined) {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getActionRouteSegment(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "actions") return "";
  if (segments[1] === "create") return "";
  return decodePathSegment(segments[1]);
}

function getActionEditRouteSegment(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 3 || segments[0] !== "actions" || segments[2] !== "edit") return "";
  return decodePathSegment(segments[1]);
}
