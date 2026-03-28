import { describe, expect, it } from "vitest";
import { instructionTemplates } from "../../utils/action/templates";

describe("instructionTemplates", () => {
  it("defines waste.repair_event with the expected repair-event fields", () => {
    const template = instructionTemplates["waste.repair_event"];

    expect(template.description).toBe(
      "Document a community repair event. Track items brought vs. successfully repaired to demonstrate waste diversion, volunteer effort, and skills shared."
    );
    expect(template.uiConfig.media).toMatchObject({
      title: "Capture Repair Event Photos",
      description: "Upload before, during, and after photos from the repair event.",
      maxImageCount: 20,
      minImageCount: 2,
      required: true,
      needed: ["Before repair", "During repair", "After repair"],
      optional: [],
    });

    expect(template.uiConfig.details.title).toBe("Repair Event Details");
    expect(template.uiConfig.details.feedbackPlaceholder).toBe(
      "Notes or feedback about repair challenges, skills shared, or follow-up needs"
    );
    expect(template.uiConfig.review.title).toBe("Review Repair Event");

    const inputs = template.uiConfig.details.inputs;
    expect(inputs.map((input) => input.key)).toEqual([
      "itemsBrought",
      "itemsSuccessfullyRepaired",
      "itemsPartiallyRepaired",
      "itemsNotRepairable",
      "repairVolunteers",
      "communityMembersAttended",
      "durationMin",
      "itemCategoriesRepaired",
    ]);

    expect(inputs.find((input) => input.key === "itemsBrought")).toMatchObject({
      type: "number",
      required: true,
    });
    expect(inputs.find((input) => input.key === "repairVolunteers")).toMatchObject({
      type: "number",
      required: true,
    });
    expect(inputs.find((input) => input.key === "durationMin")).toMatchObject({
      type: "number",
      required: false,
      unit: "min",
    });
    expect(inputs.find((input) => input.key === "itemCategoriesRepaired")).toEqual({
      key: "itemCategoriesRepaired",
      title: "Item Categories Repaired",
      placeholder: "Select all categories repaired during the event",
      type: "multi-select",
      required: false,
      options: [
        "Electronics",
        "Clothing/Textiles",
        "Furniture",
        "Appliances",
        "Bikes/Vehicles",
        "Toys/Games",
        "Other",
      ],
    });
  });
});
