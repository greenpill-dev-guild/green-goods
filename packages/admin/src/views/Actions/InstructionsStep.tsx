import { type CreateActionFormData, instructionTemplates } from "@green-goods/shared";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";
import { InstructionsBuilder } from "@/components/Action/InstructionsBuilder";

interface InstructionsStepProps {
  form: UseFormReturn<CreateActionFormData>;
}

export function InstructionsStep({ form }: InstructionsStepProps): React.ReactElement {
  const { formatMessage } = useIntl();

  return (
    <div>
      <div className="mb-4">
        <label
          htmlFor="create-action-template"
          className="block text-sm font-medium text-text-strong mb-2"
        >
          {formatMessage({
            id: "app.admin.actions.create.templateLabel",
            defaultMessage: "Start from a template (optional)",
          })}
        </label>
        <select
          id="create-action-template"
          onChange={(e) => {
            if (e.target.value) {
              form.setValue("instructionConfig", instructionTemplates[e.target.value]);
            }
          }}
          className="w-full rounded-md border border-stroke-soft px-3 py-2"
        >
          <option value="">
            {formatMessage({
              id: "app.admin.actions.create.templateKeepCurrent",
              defaultMessage: "Keep current configuration",
            })}
          </option>
          <optgroup
            label={formatMessage({
              id: "app.admin.actions.create.templateGroupSolar",
              defaultMessage: "Solar",
            })}
          >
            <option value="solar.site_setup">
              {formatMessage({
                id: "app.admin.actions.create.templateSolarSiteSetup",
                defaultMessage: "Site & Readiness Setup",
              })}
            </option>
            <option value="solar.install_milestone">
              {formatMessage({
                id: "app.admin.actions.create.templateSolarInstallMilestone",
                defaultMessage: "Infrastructure Milestone",
              })}
            </option>
            <option value="solar.service_session">
              {formatMessage({
                id: "app.admin.actions.create.templateSolarServiceSession",
                defaultMessage: "Hub Service Session",
              })}
            </option>
            <option value="solar.energy_uptime_check">
              {formatMessage({
                id: "app.admin.actions.create.templateSolarEnergyCheck",
                defaultMessage: "Energy & Uptime Check",
              })}
            </option>
            <option value="solar.node_ops">
              {formatMessage({
                id: "app.admin.actions.create.templateSolarNodeOps",
                defaultMessage: "Node Operation Log",
              })}
            </option>
          </optgroup>
          <optgroup
            label={formatMessage({
              id: "app.admin.actions.create.templateGroupAgro",
              defaultMessage: "Agroforestry",
            })}
          >
            <option value="agro.site_species_plan">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroSitePlan",
                defaultMessage: "Site Assessment & Species Plan",
              })}
            </option>
            <option value="agro.planting_event">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroPlanting",
                defaultMessage: "Planting Event",
              })}
            </option>
            <option value="agro.survival_check">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroSurvival",
                defaultMessage: "Survival Check",
              })}
            </option>
            <option value="agro.maintenance_activity">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroMaintenance",
                defaultMessage: "Maintenance Activity",
              })}
            </option>
            <option value="agro.learning_reflection">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroLearning",
                defaultMessage: "Learning Reflection",
              })}
            </option>
            <option value="agro.harvest_yield">
              {formatMessage({
                id: "app.admin.actions.create.templateAgroHarvest",
                defaultMessage: "Harvest & Yield Record",
              })}
            </option>
          </optgroup>
          <optgroup
            label={formatMessage({
              id: "app.admin.actions.create.templateGroupEdu",
              defaultMessage: "Education",
            })}
          >
            <option value="edu.publish_session">
              {formatMessage({
                id: "app.admin.actions.create.templateEduPublish",
                defaultMessage: "Publish Session & Open Roster",
              })}
            </option>
            <option value="edu.deliver_session">
              {formatMessage({
                id: "app.admin.actions.create.templateEduDeliver",
                defaultMessage: "Workshop Delivered",
              })}
            </option>
            <option value="edu.verify_attendance">
              {formatMessage({
                id: "app.admin.actions.create.templateEduAttendance",
                defaultMessage: "Attendance Verified",
              })}
            </option>
            <option value="edu.followup_action">
              {formatMessage({
                id: "app.admin.actions.create.templateEduFollowup",
                defaultMessage: "Follow-up Action Logged",
              })}
            </option>
            <option value="edu.learning_assessment">
              {formatMessage({
                id: "app.admin.actions.create.templateEduAssessment",
                defaultMessage: "Learning Assessment",
              })}
            </option>
          </optgroup>
          <optgroup
            label={formatMessage({
              id: "app.admin.actions.create.templateGroupWaste",
              defaultMessage: "Waste Management",
            })}
          >
            <option value="waste.site_assessment">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteAssessment",
                defaultMessage: "Site Assessment (Before)",
              })}
            </option>
            <option value="waste.cleanup_event">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteCleanup",
                defaultMessage: "Cleanup Event",
              })}
            </option>
            <option value="waste.sorting_breakdown">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteSorting",
                defaultMessage: "Sorting & Breakdown",
              })}
            </option>
            <option value="waste.transfer_receipt">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteTransfer",
                defaultMessage: "Recycler/Disposal Transfer",
              })}
            </option>
            <option value="waste.upcycle_batch">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteUpcycle",
                defaultMessage: "Compost/Upcycle Batch",
              })}
            </option>
            <option value="waste.maintenance_check">
              {formatMessage({
                id: "app.admin.actions.create.templateWasteMaintenance",
                defaultMessage: "Recurring Maintenance Check",
              })}
            </option>
          </optgroup>
        </select>
      </div>
      <InstructionsBuilder
        value={form.watch("instructionConfig")}
        onChange={(config) => form.setValue("instructionConfig", config)}
      />
    </div>
  );
}
