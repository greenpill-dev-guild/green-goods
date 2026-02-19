import type { ActionInstructionConfig } from "../../../types/domain";

export const solarSiteSetup: ActionInstructionConfig = {
  description:
    "Document solar hub site preparation, readiness assessment, and any permissions or agreements secured.",
  uiConfig: {
    media: {
      title: "Capture Site Photos",
      description:
        "Take photos of the site location, any existing infrastructure, and permission documentation if available.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Site overview", "Access points"],
      optional: ["Permission documents", "Existing infrastructure"],
    },
    details: {
      title: "Site Readiness Details",
      description: "Provide details about the site setup and readiness assessment.",
      feedbackPlaceholder: "Notes about site conditions, challenges, or next steps",
      inputs: [
        {
          key: "readinessScore",
          title: "Readiness Level",
          placeholder: "Select site readiness level",
          type: "band",
          required: true,
          options: [],
          bands: ["Not Ready", "Early Stage", "Mostly Ready", "Fully Ready"],
        },
        {
          key: "agreementType",
          title: "Agreement Type",
          placeholder: "Select agreement type secured",
          type: "multi-select",
          required: false,
          options: [
            "Land use permit",
            "Community agreement",
            "Government license",
            "Utility interconnection",
            "None yet",
          ],
        },
        {
          key: "siteType",
          title: "Site Type",
          placeholder: "Select the site type",
          type: "select",
          required: true,
          options: [
            "Rooftop",
            "Ground mount",
            "Community center",
            "School",
            "Health facility",
            "Market",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Site Setup",
      description: "Review the site readiness details before submitting.",
    },
  },
};

export const solarInstallMilestone: ActionInstructionConfig = {
  description:
    "Record installation progress milestones for solar panels, batteries, internet equipment, or retrofits.",
  uiConfig: {
    media: {
      title: "Capture Install Photos",
      description: "Take photos of the installed equipment, invoice or receipt if available.",
      maxImageCount: 8,
      minImageCount: 1,
      required: true,
      needed: ["Installed equipment"],
      optional: ["Invoice/receipt", "Measurement reading"],
    },
    details: {
      title: "Milestone Details",
      description: "Provide details about this infrastructure milestone.",
      feedbackPlaceholder: "Notes about installation quality, challenges, or deviations from plan",
      inputs: [
        {
          key: "milestoneValue",
          title: "Milestone Value",
          placeholder: "Enter the numeric value for this milestone",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "milestoneType",
          title: "Milestone Type",
          placeholder: "Select the type of milestone",
          type: "select",
          required: true,
          options: [
            "Solar kW installed",
            "Battery kWh added",
            "Internet Mbps provisioned",
            "Retrofit completed",
            "Commissioning",
          ],
        },
        {
          key: "measurementMethod",
          title: "Measurement Method",
          placeholder: "How was the value measured?",
          type: "select",
          required: false,
          options: ["Nameplate rating", "Meter reading", "Invoice specification", "Field estimate"],
        },
      ],
    },
    review: {
      title: "Review Milestone",
      description: "Review the infrastructure milestone details before submitting.",
    },
  },
};

export const solarServiceSession: ActionInstructionConfig = {
  description:
    "Document a session where the solar hub was open for community use. Track services provided, duration, and number of users served.",
  uiConfig: {
    media: {
      title: "Capture Hub in Use",
      description: "Take a privacy-safe photo of the hub during the service session.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Hub in operation"],
      optional: ["Queue/users (privacy-safe)", "Service area"],
    },
    details: {
      title: "Service Session Details",
      description: "Provide details about this hub service session.",
      feedbackPlaceholder: "Notes about user needs, issues, or observations",
      inputs: [
        {
          key: "hoursOpen",
          title: "Hours Open",
          placeholder: "Enter hours the hub was open",
          type: "number",
          required: true,
          options: [],
          unit: "hours",
        },
        {
          key: "usersServed",
          title: "Users Served",
          placeholder: "Enter the number of users served",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "serviceTags",
          title: "Services Provided",
          placeholder: "Select all services provided",
          type: "multi-select",
          required: true,
          options: [
            "Phone charging",
            "Internet access",
            "Classroom/training",
            "Device repairs",
            "Printing",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Service Session",
      description: "Review the service session details before submitting.",
    },
  },
};

export const solarEnergyUptimeCheck: ActionInstructionConfig = {
  description:
    "Record energy generation data and system uptime. Document meter readings and any issues affecting performance.",
  uiConfig: {
    media: {
      title: "Capture Meter/Inverter Photo",
      description: "Take a photo of the meter or inverter display showing current readings.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Meter/inverter display"],
      optional: ["Panel array", "Issue documentation"],
    },
    details: {
      title: "Energy & Uptime Details",
      description: "Provide energy generation and uptime data for this check period.",
      feedbackPlaceholder: "Notes about system performance, maintenance needs, or weather impacts",
      inputs: [
        {
          key: "kwhGenerated",
          title: "Energy Generated (kWh)",
          placeholder: "Enter kWh generated this period",
          type: "number",
          required: true,
          options: [],
          unit: "kWh",
        },
        {
          key: "uptimeBand",
          title: "Uptime Level",
          placeholder: "Select uptime band for this period",
          type: "band",
          required: true,
          options: [],
          bands: ["0-25%", "26-50%", "51-75%", "76-90%", "91-100%"],
        },
        {
          key: "measurementMethod",
          title: "Measurement Method",
          placeholder: "How was energy measured?",
          type: "select",
          required: false,
          options: ["Smart meter", "Inverter display", "IoT sensor", "Manual estimate"],
        },
      ],
    },
    review: {
      title: "Review Energy Check",
      description: "Review the energy and uptime data before submitting.",
    },
  },
};

export const solarNodeOps: ActionInstructionConfig = {
  description:
    "Document blockchain node operations including uptime, yield, and proof of operation.",
  uiConfig: {
    media: {
      title: "Capture Node Proof",
      description: "Take a dashboard screenshot or provide on-chain proof of node operation.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Dashboard or on-chain proof"],
      optional: ["Hardware setup", "Network stats"],
    },
    details: {
      title: "Node Operation Details",
      description: "Provide details about node performance and yield for this period.",
      feedbackPlaceholder: "Notes about node performance, issues, or network conditions",
      inputs: [
        {
          key: "uptimeBand",
          title: "Node Uptime",
          placeholder: "Select uptime band for this period",
          type: "band",
          required: true,
          options: [],
          bands: ["0-25%", "26-50%", "51-75%", "76-90%", "91-100%"],
        },
        {
          key: "yieldEth",
          title: "Yield (ETH)",
          placeholder: "Enter ETH yield for this period",
          type: "number",
          required: true,
          options: [],
          unit: "ETH",
        },
        {
          key: "proofType",
          title: "Proof Type",
          placeholder: "Select proof method",
          type: "select",
          required: true,
          options: ["On-chain transaction", "Dashboard screenshot", "API export"],
        },
      ],
    },
    review: {
      title: "Review Node Log",
      description: "Review the node operation details before submitting.",
    },
  },
};
