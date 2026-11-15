import { describe, expect, it } from "vitest";
import {
  ACTION_CREATE_CONTENT_ID,
  getRightSheetRegistryEntry,
  isRouteSheetRestorable,
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  toActionDetailContentId,
  toActionEditContentId,
  toCertificationContentId,
  toWorkDetailContentId,
} from "@green-goods/shared/hooks/admin-ui/navigation/sheetRegistry";

describe("admin sheet registry", () => {
  it("registers global right sheet content", () => {
    expect(getRightSheetRegistryEntry(PROFILE_SHEET_CONTENT_ID)?.title.id).toBe(
      "hub.profile.title"
    );
    expect(getRightSheetRegistryEntry(SETTINGS_SHEET_CONTENT_ID)?.title.id).toBe(
      "hub.settings.title"
    );
    expect(getRightSheetRegistryEntry(NOTIFICATIONS_SHEET_CONTENT_ID)?.title.id).toBe(
      "hub.notifications.title"
    );
  });

  it("restores route-backed Review sheets only when the path owns the sheet", () => {
    expect(isRouteSheetRestorable(toWorkDetailContentId("work-7"), "/review/work/work-7")).toBe(
      true
    );
    expect(isRouteSheetRestorable(toWorkDetailContentId("work-7"), "/review/work")).toBe(false);
    // An assessment's record belongs to the Assessments tab's path; its old
    // address under Certify only redirects there and owns no sheet.
    const assessmentSheet = toCertificationContentId("assessment-1");
    expect(isRouteSheetRestorable(assessmentSheet, "/review/assess/assessment-1")).toBe(true);
    expect(isRouteSheetRestorable(assessmentSheet, "/review/certify/assessment-1")).toBe(false);
    expect(isRouteSheetRestorable(assessmentSheet, "/review/assess/create")).toBe(false);
  });

  it("never restores retired hub: sheet ids from stale persisted state", () => {
    expect(isRouteSheetRestorable("hub:history:event-1", "/review/history/event-1")).toBe(false);
    expect(isRouteSheetRestorable("hub:history:event-1", "/review")).toBe(false);
    // Review's ids took the review: prefix (2026-11-14); one saved before then
    // must not reopen as an unknown sheet on the path it used to own.
    expect(isRouteSheetRestorable("hub:work-detail:work-7", "/review/work/work-7")).toBe(false);
    expect(isRouteSheetRestorable("hub:submit-work", "/review/work")).toBe(false);
  });

  it("restores route-backed Actions inspectors only when the path owns the sheet", () => {
    const encodedActionPath = "/actions/action%3A0xabc%2F1";

    expect(isRouteSheetRestorable(ACTION_CREATE_CONTENT_ID, "/actions/create")).toBe(true);
    expect(isRouteSheetRestorable(ACTION_CREATE_CONTENT_ID, "/actions")).toBe(false);
    expect(
      isRouteSheetRestorable(toActionDetailContentId("action:0xabc/1"), encodedActionPath)
    ).toBe(true);
    expect(
      isRouteSheetRestorable(toActionDetailContentId("action:0xabc/1"), `${encodedActionPath}/edit`)
    ).toBe(false);
    expect(
      isRouteSheetRestorable(toActionEditContentId("action:0xabc/1"), `${encodedActionPath}/edit`)
    ).toBe(true);
  });
});
