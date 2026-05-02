import {
  ACTION_CREATE_CONTENT_ID,
  ACTION_CREATE_DRAFT_PATH,
  defaultTemplate,
  Domain,
  getActionsListSearch,
  canManageActionsForRole,
  resolveActionsRouteState,
  restoreCreateActionDraft,
  restoreEditActionDraft,
  serializeCreateActionDraft,
  serializeEditActionDraft,
  toActionDetailContentId,
  toActionEditContentId,
} from "@green-goods/shared";
import { describe, expect, it } from "vitest";

describe("actions workspace model", () => {
  it("preserves only shareable Actions list filters for child routes", () => {
    const search = new URLSearchParams(
      "sort=recent&domain=1&search=solar&lifecycle=active&gardenAddress=0xAAA&debug=true"
    );

    expect(getActionsListSearch(search)).toEqual({
      domain: "1",
      lifecycle: "active",
      search: "solar",
      sort: "recent",
    });
  });

  it("omits defaults and empty values from the preserved list context", () => {
    const search = new URLSearchParams("sort=default&lifecycle=all&domain=&search=");

    expect(getActionsListSearch(search)).toEqual({});
  });

  it("resolves Actions child routes to route-backed inspector content ids", () => {
    const search = new URLSearchParams("sort=recent&search=solar");

    expect(resolveActionsRouteState("/actions/create", search)).toEqual({
      kind: "create",
      actionId: null,
      contentId: ACTION_CREATE_CONTENT_ID,
      closeTo: "/actions?sort=recent&search=solar",
      listSearch: { sort: "recent", search: "solar" },
    });

    expect(resolveActionsRouteState("/actions/action%3A0xabc%2F1", search)).toEqual({
      kind: "detail",
      actionId: "action:0xabc/1",
      contentId: toActionDetailContentId("action:0xabc/1"),
      closeTo: "/actions?sort=recent&search=solar",
      listSearch: { sort: "recent", search: "solar" },
    });

    expect(resolveActionsRouteState("/actions/action%3A0xabc%2F1/edit", search)).toEqual({
      kind: "edit",
      actionId: "action:0xabc/1",
      contentId: toActionEditContentId("action:0xabc/1"),
      closeTo: "/actions?sort=recent&search=solar",
      listSearch: { sort: "recent", search: "solar" },
    });
  });

  it("serializes and restores session-scoped create action drafts", () => {
    const draft = serializeCreateActionDraft(
      {
        title: "Solar audit",
        slug: "solar.audit",
        domain: Domain.SOLAR,
        startTime: new Date("2026-01-01T12:00:00.000Z"),
        endTime: new Date("2026-02-01T12:00:00.000Z"),
        capitals: [],
        instructionConfig: defaultTemplate,
        media: [],
      },
      2
    );

    const restored = restoreCreateActionDraft(draft, ACTION_CREATE_DRAFT_PATH);

    expect(restored?.currentStep).toBe(2);
    expect(restored?.values.title).toBe("Solar audit");
    expect(restored?.values.startTime.toISOString()).toBe("2026-01-01T12:00:00.000Z");
    expect(restored?.values.media).toEqual([]);
  });

  it("serializes and restores session-scoped edit action drafts", () => {
    const draft = serializeEditActionDraft(
      {
        title: "Updated action",
        startTime: new Date("2026-03-01T12:00:00.000Z"),
        endTime: new Date("2026-04-01T12:00:00.000Z"),
      },
      defaultTemplate,
      true
    );

    const restored = restoreEditActionDraft(draft);

    expect(restored?.title).toBe("Updated action");
    expect(restored?.startTime.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(restored?.isEditingInstructions).toBe(true);
  });

  it("keeps Actions management deployer-only", () => {
    expect(canManageActionsForRole("deployer")).toBe(true);
    expect(canManageActionsForRole("operator")).toBe(false);
    expect(canManageActionsForRole("user")).toBe(false);
  });
});
