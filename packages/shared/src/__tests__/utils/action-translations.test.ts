import { describe, expect, it } from "vitest";
import type { Action, ActionInstructionConfig } from "../../types/domain";
import { Domain } from "../../types/domain";
import {
  ACTION_INSTRUCTIONS_SCHEMA_VERSION,
  buildActionInstructionsV2,
  createActionTranslationDraft,
  getActionSourceHash,
  localizeAction,
  normalizeActionTranslations,
} from "../../utils/action/translations";

const instructionConfig: ActionInstructionConfig = {
  description: "Plant native trees in the garden.",
  uiConfig: {
    media: {
      title: "Upload media",
      description: "Add clear photos of the planted trees.",
      maxImageCount: 4,
      minImageCount: 1,
      required: true,
      needed: ["Photo of planting area"],
      optional: ["Receipt for materials"],
    },
    details: {
      title: "Tree details",
      description: "Tell us what was planted.",
      feedbackPlaceholder: "Share observations",
      inputs: [
        {
          key: "soilType",
          title: "Soil type",
          placeholder: "Choose soil",
          type: "select",
          required: true,
          options: ["clay", "loam"],
        },
        {
          key: "impactBand",
          title: "Impact band",
          placeholder: "Choose range",
          type: "band",
          required: false,
          options: [],
          bands: ["low", "high"],
        },
      ],
    },
    review: {
      title: "Review work",
      description: "Check your details before submitting.",
    },
  },
};

const sourceHash = getActionSourceHash("Plant trees", instructionConfig);

function createAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    slug: "agro.plant_trees",
    title: "Plant trees",
    description: instructionConfig.description,
    instructions: "ipfs://instructions",
    capitals: [],
    media: [],
    domain: Domain.AGRO,
    startTime: Date.now() - 1_000,
    endTime: Date.now() + 1_000,
    createdAt: Date.now(),
    inputs: instructionConfig.uiConfig.details.inputs,
    mediaInfo: instructionConfig.uiConfig.media,
    details: instructionConfig.uiConfig.details,
    review: instructionConfig.uiConfig.review,
    ...overrides,
  };
}

describe("action translations", () => {
  it("localizes reviewed display fields while preserving canonical input structure", () => {
    const action = createAction({
      translations: {
        es: {
          status: "reviewed",
          sourceHash,
          data: {
            title: "Plantar árboles",
            description: "Planta árboles nativos en el jardín.",
            uiConfig: {
              details: {
                title: "Detalles de árboles",
                inputs: [
                  {
                    key: "soilType",
                    title: "Tipo de suelo",
                    placeholder: "Elige suelo",
                    options: {
                      clay: "Arcilla",
                      loam: "Franco",
                    },
                  },
                  {
                    key: "impactBand",
                    bands: {
                      low: "Bajo",
                      high: "Alto",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    const localized = localizeAction(action, "es");

    expect(localized.title).toBe("Plantar árboles");
    expect(localized.description).toBe("Planta árboles nativos en el jardín.");
    expect(localized.details?.title).toBe("Detalles de árboles");
    expect(localized.inputs[0]).toMatchObject({
      key: "soilType",
      type: "select",
      title: "Tipo de suelo",
      placeholder: "Elige suelo",
      options: ["clay", "loam"],
      optionLabels: {
        clay: "Arcilla",
        loam: "Franco",
      },
    });
    expect(localized.inputs[1]).toMatchObject({
      key: "impactBand",
      type: "band",
      bands: ["low", "high"],
      bandLabels: {
        low: "Bajo",
        high: "Alto",
      },
    });
  });

  it("excludes draft and stale translations from runtime display", () => {
    const action = createAction({
      translations: {
        es: {
          status: "draft",
          sourceHash,
          data: { title: "Borrador" },
        },
        pt: {
          status: "stale",
          sourceHash: "old-source",
          data: { title: "Obsoleto" },
        },
      },
    });

    expect(localizeAction(action, "es").title).toBe("Plant trees");
    expect(localizeAction(action, "pt").title).toBe("Plant trees");
  });

  it("falls back to English per missing translated field", () => {
    const action = createAction({
      translations: {
        es: {
          status: "reviewed",
          sourceHash,
          data: {
            title: "Plantar árboles",
            uiConfig: {
              media: {
                needed: ["Foto del área de siembra"],
              },
            },
          },
        },
      },
    });

    const localized = localizeAction(action, "es");

    expect(localized.title).toBe("Plantar árboles");
    expect(localized.description).toBe("Plant native trees in the garden.");
    expect(localized.mediaInfo?.needed).toEqual(["Foto del área de siembra"]);
    expect(localized.mediaInfo?.optional).toEqual(["Receipt for materials"]);
  });

  it("normalizes v1-like metadata as English-only and builds action_instructions_v2", () => {
    expect(normalizeActionTranslations(undefined)).toEqual({});

    const v2 = buildActionInstructionsV2("Plant trees", instructionConfig, {
      es: {
        status: "reviewed",
        sourceHash,
        data: { title: "Plantar árboles" },
      },
    });

    expect(v2.schemaVersion).toBe(ACTION_INSTRUCTIONS_SCHEMA_VERSION);
    expect(v2.defaultLocale).toBe("en");
    expect(v2.translations?.es?.status).toBe("reviewed");
    expect(v2.uiConfig.details.inputs[0].key).toBe("soilType");
  });

  it("marks reviewed translations stale when the English source changes", () => {
    const v2 = buildActionInstructionsV2("Plant native trees", instructionConfig, {
      es: {
        status: "reviewed",
        sourceHash,
        data: { title: "Plantar árboles" },
      },
    });

    expect(v2.translations?.es?.status).toBe("stale");
  });

  it("generates draft translations without translating structural fields", async () => {
    const draft = await createActionTranslationDraft(
      "Plant trees",
      instructionConfig,
      "es",
      async (text, locale) => `${locale}:${text}`
    );

    expect(draft.status).toBe("draft");
    expect(draft.data.title).toBe("es:Plant trees");
    expect(draft.data.uiConfig?.details?.inputs?.[0]).toMatchObject({
      key: "soilType",
      title: "es:Soil type",
      placeholder: "es:Choose soil",
      options: {
        clay: "es:clay",
        loam: "es:loam",
      },
    });
  });
});
