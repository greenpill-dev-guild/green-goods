import { describe, expect, it } from "vitest";
import {
  getRightSheetRegistryEntry,
  isRouteSheetRestorable,
  NOTIFICATIONS_SHEET_CONTENT_ID,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  toHistoryContentId,
  toWorkDetailContentId,
} from "@/routes/sheetRegistry";

describe("admin sheet registry", () => {
  it("registers global right sheet content", () => {
    expect(getRightSheetRegistryEntry(PROFILE_SHEET_CONTENT_ID)?.title.id).toBe(
      "cockpit.profile.title"
    );
    expect(getRightSheetRegistryEntry(SETTINGS_SHEET_CONTENT_ID)?.title.id).toBe(
      "cockpit.settings.title"
    );
    expect(getRightSheetRegistryEntry(NOTIFICATIONS_SHEET_CONTENT_ID)?.title.id).toBe(
      "cockpit.notifications.title"
    );
  });

  it("restores route-backed Hub sheets only when the path owns the sheet", () => {
    expect(isRouteSheetRestorable(toWorkDetailContentId("work-7"), "/hub/work/work-7")).toBe(true);
    expect(isRouteSheetRestorable(toWorkDetailContentId("work-7"), "/hub/work")).toBe(false);
  });

  it("does not treat legacy Hub item query state as route ownership", () => {
    expect(isRouteSheetRestorable(toHistoryContentId("event-1"), "/hub/history")).toBe(false);
  });
});
