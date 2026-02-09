import {
  cn,
  DatePicker,
  FormInput,
  FormTextarea,
  type CapitalType,
  type HypercertDraft,
} from "@green-goods/shared";
import { RiAddLine, RiCalendarLine, RiCheckLine, RiSparklingLine } from "@remixicon/react";
import { useMemo } from "react";
import { useIntl, type IntlShape } from "react-intl";

/** Get localized SDG name for accessibility */
function getSdgName(id: number, intl: IntlShape): string {
  return intl.formatMessage({ id: `app.hypercerts.sdg.${id}` });
}

/**
 * Format a Unix timestamp (seconds) to a human-readable date string
 */
function formatDisplayDate(timestamp: number | null | undefined): string {
  if (!timestamp || timestamp <= 0) return "—";
  // Convert seconds to milliseconds for Date
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
}: MetadataEditorProps) {
  const intl = useIntl();
  const { formatMessage } = intl;

  const workScopesText = draft.workScopes.join(", ");
  const impactScopesText = draft.impactScopes.join(", ");

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

  // Filter out scopes already added
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
      <FormInput
        id="hypercert-title"
        label={
          <>
            {formatMessage({ id: "app.hypercerts.metadata.title" })}
            <span className="ml-0.5 text-error-base" aria-hidden="true">
              *
            </span>
            <span className="sr-only">{formatMessage({ id: "app.form.required" })}</span>
          </>
        }
        value={draft.title}
        onChange={(event) => onUpdate({ title: event.target.value })}
        placeholder={formatMessage({ id: "app.hypercerts.metadata.title.placeholder" })}
        aria-required="true"
      />

      <FormTextarea
        id="hypercert-description"
        label={formatMessage({ id: "app.hypercerts.metadata.description" })}
        value={draft.description}
        onChange={(event) => onUpdate({ description: event.target.value })}
        placeholder={formatMessage({ id: "app.hypercerts.metadata.description.placeholder" })}
        rows={4}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <FormInput
            id="hypercert-work-scope"
            label={
              <>
                {formatMessage({ id: "app.hypercerts.metadata.workScope" })}
                <span className="ml-0.5 text-error-base" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">{formatMessage({ id: "app.form.required" })}</span>
              </>
            }
            value={workScopesText}
            onChange={(event) => onUpdate({ workScopes: parseCommaList(event.target.value) })}
            placeholder={formatMessage({ id: "app.hypercerts.metadata.scope.placeholder" })}
            aria-required="true"
          />
          {availableSuggestedScopes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-sub">
                {formatMessage({ id: "app.hypercerts.metadata.workScope.suggestedLabel" })}
              </span>
              {availableSuggestedScopes.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => handleAddSuggestedScope(scope)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-primary-light px-2 py-0.5 text-xs text-primary-base transition hover:border-primary-base hover:bg-primary-lighter"
                >
                  <RiAddLine className="h-3 w-3" />
                  {scope}
                </button>
              ))}
            </div>
          )}
        </div>
        <FormInput
          id="hypercert-impact-scope"
          label={formatMessage({ id: "app.hypercerts.metadata.impactScope" })}
          value={impactScopesText}
          onChange={(event) => onUpdate({ impactScopes: parseCommaList(event.target.value) })}
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
            <button
              type="button"
              onClick={() => {
                onUpdate({
                  workTimeframeStart: suggestedStart,
                  workTimeframeEnd: suggestedEnd,
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary-light bg-primary-lighter/50 px-3 py-1.5 text-xs font-medium text-primary-base transition hover:border-primary-base hover:bg-primary-lighter"
            >
              <RiSparklingLine className="h-3.5 w-3.5" />
              {formatMessage({ id: "app.hypercerts.metadata.useSuggested" })}
            </button>
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

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "app.hypercerts.metadata.sdgs" })}
          </p>
          <p className="text-xs text-text-sub">
            {formatMessage({ id: "app.hypercerts.metadata.sdgs.helper" })}
          </p>
        </div>
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          role="group"
          aria-label={formatMessage({ id: "app.hypercerts.metadata.sdgs" })}
        >
          {SDG_VALUES.map((value) => {
            const isSelected = draft.sdgs.includes(value);
            const sdgName = getSdgName(value, intl);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onUpdate({
                    sdgs: isSelected
                      ? draft.sdgs.filter((sdg) => sdg !== value)
                      : [...draft.sdgs, value],
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition text-left",
                  isSelected
                    ? "border-primary-base bg-primary-lighter text-primary-dark"
                    : "border-stroke-sub text-text-sub hover:border-primary-light"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                    isSelected
                      ? "bg-primary-base text-primary-foreground"
                      : "bg-bg-soft text-text-sub"
                  )}
                >
                  {value}
                </span>
                <span className="flex-1 line-clamp-2">{sdgName}</span>
                {isSelected && <RiCheckLine className="h-4 w-4 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-text-strong">
            {formatMessage({ id: "app.hypercerts.metadata.capitals" })}
          </p>
          <p className="text-xs text-text-sub">
            {formatMessage({ id: "app.hypercerts.metadata.capitals.helper" })}
          </p>
        </div>
        <div
          className="grid gap-2 sm:grid-cols-2"
          role="group"
          aria-label={formatMessage({ id: "app.hypercerts.metadata.capitals" })}
        >
          {CAPITALS.map((capital) => {
            const isSelected = draft.capitals.includes(capital);
            const capitalLabel = formatMessage({ id: `app.hypercerts.capital.${capital}` });
            return (
              <button
                key={capital}
                type="button"
                aria-pressed={isSelected}
                aria-label={capitalLabel}
                onClick={() =>
                  onUpdate({
                    capitals: isSelected
                      ? draft.capitals.filter((item) => item !== capital)
                      : [...draft.capitals, capital],
                  })
                }
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition",
                  isSelected
                    ? "border-primary-base bg-primary-lighter text-primary-dark"
                    : "border-stroke-sub text-text-sub hover:border-primary-light"
                )}
              >
                <span>{capitalLabel}</span>
                {isSelected && <RiCheckLine className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
