import type { Action } from "@green-goods/shared/types/domain";
import { instructionTemplates } from "@green-goods/shared/utils/action/templates";
import {
  getReviewedActionTranslation,
  localizeAction,
} from "@green-goods/shared/utils/action/translations";
import enMessages from "@green-goods/shared/i18n/en";
import type { IntlShape } from "react-intl";

interface CanonicalActionCopy {
  sourceTitle: string;
  titleId: string;
  descriptionId: string;
}

const CANONICAL_ACTION_COPY: Record<string, CanonicalActionCopy> = {
  "solar.site_setup": {
    sourceTitle: "Site & Readiness Setup",
    titleId: "app.admin.actions.create.templateSolarSiteSetup",
    descriptionId: "app.admin.actions.create.templateSolarSiteSetupDescription",
  },
  "solar.install_milestone": {
    sourceTitle: "Infrastructure Milestone",
    titleId: "app.admin.actions.create.templateSolarInstallMilestone",
    descriptionId: "app.admin.actions.create.templateSolarInstallMilestoneDescription",
  },
  "solar.service_session": {
    sourceTitle: "Hub Service Session",
    titleId: "app.admin.actions.create.templateSolarServiceSession",
    descriptionId: "app.admin.actions.create.templateSolarServiceSessionDescription",
  },
  "solar.energy_uptime_check": {
    sourceTitle: "Energy & Uptime Check",
    titleId: "app.admin.actions.create.templateSolarEnergyCheck",
    descriptionId: "app.admin.actions.create.templateSolarEnergyCheckDescription",
  },
  "solar.node_ops": {
    sourceTitle: "Node Operation Log",
    titleId: "app.admin.actions.create.templateSolarNodeOps",
    descriptionId: "app.admin.actions.create.templateSolarNodeOpsDescription",
  },
  "agro.site_species_plan": {
    sourceTitle: "Site Assessment & Species Plan",
    titleId: "app.admin.actions.create.templateAgroSitePlan",
    descriptionId: "app.admin.actions.create.templateAgroSitePlanDescription",
  },
  "agro.planting_event": {
    sourceTitle: "Planting Event",
    titleId: "app.admin.actions.create.templateAgroPlanting",
    descriptionId: "app.admin.actions.create.templateAgroPlantingDescription",
  },
  "agro.survival_check": {
    sourceTitle: "Survival Check",
    titleId: "app.admin.actions.create.templateAgroSurvival",
    descriptionId: "app.admin.actions.create.templateAgroSurvivalDescription",
  },
  "agro.maintenance_activity": {
    sourceTitle: "Maintenance Activity",
    titleId: "app.admin.actions.create.templateAgroMaintenance",
    descriptionId: "app.admin.actions.create.templateAgroMaintenanceDescription",
  },
  "agro.learning_reflection": {
    sourceTitle: "Learning Reflection",
    titleId: "app.admin.actions.create.templateAgroLearning",
    descriptionId: "app.admin.actions.create.templateAgroLearningDescription",
  },
  "agro.harvest_yield": {
    sourceTitle: "Harvest & Yield Record",
    titleId: "app.admin.actions.create.templateAgroHarvest",
    descriptionId: "app.admin.actions.create.templateAgroHarvestDescription",
  },
  "edu.publish_session": {
    sourceTitle: "Publish Session & Open Roster",
    titleId: "app.admin.actions.create.templateEduPublish",
    descriptionId: "app.admin.actions.create.templateEduPublishDescription",
  },
  "edu.deliver_session": {
    sourceTitle: "Workshop Delivered",
    titleId: "app.admin.actions.create.templateEduDeliver",
    descriptionId: "app.admin.actions.create.templateEduDeliverDescription",
  },
  "edu.verify_attendance": {
    sourceTitle: "Attendance Verified",
    titleId: "app.admin.actions.create.templateEduAttendance",
    descriptionId: "app.admin.actions.create.templateEduAttendanceDescription",
  },
  "edu.followup_action": {
    sourceTitle: "Follow-up Action Logged",
    titleId: "app.admin.actions.create.templateEduFollowup",
    descriptionId: "app.admin.actions.create.templateEduFollowupDescription",
  },
  "edu.learning_assessment": {
    sourceTitle: "Learning Assessment",
    titleId: "app.admin.actions.create.templateEduAssessment",
    descriptionId: "app.admin.actions.create.templateEduAssessmentDescription",
  },
  "waste.site_assessment": {
    sourceTitle: "Site Assessment (Before)",
    titleId: "app.admin.actions.create.templateWasteAssessment",
    descriptionId: "app.admin.actions.create.templateWasteAssessmentDescription",
  },
  "waste.cleanup_event": {
    sourceTitle: "Cleanup Event",
    titleId: "app.admin.actions.create.templateWasteCleanup",
    descriptionId: "app.admin.actions.create.templateWasteCleanupDescription",
  },
  "waste.sorting_breakdown": {
    sourceTitle: "Sorting & Breakdown",
    titleId: "app.admin.actions.create.templateWasteSorting",
    descriptionId: "app.admin.actions.create.templateWasteSortingDescription",
  },
  "waste.transfer_receipt": {
    sourceTitle: "Recycler/Disposal Transfer",
    titleId: "app.admin.actions.create.templateWasteTransfer",
    descriptionId: "app.admin.actions.create.templateWasteTransferDescription",
  },
  "waste.upcycle_batch": {
    sourceTitle: "Compost/Upcycle Batch",
    titleId: "app.admin.actions.create.templateWasteUpcycle",
    descriptionId: "app.admin.actions.create.templateWasteUpcycleDescription",
  },
  "waste.maintenance_check": {
    sourceTitle: "Recurring Maintenance Check",
    titleId: "app.admin.actions.create.templateWasteMaintenance",
    descriptionId: "app.admin.actions.create.templateWasteMaintenanceDescription",
  },
  "waste.repair_event": {
    sourceTitle: "Repair Event",
    titleId: "app.admin.actions.create.templateWasteRepair",
    descriptionId: "app.admin.actions.create.templateWasteRepairDescription",
  },
};

