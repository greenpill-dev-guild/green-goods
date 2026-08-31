import { DatePicker } from "@green-goods/shared/components/DatePicker/DatePicker";
import type { GardenAssessment } from "@green-goods/shared/types/domain";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import type { CapitalType, HypercertDraft } from "@green-goods/shared/types/hypercerts";
import {
  RiAddLine,
  RiCalendarLine,
  RiCheckLine,
  RiFileTextLine,
  RiSparklingLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSelectableCard } from "@/components/AdminSelectableCard";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";

/** Get localized SDG name for accessibility */
function getSdgName(id: number, intl: IntlShape): string {
  return intl.formatMessage({ id: `app.hypercerts.sdg.${id}` });
}

/**
 * Format a Unix timestamp (seconds) to a human-readable date string
 */
function formatDisplayDate(timestamp: number | null | undefined): string {
  if (!timestamp || timestamp <= 0) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface MetadataEditorProps {
  draft: HypercertDraft;
  onUpdate: (updates: Partial<HypercertDraft>) => void;
  suggestedWorkScopes: string[];
  suggestedStart: number | null;
  suggestedEnd: number | null;
  /** Assessment used to prefill metadata fields (if any) */
  selectedAssessment?: GardenAssessment | EASGardenAssessment | null;
}

const CAPITALS: CapitalType[] = [
  "living",
  "social",
  "material",
  "financial",
  "intellectual",
  "experiential",
  "spiritual",
  "cultural",
];

const SDG_VALUES = Array.from({ length: 17 }, (_, index) => index + 1);

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MetadataEditor({
  draft,
  onUpdate,
  suggestedWorkScopes,
  suggestedStart,
  suggestedEnd,
  selectedAssessment,
}: MetadataEditorProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  const [workScopesText, setWorkScopesText] = useState(() => draft.workScopes.join(", "));
  const [impactScopesText, setImpactScopesText] = useState(() => draft.impactScopes.join(", "));
  const [isEditingWorkScopes, setIsEditingWorkScopes] = useState(false);
  const [isEditingImpactScopes, setIsEditingImpactScopes] = useState(false);
  const workScopesValue = isEditingWorkScopes ? workScopesText : draft.workScopes.join(", ");
  const impactScopesValue = isEditingImpactScopes
    ? impactScopesText
    : draft.impactScopes.join(", ");

  // Date validation
  const workDateError = useMemo(() => {
    const start = draft.workTimeframeStart ?? suggestedStart;
    const end = draft.workTimeframeEnd ?? suggestedEnd;
    if (start && end && start > end) {
      return formatMessage({ id: "app.hypercerts.metadata.error.dateRange" });
    }
    return undefined;
  }, [
    draft.workTimeframeStart,
    draft.workTimeframeEnd,
    suggestedStart,
    suggestedEnd,
    formatMessage,
  ]);

  const impactDateError = useMemo(() => {
    const start = draft.impactTimeframeStart ?? draft.workTimeframeStart;
    const end = draft.impactTimeframeEnd;
    if (start !== null && start !== undefined && end && start > end) {
      return formatMessage({ id: "app.hypercerts.metadata.error.dateRange" });
    }
    return undefined;
  }, [
    draft.impactTimeframeStart,
    draft.impactTimeframeEnd,
    draft.workTimeframeStart,
    formatMessage,
  ]);

  const availableSuggestedScopes = useMemo(() => {
    return suggestedWorkScopes.filter((scope) => !draft.workScopes.includes(scope));
  }, [suggestedWorkScopes, draft.workScopes]);

  const handleAddSuggestedScope = (scope: string) => {
    if (!draft.workScopes.includes(scope)) {
      onUpdate({ workScopes: [...draft.workScopes, scope] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Assessment prefill indicator */}
      {selectedAssessment && (
        <div className="flex items-start gap-3 rounded-lg border border-primary-light bg-primary-lighter/30 p-3">
          <RiFileTextLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-base" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary-dark">
              {formatMessage({ id: "app.hypercerts.metadata.prefilled.title" })}
            </p>
            <p className="mt-0.5 text-xs text-primary-dark/70">
              {formatMessage(
                { id: "app.hypercerts.metadata.prefilled.description" },
                { assessmentTitle: selectedAssessment.title }
              )}
            </p>
          </div>
        </div>
      )}

      <AdminTextField
        id="hypercert-title"
        label={formatMessage({ id: "app.hypercerts.metadata.title" })}
        required
        value={draft.title}
        onChange={(event) => onUpdate({ title: event.target.value })}
        placeholder={formatMessage({ id: "app.hypercerts.metadata.title.placeholder" })}
      />

      <AdminTextArea
        id="hypercert-description"
        label={formatMessage({ id: "app.hypercerts.metadata.description" })}
        value={draft.description}
        onChange={(event) => onUpdate({ description: event.target.value })}
        placeholder={formatMessage({ id: "app.hypercerts.metadata.description.placeholder" })}
        rows={4}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <AdminTextField
            id="hypercert-work-scope"
            label={formatMessage({ id: "app.hypercerts.metadata.workScope" })}
            required
            value={workScopesValue}
            onChange={(event) => {
              // The first keystroke opens the editing session (the family has no
              // focus hook); the local text keeps trailing commas while typing.
              setWorkScopesText(event.target.value);
              setIsEditingWorkScopes(true);
              onUpdate({ workScopes: parseCommaList(event.target.value) });
            }}
            onBlur={() => setIsEditingWorkScopes(false)}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.scope.placeholder" })}
          />
          {availableSuggestedScopes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="body-sm text-text-sub">
                {formatMessage({ id: "app.hypercerts.metadata.workScope.suggestedLabel" })}
              </span>
              {availableSuggestedScopes.map((scope) => (
                <AdminFilterChip
                  key={scope}
                  label={scope}
                  selected={false}
                  onToggle={() => handleAddSuggestedScope(scope)}
                  leadingIcon={RiAddLine}
                />
              ))}
            </div>
          )}
        </div>
        <AdminTextField
          id="hypercert-impact-scope"
          label={formatMessage({ id: "app.hypercerts.metadata.impactScope" })}
          value={impactScopesValue}
          onChange={(event) => {
            setImpactScopesText(event.target.value);
            setIsEditingImpactScopes(true);
            onUpdate({ impactScopes: parseCommaList(event.target.value) });
          }}
          onBlur={() => setIsEditingImpactScopes(false)}
          placeholder={formatMessage({ id: "app.hypercerts.metadata.scope.placeholder" })}
        />
      </div>

      {/* Work Timeframe Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-strong flex items-center gap-1.5">
              <RiCalendarLine className="h-4 w-4" />
              {formatMessage({ id: "app.hypercerts.metadata.workTimeframe" })}
              <span className="text-error-base" aria-hidden="true">
                *
              </span>
            </p>
            <p className="text-xs text-text-sub">
              {formatMessage({ id: "app.hypercerts.metadata.workTimeframe.helper" })}
            </p>
          </div>
          {suggestedStart && suggestedEnd && (
            <AdminButton
              type="button"
              variant="outlined"
              size="sm"
              onClick={() => {
                onUpdate({
                  workTimeframeStart: suggestedStart,
                  workTimeframeEnd: suggestedEnd,
                });
              }}
              leadingIcon={<RiSparklingLine />}
            >
              {formatMessage({ id: "app.hypercerts.metadata.useSuggested" })}
            </AdminButton>
          )}
        </div>

        {/* Suggested dates preview */}
        {suggestedStart && suggestedEnd && (
          <div className="rounded-lg border border-stroke-soft bg-bg-weak/50 p-3">
            <p className="text-xs text-text-sub mb-1">
              {formatMessage({ id: "app.hypercerts.metadata.suggestedFromAttestations" })}
            </p>
            <p className="text-sm font-medium text-text-strong">
              {formatDisplayDate(suggestedStart)} → {formatDisplayDate(suggestedEnd)}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            id="hypercert-work-start"
            label={formatMessage({ id: "app.hypercerts.metadata.startDate" })}
            value={draft.workTimeframeStart}
            onChange={(timestamp) => onUpdate({ workTimeframeStart: timestamp ?? 0 })}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.selectDate" })}
            required
          />
          <DatePicker
            id="hypercert-work-end"
            label={formatMessage({ id: "app.hypercerts.metadata.endDate" })}
            value={draft.workTimeframeEnd}
            onChange={(timestamp) => onUpdate({ workTimeframeEnd: timestamp ?? 0 })}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.selectDate" })}
            minDate={draft.workTimeframeStart}
            error={workDateError}
            required
          />
        </div>

        {/* Current selection display */}
        {(draft.workTimeframeStart > 0 || draft.workTimeframeEnd > 0) && (
          <div className="flex items-center gap-2 rounded-lg border border-primary-light bg-primary-lighter/30 px-3 py-2">
            <RiCheckLine className="h-4 w-4 text-primary-base" />
            <span className="text-sm text-primary-dark">
              {formatDisplayDate(draft.workTimeframeStart)} →{" "}
              {formatDisplayDate(draft.workTimeframeEnd)}
            </span>
          </div>
        )}
      </div>

      {/* Impact Timeframe Section (Optional) */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-text-strong flex items-center gap-1.5">
            <RiCalendarLine className="h-4 w-4" />
            {formatMessage({ id: "app.hypercerts.metadata.impactTimeframe" })}
            <span className="text-xs font-normal text-text-sub ml-1">
              ({formatMessage({ id: "app.form.optional" })})
            </span>
          </p>
          <p className="text-xs text-text-sub">
            {formatMessage({ id: "app.hypercerts.metadata.impactTimeframe.helper" })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker
            id="hypercert-impact-start"
            label={formatMessage({ id: "app.hypercerts.metadata.startDate" })}
            value={draft.impactTimeframeStart || draft.workTimeframeStart}
            onChange={(timestamp) => onUpdate({ impactTimeframeStart: timestamp ?? 0 })}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.selectDate" })}
          />
          <DatePicker
            id="hypercert-impact-end"
            label={
              <>
                {formatMessage({ id: "app.hypercerts.metadata.endDate" })}
                <span className="ml-1 font-normal text-text-disabled">
                  ({formatMessage({ id: "app.hypercerts.metadata.ongoingIfEmpty" })})
                </span>
              </>
            }
            value={draft.impactTimeframeEnd}
            onChange={(timestamp) => onUpdate({ impactTimeframeEnd: timestamp })}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.selectDate" })}
            minDate={draft.impactTimeframeStart || draft.workTimeframeStart}
            error={impactDateError}
          />
        </div>
      </div>

      <AdminFieldGroup
        label={formatMessage({ id: "app.hypercerts.metadata.sdgs" })}
        hint={formatMessage({ id: "app.hypercerts.metadata.sdgs.helper" })}
        contentClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SDG_VALUES.map((value) => {
          const isSelected = draft.sdgs.includes(value);
          const sdgName = getSdgName(value, intl);
          return (
            <AdminSelectableCard
              key={value}
              selected={isSelected}
              onClick={() =>
                onUpdate({
                  sdgs: isSelected
                    ? draft.sdgs.filter((sdg) => sdg !== value)
                    : [...draft.sdgs, value],
                })
              }
              title={sdgName}
              leadingVisual={
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--m3-surface-container-high))] text-label-sm font-bold text-[rgb(var(--m3-on-surface-variant))]">
                  {value}
                </span>
              }
            />
          );
        })}
      </AdminFieldGroup>

      <AdminFieldGroup
        label={formatMessage({ id: "app.hypercerts.metadata.capitals" })}
        hint={formatMessage({ id: "app.hypercerts.metadata.capitals.helper" })}
        contentClassName="grid gap-2 sm:grid-cols-2"
      >
        {CAPITALS.map((capital) => {
          const isSelected = draft.capitals.includes(capital);
          const capitalLabel = formatMessage({ id: `app.hypercerts.capital.${capital}` });
          return (
            <AdminSelectableCard
              key={capital}
              selected={isSelected}
              aria-label={capitalLabel}
              onClick={() =>
                onUpdate({
                  capitals: isSelected
                    ? draft.capitals.filter((item) => item !== capital)
                    : [...draft.capitals, capital],
                })
              }
              title={capitalLabel}
            />
          );
        })}
      </AdminFieldGroup>
    </div>
  );
}
