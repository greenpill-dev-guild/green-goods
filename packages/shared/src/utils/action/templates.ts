/**
 * Action instruction templates for configuring work submission UI.
 * These templates define the media, details, and review steps for different action types.
 */

export const defaultTemplate: ActionInstructionConfig = {
  description: "Complete this action",
  uiConfig: {
    media: {
      title: "Capture Media",
      description: "Take photos to document your work",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: [],
      optional: [],
    },
    details: {
      title: "Enter Details",
      description: "Provide detailed information about your work",
      feedbackPlaceholder: "Share any observations or notes about your work...",
      inputs: [],
    },
    review: {
      title: "Review & Submit",
      description: "Review your submission before sending",
    },
  },
};

export const instructionTemplates: Record<string, ActionInstructionConfig> = {
  default: defaultTemplate,
  plantingAction: {
    description: "Track planting activities in your garden",
    uiConfig: {
      media: {
        title: "Document Your Planting",
        description: "Take photos showing the planting area and plants",
        maxImageCount: 5,
        minImageCount: 1,
        required: true,
        needed: ["Overview of area", "Close-up of plants"],
        optional: ["Before photo", "Progress shots"],
      },
      details: {
        title: "Planting Details",
        description: "Tell us what you planted",
        feedbackPlaceholder: "Any observations about soil conditions, weather, or plant health...",
        inputs: [
          {
            key: "plantType",
            title: "Plant Type",
            placeholder: "Select the type of plant",
            type: "select",
            required: true,
            options: ["Tomato", "Lettuce", "Carrot", "Cucumber", "Pepper", "Other"],
          },
          {
            key: "plantCount",
            title: "Number of Plants",
            placeholder: "Enter count",
            type: "number",
            required: true,
            options: [],
          },
          {
            key: "location",
            title: "Planting Location",
            placeholder: "e.g., North bed, greenhouse",
            type: "text",
            required: false,
            options: [],
          },
        ],
      },
      review: {
        title: "Review Your Planting",
        description: "Confirm your planting details before submitting",
      },
    },
  },
  wateringAction: {
    description: "Track watering activities",
    uiConfig: {
      media: {
        title: "Document Watering",
        description: "Capture photos of the watered areas",
        maxImageCount: 3,
        minImageCount: 1,
        required: false,
        needed: [],
        optional: ["Before watering", "After watering", "Water source"],
      },
      details: {
        title: "Watering Details",
        description: "Provide information about the watering",
        feedbackPlaceholder: "Notes about water quality, weather conditions, or plant response...",
        inputs: [
          {
            key: "areaWatered",
            title: "Area Watered",
            placeholder: "Describe the area",
            type: "textarea",
            required: true,
            options: [],
          },
          {
            key: "duration",
            title: "Duration (minutes)",
            placeholder: "How long did you water?",
            type: "number",
            required: false,
            options: [],
          },
          {
            key: "waterSource",
            title: "Water Source",
            placeholder: "Select source",
            type: "select",
            required: false,
            options: ["Tap water", "Rainwater", "Well water", "Other"],
          },
        ],
      },
      review: {
        title: "Review Watering Record",
        description: "Confirm your watering details",
      },
    },
  },
  harvestAction: {
    description: "Record harvest activities",
    uiConfig: {
      media: {
        title: "Show Your Harvest",
        description: "Take photos of what you harvested",
        maxImageCount: 5,
        minImageCount: 1,
        required: true,
        needed: ["Harvested produce", "Harvest area"],
        optional: ["Weight measurement", "Sorting/preparation"],
      },
      details: {
        title: "Harvest Details",
        description: "Tell us what you harvested",
        feedbackPlaceholder: "Notes about quality, ripeness, or any issues encountered...",
        inputs: [
          {
            key: "cropType",
            title: "Crop Harvested",
            placeholder: "What did you harvest?",
            type: "text",
            required: true,
            options: [],
          },
          {
            key: "quantity",
            title: "Quantity/Weight",
            placeholder: "e.g., 5 kg, 20 pieces",
            type: "text",
            required: true,
            options: [],
          },
          {
            key: "quality",
            title: "Quality Assessment",
            placeholder: "Select quality",
            type: "select",
            required: false,
            options: ["Excellent", "Good", "Fair", "Poor"],
          },
        ],
      },
      review: {
        title: "Review Harvest Record",
        description: "Confirm harvest details before submitting",
      },
    },
  },
};
