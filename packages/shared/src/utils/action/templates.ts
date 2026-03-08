/**
 * Action instruction templates for configuring work submission UI.
 * These templates define the media, details, and review steps for each action slug.
 * Keyed by action slug (e.g., "solar.site_setup") matching config/actions.json.
 */

import type { ActionInstructionConfig } from "../../types/domain";
import {
  agroHarvestYield,
  agroLearningReflection,
  agroMaintenanceActivity,
  agroPlantingEvent,
  agroSiteSpeciesPlan,
  agroSurvivalCheck,
} from "./templates/agro";
import {
  eduDeliverSession,
  eduFollowupAction,
  eduLearningAssessment,
  eduPublishSession,
  eduVerifyAttendance,
} from "./templates/edu";
import {
  solarEnergyUptimeCheck,
  solarInstallMilestone,
  solarNodeOps,
  solarServiceSession,
  solarSiteSetup,
} from "./templates/solar";

import {
  wasteCleanupEvent,
  wasteMaintenanceCheck,
  wasteSiteAssessment,
  wasteSortingBreakdown,
  wasteTransferReceipt,
  wasteUpcycleBatch,
} from "./templates/waste";

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
