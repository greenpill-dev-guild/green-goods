import type { ActionInstructionConfig } from "../../../types/domain";

export const wasteSiteAssessment: ActionInstructionConfig = {
  description:
    "Document the baseline condition of a waste site before cleanup. Record site size, waste severity level, and waste types present.",
  uiConfig: {
    media: {
      title: "Capture Before Photos",
      description: "Take photos showing the current waste conditions at the site.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Site overview showing waste"],
      optional: ["Close-up of waste types", "Access points"],
    },
    details: {
      title: "Site Assessment Details",
      description: "Provide details about the waste site conditions.",
      feedbackPlaceholder: "Notes about accessibility, hazards, or environmental concerns",
      inputs: [
        {
          key: "siteSizeBand",
          title: "Site Size",
          placeholder: "Select approximate site size",
          type: "band",
          required: true,
          options: [],
          bands: [
            "Small (< 50 m\u00b2)",
            "Medium (50-200 m\u00b2)",
            "Large (200-1000 m\u00b2)",
            "Very Large (> 1000 m\u00b2)",
          ],
        },
        {
          key: "wasteLevel",
          title: "Waste Severity",
          placeholder: "Select waste severity level",
          type: "select",
          required: true,
          options: ["Low", "Medium", "High"],
        },
        {
          key: "wasteTypeTags",
          title: "Waste Types Present",
          placeholder: "Select all waste types observed",
          type: "multi-select",
          required: true,
          options: [
            "Plastic",
            "Metal",
            "Glass",
            "Paper/cardboard",
            "Organic",
            "Textile",
            "E-waste",
            "Hazardous",
            "Construction debris",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Site Assessment",
      description: "Review the site assessment details before submitting.",
    },
  },
};

export const wasteCleanupEvent: ActionInstructionConfig = {
  description:
    "Document a waste cleanup event including participants, duration, amount removed, and methods used.",
  uiConfig: {
    media: {
      title: "Capture Before/After Photos",
      description: "Take photos showing the site before and after cleanup.",
      maxImageCount: 8,
      minImageCount: 2,
      required: true,
      needed: ["Before cleanup", "After cleanup"],
      optional: ["Collected waste", "Participants"],
    },
    details: {
      title: "Cleanup Event Details",
      description: "Provide details about the cleanup event.",
      feedbackPlaceholder: "Notes about challenges, community response, or follow-up needs",
      inputs: [
        {
          key: "participants",
          title: "Participants",
          placeholder: "Enter number of participants",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "durationMin",
          title: "Duration (min)",
          placeholder: "Enter cleanup duration in minutes",
          type: "number",
          required: true,
          options: [],
          unit: "min",
        },
        {
          key: "amountRemoved",
          title: "Amount Removed",
          placeholder: "Enter amount of waste removed",
          type: "number",
          required: true,
          options: [],
        },
      ],
    },
    review: {
      title: "Review Cleanup Event",
      description: "Review the cleanup event details before submitting.",
    },
  },
};

export const wasteSortingBreakdown: ActionInstructionConfig = {
  description: "Document waste sorting results with per-category weight breakdown.",
  uiConfig: {
    media: {
      title: "Capture Sorted Piles Photo",
      description: "Take a photo showing the sorted waste categories.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Sorted waste categories"],
      optional: ["Scale reading", "Sorting process"],
    },
    details: {
      title: "Sorting Breakdown Details",
      description: "Provide the total weight and per-category breakdown.",
      feedbackPlaceholder:
        "Notes about contamination levels, unusual materials, or sorting challenges",
      inputs: [
        {
          key: "totalAmountKg",
          title: "Total Amount (kg)",
          placeholder: "Enter total sorted weight in kilograms",
          type: "number",
          required: true,
          options: [],
          unit: "kg",
        },
        {
          key: "categoryBreakdown",
          title: "Category Breakdown",
          placeholder: "Add each waste category and its weight",
          type: "repeater",
          required: true,
          options: [],
          repeaterFields: [
            {
              key: "category",
              title: "Category",
              placeholder: "Select waste category",
              type: "select",
              required: true,
              options: [
                "Plastic",
                "Metal",
                "Glass",
                "Paper/cardboard",
                "Organic",
                "Textile",
                "E-waste",
                "Other",
              ],
            },
            {
              key: "weightKg",
              title: "Weight (kg)",
              placeholder: "Enter weight for this category",
              type: "number",
              required: true,
              options: [],
              unit: "kg",
            },
          ],
        },
        {
          key: "sortingMethod",
          title: "Sorting Method",
          placeholder: "How was sorting performed?",
          type: "select",
          required: false,
          options: ["Manual sorting", "Mechanical separation", "Community sorting event", "Other"],
        },
      ],
    },
    review: {
      title: "Review Sorting Breakdown",
      description: "Review the sorting breakdown details before submitting.",
    },
  },
};

export const wasteTransferReceipt: ActionInstructionConfig = {
  description: "Document the transfer of sorted waste to a recycling facility or disposal site.",
  uiConfig: {
    media: {
      title: "Capture Receipt/Facility Proof",
      description: "Upload a photo of the transfer receipt, facility gate, or weigh-in ticket.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Receipt or facility proof"],
      optional: ["Vehicle/transport", "Weigh-in ticket"],
    },
    details: {
      title: "Transfer Details",
      description: "Provide details about the waste transfer and disposition.",
      feedbackPlaceholder: "Notes about facility conditions, transport logistics, or pricing",
      inputs: [
        {
          key: "amountTransferredKg",
          title: "Amount Transferred (kg)",
          placeholder: "Enter weight transferred in kilograms",
          type: "number",
          required: true,
          options: [],
          unit: "kg",
        },
        {
          key: "disposition",
          title: "Disposition",
          placeholder: "Select what happened to the waste",
          type: "select",
          required: true,
          options: [
            "Recycled",
            "Composted",
            "Landfilled",
            "Incinerated",
            "Hazardous disposal",
            "Mixed",
          ],
        },
        {
          key: "tripCountBand",
          title: "Trip Count",
          placeholder: "Select number of trips made",
          type: "band",
          required: false,
          options: [],
          bands: ["1", "2-3", "4-5", "6+"],
        },
      ],
    },
    review: {
      title: "Review Transfer Receipt",
      description: "Review the transfer details before submitting.",
    },
  },
};

