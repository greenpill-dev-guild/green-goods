import type { ActionInstructionConfig } from "../../../types/domain";

export const agroSiteSpeciesPlan: ActionInstructionConfig = {
  description: "Document baseline site conditions and plan the species mix for a planting area.",
  uiConfig: {
    media: {
      title: "Capture Baseline Photos",
      description: "Take photos of the site showing current conditions, terrain, and vegetation.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Site overview", "Terrain/soil"],
      optional: ["Existing vegetation", "Water access"],
    },
    details: {
      title: "Site & Species Plan Details",
      description: "Provide details about the planned planting site and species selection.",
      feedbackPlaceholder:
        "Notes about soil quality, water access, or site-specific considerations",
      inputs: [
        {
          key: "plannedSeedlings",
          title: "Planned Seedlings",
          placeholder: "Enter planned number of seedlings",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "siteAreaBand",
          title: "Site Area",
          placeholder: "Select approximate site area",
          type: "band",
          required: true,
          options: [],
          bands: [
            "< 100 m\u00b2",
            "100-500 m\u00b2",
            "500-2000 m\u00b2",
            "2000-10000 m\u00b2",
            "> 1 hectare",
          ],
        },
        {
          key: "speciesTags",
          title: "Species Selected",
          placeholder: "Select planned species",
          type: "multi-select",
          required: true,
          options: [
            "Native hardwood",
            "Fruit tree",
            "Nitrogen fixer",
            "Timber species",
            "Medicinal",
            "Shade tree",
            "Ornamental",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Site Plan",
      description: "Review the site assessment and species plan before submitting.",
    },
  },
};

export const agroPlantingEvent: ActionInstructionConfig = {
  description:
    "Document a planting event including number of seedlings planted, species, participants involved, and planting method used.",
  uiConfig: {
    media: {
      title: "Capture Planting Photos",
      description:
        "Take photos of the planting activity, showing seedlings, participants, and the planting site.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Planting in progress", "Planted seedlings"],
      optional: ["Participants", "Site overview"],
    },
    details: {
      title: "Planting Event Details",
      description: "Provide details about this planting event.",
      feedbackPlaceholder: "Notes about conditions, challenges, or observations during planting",
      inputs: [
        {
          key: "seedlingsPlanted",
          title: "Seedlings Planted",
          placeholder: "Enter number of seedlings planted",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "participants",
          title: "Participants",
          placeholder: "Enter number of participants",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "speciesTags",
          title: "Species Planted",
          placeholder: "Select species planted",
          type: "multi-select",
          required: true,
          options: [
            "Native hardwood",
            "Fruit tree",
            "Nitrogen fixer",
            "Timber species",
            "Medicinal",
            "Shade tree",
            "Ornamental",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Planting Event",
      description: "Review the planting event details before submitting.",
    },
  },
};

export const agroSurvivalCheck: ActionInstructionConfig = {
  description:
    "Document survival rates of planted seedlings at checkpoints. Take repeat-angle photos and record alive vs checked counts.",
  uiConfig: {
    media: {
      title: "Capture Plot Photos",
      description: "Take repeat-angle photos of the planting plots to track growth and survival.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Plot overview (same angle as previous check)"],
      optional: ["Close-up of healthy plants", "Close-up of issues"],
    },
    details: {
      title: "Survival Check Details",
      description: "Provide details about the survival check results.",
      feedbackPlaceholder: "Notes about plant health, growth patterns, or environmental factors",
      inputs: [
        {
          key: "aliveCount",
          title: "Alive Count",
          placeholder: "Enter number of surviving seedlings",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "checkedCount",
          title: "Checked Count",
          placeholder: "Enter total number of seedlings checked",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "checkpoint",
          title: "Checkpoint",
          placeholder: "Select the checkpoint timing",
          type: "select",
          required: true,
          options: ["1 month", "3 months", "6 months", "1 year", "2+ years"],
        },
      ],
    },
    review: {
      title: "Review Survival Check",
      description: "Review the survival check details before submitting.",
    },
  },
};

export const agroMaintenanceActivity: ActionInstructionConfig = {
  description:
    "Document routine garden maintenance activities including watering, weeding, mulching, fencing, and pest management.",
  uiConfig: {
    media: {
      title: "Capture Maintenance Photo",
      description: "Take a photo showing the maintenance work performed.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Maintenance work evidence"],
      optional: ["Before state", "Tools/materials used"],
    },
    details: {
      title: "Maintenance Details",
      description: "Provide details about the maintenance activity performed.",
      feedbackPlaceholder: "Notes about conditions, materials used, or observations",
      inputs: [
        {
          key: "areaMaintainedBand",
          title: "Area Maintained",
          placeholder: "Select approximate area maintained",
          type: "band",
          required: true,
          options: [],
          bands: [
            "< 50 m\u00b2",
            "50-200 m\u00b2",
            "200-1000 m\u00b2",
            "1000-5000 m\u00b2",
            "> 5000 m\u00b2",
          ],
        },
        {
          key: "activityTags",
          title: "Activities Performed",
          placeholder: "Select all maintenance activities",
          type: "multi-select",
          required: true,
          options: [
            "Watering",
            "Weeding",
            "Mulching",
            "Fencing",
            "Pest control",
            "Pruning",
            "Soil amendment",
            "Other",
          ],
        },
        {
          key: "activityCount",
          title: "Activity Count (optional)",
          placeholder: "Enter number of discrete tasks completed",
          type: "number",
          required: false,
          options: [],
        },
      ],
    },
    review: {
      title: "Review Maintenance",
      description: "Review the maintenance activity details before submitting.",
    },
  },
};

export const agroLearningReflection: ActionInstructionConfig = {
  description:
    "Capture learning insights from garden activities. A low-effort action for documenting what worked, what failed, and next steps.",
  uiConfig: {
    media: {
      title: "Optional Photo",
      description: "Optionally attach a photo related to your learning observation.",
      maxImageCount: 3,
      minImageCount: 0,
      required: false,
      needed: [],
      optional: ["Related observation photo"],
    },
    details: {
      title: "Learning Reflection Details",
      description: "Share your insights and observations from recent garden activities.",
      feedbackPlaceholder: "Describe what you learned, observed, or want to try next",
      inputs: [
        {
          key: "insightCount",
          title: "Key Insights",
          placeholder: "How many key insights?",
          type: "band",
          required: true,
          options: [],
          bands: ["1", "2", "3"],
        },
        {
          key: "lessonTags",
          title: "Lessons Learned",
          placeholder: "Select categories of lessons",
          type: "multi-select",
          required: true,
          options: [
            "What worked well",
            "What failed",
            "Unexpected result",
            "Seasonal pattern",
            "Technique improvement",
            "Community insight",
          ],
        },
        {
          key: "nextStepTags",
          title: "Next Steps",
          placeholder: "Select planned follow-up actions",
          type: "multi-select",
          required: false,
          options: [
            "Change technique",
            "Scale up",
            "Scale down",
            "Get training",
            "Share with others",
            "Research more",
            "No change needed",
          ],
        },
      ],
    },
    review: {
      title: "Review Reflection",
      description: "Review your learning reflection before submitting.",
    },
  },
};

export const agroHarvestYield: ActionInstructionConfig = {
  description:
    "Document harvest events including crop type, yield weight, harvest count, and distribution method.",
  uiConfig: {
    media: {
      title: "Capture Harvest Photos",
      description:
        "Take photos of the harvest. A scale photo with weight reading is optional but increases confidence.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Harvested produce"],
      optional: ["Scale/weight reading", "Harvest area"],
    },
    details: {
      title: "Harvest & Yield Details",
      description: "Provide details about this harvest event.",
      feedbackPlaceholder: "Notes about harvest quality, challenges, or distribution plans",
      inputs: [
        {
          key: "yieldKg",
          title: "Yield (kg)",
          placeholder: "Enter harvest yield in kilograms",
          type: "number",
          required: true,
          options: [],
          unit: "kg",
        },
        {
          key: "harvestCount",
          title: "Harvest Count",
          placeholder: "Enter number of harvest items or batches",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "cropTags",
          title: "Crop Types",
          placeholder: "Select crop types harvested",
          type: "multi-select",
          required: true,
          options: [
            "Vegetable",
            "Fruit",
            "Herb",
            "Grain",
            "Legume",
            "Root crop",
            "Leafy green",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Harvest",
      description: "Review the harvest and yield details before submitting.",
    },
  },
};
