/**
 * Action instruction templates for configuring work submission UI.
 * These templates define the media, details, and review steps for each action slug.
 * Keyed by action slug (e.g., "solar.site_setup") matching config/actions.json.
 */

import type { ActionInstructionConfig } from "../../types/domain";

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

// ============================================
// SOLAR Domain Templates (5)
// ============================================

const solarSiteSetup: ActionInstructionConfig = {
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

const solarInstallMilestone: ActionInstructionConfig = {
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

const solarServiceSession: ActionInstructionConfig = {
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

const solarEnergyUptimeCheck: ActionInstructionConfig = {
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

const solarNodeOps: ActionInstructionConfig = {
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

// ============================================
// AGRO Domain Templates (6)
// ============================================

const agroSiteSpeciesPlan: ActionInstructionConfig = {
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

const agroPlantingEvent: ActionInstructionConfig = {
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

const agroSurvivalCheck: ActionInstructionConfig = {
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

const agroMaintenanceActivity: ActionInstructionConfig = {
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

const agroLearningReflection: ActionInstructionConfig = {
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

const agroHarvestYield: ActionInstructionConfig = {
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

// ============================================
// EDU Domain Templates (5)
// ============================================

const eduPublishSession: ActionInstructionConfig = {
  description:
    "Announce and publish an upcoming educational session. Document planned duration, capacity, session type, and venue details.",
  uiConfig: {
    media: {
      title: "Attach Flyer or Poster",
      description: "Optionally attach a flyer, poster, or screenshot of the session announcement.",
      maxImageCount: 3,
      minImageCount: 0,
      required: false,
      needed: [],
      optional: ["Flyer/poster", "Venue photo"],
    },
    details: {
      title: "Session Planning Details",
      description: "Provide details about the planned educational session.",
      feedbackPlaceholder: "Additional notes about the session plan, prerequisites, or logistics",
      inputs: [
        {
          key: "plannedDurationMin",
          title: "Planned Duration (min)",
          placeholder: "Enter planned session duration in minutes",
          type: "number",
          required: true,
          options: [],
          unit: "min",
        },
        {
          key: "capacity",
          title: "Capacity",
          placeholder: "Enter maximum participant capacity",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "sessionType",
          title: "Session Type",
          placeholder: "Select the session format",
          type: "select",
          required: true,
          options: [
            "Workshop",
            "Lecture",
            "Office hours",
            "Hackathon",
            "Field trip",
            "Panel",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Session Plan",
      description: "Review the session details before publishing.",
    },
  },
};

const eduDeliverSession: ActionInstructionConfig = {
  description:
    "Document a completed educational workshop or session. Record delivered duration, facilitator count, and format details.",
  uiConfig: {
    media: {
      title: "Capture Workshop Photo",
      description: "Take a photo of the room, materials, or session in progress.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Session in progress or materials"],
      optional: ["Participants (privacy-safe)", "Whiteboard/screen"],
    },
    details: {
      title: "Workshop Delivery Details",
      description: "Provide details about the delivered workshop session.",
      feedbackPlaceholder: "Notes about engagement, challenges, or feedback received",
      inputs: [
        {
          key: "deliveredDurationMin",
          title: "Delivered Duration (min)",
          placeholder: "Enter actual session duration in minutes",
          type: "number",
          required: true,
          options: [],
          unit: "min",
        },
        {
          key: "facilitators",
          title: "Facilitators",
          placeholder: "Enter number of facilitators",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "trackTags",
          title: "Topics Covered",
          placeholder: "Select topics covered",
          type: "multi-select",
          required: true,
          options: [
            "Web3 basics",
            "Smart contracts",
            "DeFi",
            "Governance",
            "Impact measurement",
            "Regenerative finance",
            "Developer tools",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Workshop",
      description: "Review the workshop delivery details before submitting.",
    },
  },
};

const eduVerifyAttendance: ActionInstructionConfig = {
  description:
    "Verify and document attendance for an educational session. Record attendee count, verification method, and privacy mode used.",
  uiConfig: {
    media: {
      title: "Capture Attendance Proof",
      description: "Upload a roster export, QR scan screenshot, or attendance record.",
      maxImageCount: 3,
      minImageCount: 1,
      required: true,
      needed: ["Attendance record/roster"],
      optional: ["QR scan screenshot"],
    },
    details: {
      title: "Attendance Verification Details",
      description: "Provide details about the verified attendance.",
      feedbackPlaceholder: "Notes about verification process or any discrepancies",
      inputs: [
        {
          key: "attendees",
          title: "Attendees Verified",
          placeholder: "Enter number of verified attendees",
          type: "number",
          required: true,
          options: [],
        },
        {
          key: "verifyMethod",
          title: "Verification Method",
          placeholder: "Select how attendance was verified",
          type: "select",
          required: true,
          options: [
            "Sign-in sheet",
            "QR code scan",
            "POAP/NFT claim",
            "Roll call",
            "Digital roster",
            "Other",
          ],
        },
        {
          key: "uniqueCountBand",
          title: "Unique Attendee Estimate",
          placeholder: "Select approximate unique attendee range",
          type: "band",
          required: false,
          options: [],
          bands: ["1-5", "6-15", "16-30", "31-50", "51-100", "100+"],
        },
      ],
    },
    review: {
      title: "Review Attendance",
      description: "Review the attendance verification details before submitting.",
    },
  },
};

const eduFollowupAction: ActionInstructionConfig = {
  description:
    "Document a follow-up action taken after an educational session. Captures proof of real-world application.",
  uiConfig: {
    media: {
      title: "Capture Proof",
      description: "Upload a screenshot or proof of the follow-up action taken.",
      maxImageCount: 5,
      minImageCount: 1,
      required: true,
      needed: ["Action proof (screenshot, photo, or export)"],
      optional: ["Additional context"],
    },
    details: {
      title: "Follow-up Action Details",
      description: "Provide details about the follow-up action taken.",
      feedbackPlaceholder: "Notes about the experience, challenges, or next steps planned",
      inputs: [
        {
          key: "followUpType",
          title: "Follow-up Type",
          placeholder: "Select what type of follow-up action",
          type: "select",
          required: true,
          options: [
            "Wallet setup",
            "First transaction",
            "Smart contract deploy",
            "dApp interaction",
            "Repository contribution",
            "Blog/documentation",
            "Community event",
            "Other",
          ],
        },
        {
          key: "proofCountBand",
          title: "Proof Items",
          placeholder: "Select number of proof items",
          type: "band",
          required: true,
          options: [],
          bands: ["1", "2-3", "4-5", "6+"],
        },
        {
          key: "proofType",
          title: "Proof Type",
          placeholder: "Select proof category",
          type: "select",
          required: true,
          options: [
            "On-chain transaction",
            "Wallet screenshot",
            "Repository commit",
            "Blog post",
            "Event photo",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Follow-up",
      description: "Review the follow-up action details before submitting.",
    },
  },
};

const eduLearningAssessment: ActionInstructionConfig = {
  description: "Document a learning assessment result (quiz, project, or practical evaluation).",
  uiConfig: {
    media: {
      title: "Capture Assessment Proof",
      description: "Upload a screenshot of the quiz result, project output, or assessment record.",
      maxImageCount: 3,
      minImageCount: 1,
      required: true,
      needed: ["Assessment result screenshot"],
      optional: ["Project output", "Certificate"],
    },
    details: {
      title: "Assessment Details",
      description: "Provide details about the learning assessment.",
      feedbackPlaceholder:
        "Notes about the assessment experience, difficulty, or areas for improvement",
      inputs: [
        {
          key: "result",
          title: "Result",
          placeholder: "Select pass or fail",
          type: "select",
          required: true,
          options: ["Pass", "Fail"],
        },
        {
          key: "scoreBand",
          title: "Score Range",
          placeholder: "Select score range",
          type: "band",
          required: true,
          options: [],
          bands: ["0-25%", "26-50%", "51-75%", "76-90%", "91-100%"],
        },
        {
          key: "assessmentType",
          title: "Assessment Type",
          placeholder: "Select assessment format",
          type: "select",
          required: true,
          options: [
            "Written quiz",
            "Practical project",
            "Oral presentation",
            "Code review",
            "Portfolio",
            "Other",
          ],
        },
      ],
    },
    review: {
      title: "Review Assessment",
      description: "Review the learning assessment details before submitting.",
    },
  },
};

// ============================================
// WASTE Domain Templates (6)
// ============================================

const wasteSiteAssessment: ActionInstructionConfig = {
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

const wasteCleanupEvent: ActionInstructionConfig = {
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

const wasteSortingBreakdown: ActionInstructionConfig = {
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

const wasteTransferReceipt: ActionInstructionConfig = {
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

const wasteUpcycleBatch: ActionInstructionConfig = {
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

const wasteMaintenanceCheck: ActionInstructionConfig = {
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

// ============================================
// Exported template map (keyed by action slug)
// ============================================

export const instructionTemplates: Record<string, ActionInstructionConfig> = {
  default: defaultTemplate,

  // Solar (5)
  "solar.site_setup": solarSiteSetup,
  "solar.install_milestone": solarInstallMilestone,
  "solar.service_session": solarServiceSession,
  "solar.energy_uptime_check": solarEnergyUptimeCheck,
  "solar.node_ops": solarNodeOps,

  // Agro (6)
  "agro.site_species_plan": agroSiteSpeciesPlan,
  "agro.planting_event": agroPlantingEvent,
  "agro.survival_check": agroSurvivalCheck,
  "agro.maintenance_activity": agroMaintenanceActivity,
  "agro.learning_reflection": agroLearningReflection,
  "agro.harvest_yield": agroHarvestYield,

  // Edu (5)
  "edu.publish_session": eduPublishSession,
  "edu.deliver_session": eduDeliverSession,
  "edu.verify_attendance": eduVerifyAttendance,
  "edu.followup_action": eduFollowupAction,
  "edu.learning_assessment": eduLearningAssessment,

  // Waste (6)
  "waste.site_assessment": wasteSiteAssessment,
  "waste.cleanup_event": wasteCleanupEvent,
  "waste.sorting_breakdown": wasteSortingBreakdown,
  "waste.transfer_receipt": wasteTransferReceipt,
  "waste.upcycle_batch": wasteUpcycleBatch,
  "waste.maintenance_check": wasteMaintenanceCheck,
};