export const wasteUpcycleBatch: ActionInstructionConfig = {
  description:
    "Document a compost or upcycling batch including input materials, output products, and batch type.",
  uiConfig: {
    media: {
      title: "Capture Batch Photo",
      description: "Take a photo of the batch materials, compost pile, or upcycled products.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Batch materials or output"],
      optional: ["Processing setup", "Before/after"],
    },
    details: {
      title: "Batch Details",
      description: "Provide details about the compost or upcycle batch.",
      feedbackPlaceholder: "Notes about batch quality, processing time, or challenges",
      inputs: [
        {
          key: "inputKg",
          title: "Input (kg)",
          placeholder: "Enter input material weight in kilograms",
          type: "number",
          required: true,
          options: [],
          unit: "kg",
        },
        {
          key: "outputKg",
          title: "Output (kg)",
          placeholder: "Enter output product weight in kilograms",
          type: "number",
          required: true,
          options: [],
          unit: "kg",
        },
        {
          key: "batchType",
          title: "Batch Type",
          placeholder: "Select the type of batch",
          type: "select",
          required: true,
          options: ["Compost", "Upcycled product", "Biochar", "Mulch", "Other"],
        },
      ],
    },
    review: {
      title: "Review Batch",
      description: "Review the batch details before submitting.",
    },
  },
};

export const wasteMaintenanceCheck: ActionInstructionConfig = {
  description:
    "Document a recurring site maintenance check for waste accumulation. Track residual waste levels and site condition over time.",
  uiConfig: {
    media: {
      title: "Capture Site Photo",
      description: "Take a photo of the site showing current waste conditions.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Current site condition"],
      optional: ["Comparison with previous check", "Problem areas"],
    },
    details: {
      title: "Maintenance Check Details",
      description: "Provide details about the site condition and any waste removed.",
      feedbackPlaceholder: "Notes about trends, new dumping, or community engagement",
      inputs: [
        {
          key: "amountRemoved",
          title: "Amount Removed (kg or bags)",
          placeholder: "Enter amount of waste removed",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "siteSizeBand",
          title: "Site Size",
          placeholder: "Select approximate site size",
          type: "band",
          required: true,
          options: [],
          bands: [
            "Small (< 50 m\u00b2)",
            "Medium (50-200 m\u00b2)",
            "Large (200-1000 m\u00b2)",
            "Very Large (> 1000 m\u00b2)",
          ],
        },
        {
          key: "conditionTags",
          title: "Site Condition",
          placeholder: "Select current site conditions",
          type: "multi-select",
          required: true,
          options: [
            "Clean",
            "Light waste",
            "Moderate waste",
            "Heavy waste",
            "New dumping observed",
            "Improved since last check",
          ],
        },
      ],
    },
    review: {
      title: "Review Maintenance Check",
      description: "Review the maintenance check details before submitting.",
    },
  },
};
