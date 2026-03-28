import { describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  Domain: {
    SOLAR: 0,
    AGRO: 1,
    EDU: 2,
    WASTE: 3,
  },
  instructionTemplates: {
    "waste.repair_event": {
      description: "Repair event template",
      uiConfig: {
        media: {
          title: "Capture Repair Event Photos",
          description: "Upload before, during, and after photos from the repair event.",
          maxImageCount: 20,
          minImageCount: 2,
          required: true,
          needed: ["Before repair", "During repair", "After repair"],
          optional: [],
        },
        details: {
          title: "Repair Event Details",
          description:
            "Provide details about what was brought to the event, repaired, and learned.",
          feedbackPlaceholder: "Notes or feedback",
          inputs: [
            {
              key: "itemsBrought",
              title: "Items Brought",
              placeholder: "",
              type: "number",
              required: true,
              options: [],
            },
            {
              key: "itemsSuccessfullyRepaired",
              title: "Items Successfully Repaired",
              placeholder: "",
              type: "number",
              required: true,
              options: [],
            },
            {
              key: "itemsPartiallyRepaired",
              title: "Items Partially Repaired",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
            {
              key: "itemsNotRepairable",
              title: "Items Not Repairable",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
            {
              key: "repairVolunteers",
              title: "Repair Volunteers",
              placeholder: "",
              type: "number",
              required: true,
              options: [],
            },
            {
              key: "communityMembersAttended",
              title: "Community Members Attended",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
            {
              key: "durationMin",
              title: "Duration",
              placeholder: "",
              type: "number",
              required: false,
              options: [],
            },
            {
              key: "itemCategoriesRepaired",
              title: "Item Categories",
              placeholder: "",
              type: "multi-select",
              required: false,
              options: ["Electronics", "Other"],
            },
          ],
        },
        review: {
          title: "Review Repair Event",
          description: "Review the repair event details before submitting.",
        },
      },
    },
  },
}));

import { Domain } from "@green-goods/shared";
import { resolveCreateActionTemplateSelection } from "@/views/Actions/createActionTemplateSelection";

describe("resolveCreateActionTemplateSelection", () => {
  it("maps waste.repair_event to the correct slug, domain, and cloned template", () => {
    const selection = resolveCreateActionTemplateSelection("waste.repair_event");

    expect(selection).not.toBeNull();
    expect(selection).toMatchObject({
      slug: "waste.repair_event",
      domain: Domain.WASTE,
    });
    expect(selection?.instructionConfig.uiConfig.details.inputs).toHaveLength(8);
    expect(selection?.instructionConfig.uiConfig.details.inputs).not.toBe(
      resolveCreateActionTemplateSelection("waste.repair_event")?.instructionConfig.uiConfig.details
        .inputs
    );
  });

  it("returns null for unknown template slugs", () => {
    expect(resolveCreateActionTemplateSelection("waste.unknown_template")).toBeNull();
  });
});