const GENERATED_TITLE_SUFFIX = /^\s+[-–—]\s+\d{4}-\d{2}-\d{2}T/;

function matchesCanonicalTitle(title: string, sourceTitle: string): boolean {
  if (!title.startsWith(sourceTitle)) return false;
  const suffix = title.slice(sourceTitle.length);
  return suffix.length === 0 || GENERATED_TITLE_SUFFIX.test(suffix);
}

export function localizeCanonicalActionTitle(
  title: string,
  formatMessage: IntlShape["formatMessage"]
): string {
  for (const copy of Object.values(CANONICAL_ACTION_COPY)) {
    if (!matchesCanonicalTitle(title, copy.sourceTitle)) continue;
    return title.replace(
      copy.sourceTitle,
      formatMessage({ id: copy.titleId, defaultMessage: copy.sourceTitle })
    );
  }
  return title;
}

export function localizeActionForDisplay(
  action: Action,
  intl: Pick<IntlShape, "formatMessage" | "locale">
): Action {
  const localized = localizeAction(action, intl.locale);
  const copy = CANONICAL_ACTION_COPY[action.slug];
  if (!copy) return localized;

  const reviewed = getReviewedActionTranslation(action.translations, intl.locale);
  const templateDescription = instructionTemplates[action.slug]?.description;
  const deployedDescription = (enMessages as Record<string, string>)[copy.descriptionId];
  const actionDescription = action.description?.trim();
  const hasCanonicalDescription =
    actionDescription === templateDescription?.trim() ||
    actionDescription === deployedDescription?.trim();
  const title =
    reviewed?.data.title?.trim() || !matchesCanonicalTitle(action.title, copy.sourceTitle)
      ? localized.title
      : localizeCanonicalActionTitle(action.title, intl.formatMessage);
  const description =
    reviewed?.data.description?.trim() || !hasCanonicalDescription || !deployedDescription
      ? localized.description
      : intl.formatMessage({
          id: copy.descriptionId,
          defaultMessage: deployedDescription,
        });

  return { ...localized, title, description };
}
