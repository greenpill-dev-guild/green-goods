import {
  cn,
  DatePicker,
  Domain,
  useActions,
  useCreateAssessmentStore,
  useCurrentChain,
} from "@green-goods/shared";
import { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { LabeledField, resolveDomainLabel, Section } from "./shared";

/** Convert a "YYYY-MM-DD" store string → Unix seconds for DatePicker */
function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Convert Unix seconds from DatePicker → "YYYY-MM-DD" store string */
function timestampToDateString(ts: number | null): string {
  if (!ts || ts <= 0) return "";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

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
        if (!form.reportingPeriodStart || !form.reportingPeriodEnd) return null;
        const start = new Date(form.reportingPeriodStart);
        const end = new Date(form.reportingPeriodEnd);
        if (end < start) {
          return formatMessage({
            id: "app.admin.assessment.actionsHarvest.endAfterStart",
            defaultMessage: "End date must be after start date",
          });
        }
        return null;
      })(),
    }),
    [form.reportingPeriodStart, form.reportingPeriodEnd, formatMessage]
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
              <button
                type="button"
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
                className="text-xs font-medium text-primary-dark hover:text-primary-darker disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedUIDs.length === domainActions.length
                  ? formatMessage({
                      id: "app.admin.assessment.domainAction.deselectAll",
                      defaultMessage: "Deselect all",
                    })
                  : formatMessage({
                      id: "app.admin.assessment.domainAction.selectAll",
                      defaultMessage: "Select all",
                    })}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {domainActions.map((action) => {
                const isChecked = selectedUIDs.includes(action.id);
                return (
                  <label
                    key={action.id}
                    aria-label={action.title}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                      isChecked
                        ? "border-primary-base bg-primary-alpha-10 text-primary-dark"
                        : "border-stroke-soft bg-bg-white text-text-sub hover:border-primary-alpha-24 hover:bg-primary-alpha-10",
                      isSubmitting && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleAction(action.id)}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 rounded border-stroke-sub text-primary-base focus:ring-2 focus:ring-primary-alpha-24 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{action.title}</span>
                      {action.slug && (
                        <span className="block truncate text-xs text-text-soft">{action.slug}</span>
                      )}
                    </div>
                  </label>
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
          <LabeledField
            label={formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingStartLabel",
              defaultMessage: "Reporting period start",
            })}
            required
            error={showValidation ? fieldErrors.reportingPeriodStart : null}
            helpText={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingStartHelp",
              defaultMessage:
                "When does the work period begin? Typically aligns with a season, project phase, or funding cycle.",
            })}
          >
            <DatePicker
              id="reportingPeriodStart"
              value={dateStringToTimestamp(form.reportingPeriodStart)}
              onChange={(ts) => setField("reportingPeriodStart", timestampToDateString(ts))}
              disabled={isSubmitting}
              placeholder={formatMessage({
                id: "app.admin.assessment.actionsHarvest.reportingStartPlaceholder",
                defaultMessage: "Select start date",
              })}
              error={showValidation && fieldErrors.reportingPeriodStart ? " " : undefined}
            />
          </LabeledField>
          <LabeledField
            label={formatMessage({
              id: "app.admin.assessment.sdgHarvest.reportingEndLabel",
              defaultMessage: "Reporting period end",
            })}
            required
            error={
              showValidation ? (fieldErrors.dateRange ?? fieldErrors.reportingPeriodEnd) : null
            }
            helpText={formatMessage({
              id: "app.admin.assessment.actionsHarvest.reportingEndHelp",
              defaultMessage:
                "When does the work period end? All work documented within this window will be aggregated.",
            })}
          >
            <DatePicker
              id="reportingPeriodEnd"
              value={dateStringToTimestamp(form.reportingPeriodEnd)}
              onChange={(ts) => setField("reportingPeriodEnd", timestampToDateString(ts))}
              disabled={isSubmitting}
              minDate={dateStringToTimestamp(form.reportingPeriodStart)}
              placeholder={formatMessage({
                id: "app.admin.assessment.actionsHarvest.reportingEndPlaceholder",
                defaultMessage: "Select end date",
              })}
              error={
                showValidation && (fieldErrors.reportingPeriodEnd || fieldErrors.dateRange)
                  ? " "
                  : undefined
              }
            />
          </LabeledField>
        </div>
      </Section>
    </div>
  );
}
