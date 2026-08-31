import { DatePicker } from "@green-goods/shared/components/DatePicker/DatePicker";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCurrentChain } from "@green-goods/shared/hooks/blockchain/useChainConfig";
import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { fromCalendarDateKey, toCalendarDateKey } from "@green-goods/shared/utils";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { resolveDomainLabel, Section } from "./shared";

interface ActionsHarvestStepProps {
  showValidation: boolean;
  isSubmitting: boolean;
}

/**
 * Step 3: Actions & Harvest
 * Actions multi-select (filtered by domain from Step 1) + reporting period date range.
 * Clears selected actions when domain changes.
 */
export function ActionsHarvestStep({ showValidation, isSubmitting }: ActionsHarvestStepProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  const form = useCreateAssessmentStore((s) => s.form);
  const setField = useCreateAssessmentStore((s) => s.setField);

  const selectedDomain = form.domain;
  const selectedUIDs = form.selectedActionUIDs;

  // Fetch all actions from the current chain and filter by selected domain
  const chainId = useCurrentChain();
  const { data: allActions = [] } = useActions(chainId);
  const domainActions = useMemo(
    () => allActions.filter((action) => action.domain === selectedDomain),
    [allActions, selectedDomain]
  );

  // Clear selected actions when domain changes
  const prevDomainRef = useRef(selectedDomain);
  useEffect(() => {
    if (prevDomainRef.current === selectedDomain) return;
    prevDomainRef.current = selectedDomain;
    setField("selectedActionUIDs", []);
  }, [selectedDomain, setField]);

  const handleToggleAction = (actionId: string) => {
    if (isSubmitting) return;
    const next = selectedUIDs.includes(actionId)
      ? selectedUIDs.filter((id) => id !== actionId)
      : [...selectedUIDs, actionId];
    setField("selectedActionUIDs", next);
  };

  // Local validation errors
  const fieldErrors = useMemo(
    () => ({
      reportingPeriodStart:
        form.reportingPeriodStart.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingStartRequired",
              defaultMessage: "Start date is required",
            }),
      reportingPeriodEnd:
        form.reportingPeriodEnd.trim().length > 0
          ? null
          : formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingEndRequired",
              defaultMessage: "End date is required",
            }),
      dateRange: (() => {
        // Same parser the pickers use — a bare `new Date(str)` here would read
        // these as UTC and drift from the values the fields actually hold.
        const start = fromCalendarDateKey(form.reportingPeriodStart);
        const end = fromCalendarDateKey(form.reportingPeriodEnd);
        if (start === null || end === null) return null;
        if (end < start) {
          return formatMessage({
            id: "app.admin.assessment.actionsHarvest.endAfterStart",
            defaultMessage: "End date must be after start date",
          });
        }
        return null;
      })(),
    }),
    [form, formatMessage]
  );

  return (
    <div className="space-y-6">
      {/* Action Multi-Select */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.domainAction.actionsTitle",
          defaultMessage: "Coherent Actions",
        })}
        description={formatMessage({
          id: "app.admin.assessment.domainAction.actionsDescription",
          defaultMessage: "Select the actions that will be tracked under this assessment.",
        })}
      >
        {domainActions.length === 0 ? (
          <div className="rounded-md border border-dashed border-stroke-soft p-6 text-center">
            <p className="text-sm text-text-soft">
              {formatMessage(
                {
                  id: "app.admin.assessment.domainAction.noActions",
                  defaultMessage: "No actions registered for {domain}.",
                },
                { domain: resolveDomainLabel(intl, selectedDomain) }
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-soft">
              <span>
                {formatMessage(
                  {
                    id: "app.admin.assessment.domainAction.selectedCount",
                    defaultMessage: "{count} of {total} actions selected",
                  },
                  { count: selectedUIDs.length, total: domainActions.length }
                )}
              </span>
              <AdminButton
                type="button"
                variant="text"
                size="sm"
                onClick={() => {
                  if (selectedUIDs.length === domainActions.length) {
                    setField("selectedActionUIDs", []);
                  } else {
                    setField(
                      "selectedActionUIDs",
                      domainActions.map((a) => a.id)
                    );
                  }
                }}
                disabled={isSubmitting}
              >
                {selectedUIDs.length === domainActions.length
                  ? formatMessage({
                      id: "app.admin.assessment.domainAction.deselectAll",
                      defaultMessage: "Deselect All",
                    })
                  : formatMessage({
                      id: "app.admin.assessment.domainAction.selectAll",
                      defaultMessage: "Select All",
                    })}
              </AdminButton>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {domainActions.map((action) => {
                const isChecked = selectedUIDs.includes(action.id);
                const checkboxId = `harvest-action-${action.id}`;
                return (
                  <div
                    key={action.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                      isChecked
                        ? "border-primary-base bg-primary-alpha-10 text-primary-dark"
                        : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                      isSubmitting && "opacity-60"
                    )}
                  >
                    {/* Canonical M3 control (18px box, 40px target); negative
                        margins absorb the target padding so the compact row
                        keeps its height. */}
                    <AdminCheckbox
                      id={checkboxId}
                      checked={isChecked}
                      onChange={() => handleToggleAction(action.id)}
                      disabled={isSubmitting}
                      className="-my-2 -ml-2.5"
                    />
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "min-w-0 flex-1 pt-0.5",
                        isSubmitting ? "cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <span className="block truncate font-medium" title={action.title}>
                        {action.title}
                      </span>
                      {action.slug && (
                        <span className="block truncate text-xs text-text-soft" title={action.slug}>
                          {action.slug}
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Always render to reserve space */}
        <span className="block min-h-[1.25rem] text-xs text-error-dark">{"\u00A0"}</span>
      </Section>

      {/* Reporting Period */}
      <Section
        title={formatMessage({
          id: "app.admin.assessment.actionsHarvest.sectionTitle",
          defaultMessage: "Reporting Period",
        })}
        description={formatMessage({
          id: "app.admin.assessment.actionsHarvest.sectionDescription",
          defaultMessage:
            "Define the time window for this assessment. Work documented by gardeners within this period will be aggregated into a verifiable impact certificate.",
        })}
      >
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          <DatePicker
            id="reportingPeriodStart"
            label={formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingStartLabel",
              defaultMessage: "Reporting period start",
            })}
            required
            value={fromCalendarDateKey(form.reportingPeriodStart)}
            onChange={(ts) => setField("reportingPeriodStart", toCalendarDateKey(ts))}
            disabled={isSubmitting}
            placeholder={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingStartPlaceholder",
              defaultMessage: "Select start date",
            })}
            helperText={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingStartHelp",
              defaultMessage:
                "When does the work period begin? Typically aligns with a season, project phase, or funding cycle.",
            })}
            error={(showValidation && fieldErrors.reportingPeriodStart) || undefined}
          />
          <DatePicker
            id="reportingPeriodEnd"
            label={formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingEndLabel",
              defaultMessage: "Reporting period end",
            })}
            required
            value={fromCalendarDateKey(form.reportingPeriodEnd)}
            onChange={(ts) => setField("reportingPeriodEnd", toCalendarDateKey(ts))}
            disabled={isSubmitting}
            minDate={fromCalendarDateKey(form.reportingPeriodStart)}
            placeholder={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingEndPlaceholder",
              defaultMessage: "Select end date",
            })}
            helperText={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingEndHelp",
              defaultMessage:
                "When does the work period end? All work documented within this window will be aggregated.",
            })}
            error={
              (showValidation && (fieldErrors.dateRange ?? fieldErrors.reportingPeriodEnd)) ||
              undefined
            }
          />
        </div>
      </Section>
    </div>
  );
}
