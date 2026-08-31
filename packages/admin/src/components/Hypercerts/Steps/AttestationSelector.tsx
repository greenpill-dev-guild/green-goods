import { Alert } from "@green-goods/shared/components/Alert";
import { filterAttestationsByAssessment } from "@green-goods/shared/modules/data/hypercerts-filters";
import type { GardenAssessment } from "@green-goods/shared/types/domain";
import type { EASGardenAssessment } from "@green-goods/shared/types/eas-responses";
import {
  ACTION_DOMAINS,
  type ActionDomain,
  type HypercertAttestation,
} from "@green-goods/shared/types/hypercerts";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { formatDateTime } from "@green-goods/shared/utils/time";
import { RiCheckboxCircleLine, RiCheckboxMultipleLine, RiCloseCircleLine } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminSelectableCard } from "@/components/AdminSelectableCard";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";

interface AttestationSelectorProps {
  attestations: HypercertAttestation[];
  selectedIds: string[];
  onToggle: (uid: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onDeselectAll?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  bundledInfo?: Record<string, { hypercertId: string; title?: string | null }>;
  /** Available assessments for filtering attestations */
  assessments?: (GardenAssessment | EASGardenAssessment)[];
  /** Currently selected assessment ID */
  selectedAssessmentId?: string | null;
  /** Callback when assessment selection changes */
  onAssessmentChange?: (assessmentId: string | null) => void;
}

/** Domain options derived from the canonical ActionDomain constant */
const DOMAIN_OPTIONS = ACTION_DOMAINS;

type DomainOption = ActionDomain;

export function AttestationSelector({
  attestations,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  isLoading,
  hasError,
  bundledInfo,
  assessments,
  selectedAssessmentId,
  onAssessmentChange,
}: AttestationSelectorProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainOption | "">("");

  const selectedAssessment = useMemo(
    () => assessments?.find((a) => a.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId]
  );

  const filtered = useMemo(() => {
    // Apply assessment filter first (reportingPeriod + domain)
    const base = selectedAssessment
      ? filterAttestationsByAssessment(attestations, selectedAssessment)
      : attestations;

    const query = searchQuery.trim().toLowerCase();
    return base.filter((attestation) => {
      // Manual domain filter takes precedence only when no assessment is selected
      if (!selectedAssessment && domainFilter && attestation.domain !== domainFilter) return false;
      if (!query) return true;
      const haystack = [
        attestation.title,
        attestation.gardenerName ?? "",
        attestation.gardenerAddress ?? "",
        attestation.domain ?? "",
        attestation.actionType ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [attestations, domainFilter, searchQuery, selectedAssessment]);

  const selectable = useMemo(
    () => filtered.filter((attestation) => !bundledInfo?.[attestation.id]),
    [bundledInfo, filtered]
  );

  const handleSelectAll = useCallback(() => {
    if (onSelectAll) {
      const filteredIds = selectable.map((a) => a.id);
      onSelectAll(filteredIds);
    } else {
      // Fallback: toggle each filtered attestation that's not selected
      selectable.forEach((attestation) => {
        if (!selectedIds.includes(attestation.id)) {
          onToggle(attestation.id);
        }
      });
    }
  }, [onSelectAll, onToggle, selectable, selectedIds]);

  const handleDeselectAll = useCallback(() => {
    if (onDeselectAll) {
      onDeselectAll();
    } else {
      // Fallback: toggle each selected attestation
      selectedIds.forEach((id) => onToggle(id));
    }
  }, [onDeselectAll, onToggle, selectedIds]);

  const allFilteredSelected =
    selectable.length > 0 && selectable.every((a) => selectedIds.includes(a.id));
  const someSelected = selectedIds.length > 0;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-strong">
          {formatMessage({ id: "app.hypercerts.attestations.title" })}
        </h2>
        <p className="text-sm text-text-sub">
          {formatMessage(
            { id: "app.hypercerts.attestations.count" },
            { count: attestations.length }
          )}
          {selectedIds.length > 0
            ? ` · ${formatMessage(
                { id: "app.hypercerts.attestations.selected" },
                { count: selectedIds.length }
              )}`
            : ""}
        </p>
      </header>

      {/* Assessment filter (only shown when assessments are available) */}
      {assessments && assessments.length > 0 && onAssessmentChange && (
        <AdminSelect
          id="assessment-filter"
          label={formatMessage({ id: "app.hypercerts.attestations.filter.assessment" })}
          value={selectedAssessmentId ?? ""}
          onChange={(event) => onAssessmentChange(event.target.value || null)}
        >
          <option value="">
            {formatMessage({ id: "app.hypercerts.attestations.filter.assessment.none" })}
          </option>
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.title}
            </option>
          ))}
        </AdminSelect>
      )}

      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <AdminTextField
          id="attestation-search"
          label={formatMessage({ id: "app.hypercerts.attestations.search.label" })}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={formatMessage({
            id: "app.hypercerts.attestations.search.placeholder",
          })}
        />
        <AdminSelect
          id="domain-filter"
          label={formatMessage({ id: "app.hypercerts.attestations.filter.domain" })}
          value={selectedAssessment ? "" : domainFilter}
          disabled={Boolean(selectedAssessment)}
          onChange={(event) => setDomainFilter(event.target.value as DomainOption | "")}
        >
          <option value="">{formatMessage({ id: "app.hypercerts.filters.all" })}</option>
          {DOMAIN_OPTIONS.map((domain) => (
            <option key={domain} value={domain}>
              {formatMessage({ id: `app.hypercerts.domain.${domain}` })}
            </option>
          ))}
        </AdminSelect>
      </div>

      {/* Bulk selection buttons */}
      {!isLoading && !hasError && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={handleSelectAll}
            disabled={allFilteredSelected || selectable.length === 0}
            leadingIcon={<RiCheckboxMultipleLine />}
          >
            {formatMessage({ id: "app.hypercerts.attestations.selectAll" })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={handleDeselectAll}
            disabled={!someSelected}
            leadingIcon={<RiCloseCircleLine />}
          >
            {formatMessage({ id: "app.hypercerts.attestations.deselectAll" })}
          </AdminButton>
        </div>
      )}

      {isLoading && (
        <div
          className="grid gap-3"
          role="status"
          aria-busy="true"
          aria-label={formatMessage({ id: "app.hypercerts.attestations.loading" })}
        >
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/5 rounded bg-bg-soft" />
                  <div className="h-3 w-2/5 rounded bg-bg-soft" />
                </div>
                <div className="h-6 w-16 rounded-full bg-bg-soft" />
              </div>
              <div className="mt-3 flex gap-2">
                <div className="h-5 w-20 rounded-full bg-bg-soft" />
                <div className="h-5 w-16 rounded-full bg-bg-soft" />
                <div className="h-5 w-28 rounded-full bg-bg-soft" />
              </div>
            </div>
          ))}
        </div>
      )}

      {hasError && !isLoading && (
        <Alert variant="error">{formatMessage({ id: "app.hypercerts.attestations.error" })}</Alert>
      )}

      {!isLoading && !hasError && filtered.length === 0 && (
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
          {formatMessage({
            id:
              attestations.length === 0
                ? "app.hypercerts.attestations.emptyUnavailable"
                : "app.hypercerts.attestations.empty",
          })}
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((attestation) => {
          const isSelected = selectedIds.includes(attestation.id);
          const bundled = bundledInfo?.[attestation.id];
          const isBundled = Boolean(bundled);
          const approvedAt = attestation.approvedAt || attestation.createdAt;
          const formattedDate = approvedAt
            ? formatDateTime(approvedAt * 1000, { dateStyle: "medium" })
            : "";
          const bundledLabel = bundled?.title?.trim()
            ? bundled.title.trim()
            : bundled
              ? formatMessage(
                  { id: "app.hypercerts.attestations.bundledInFallback" },
                  { id: bundled.hypercertId }
                )
              : "";

          return (
            <AdminSelectableCard
              key={attestation.id}
              selected={isSelected}
              disabled={isBundled}
              aria-disabled={isBundled}
              onClick={() => {
                if (isBundled) return;
                onToggle(attestation.id);
              }}
              title={attestation.title}
              description={
                <EnsAddressText
                  address={attestation.gardenerAddress}
                  fallbackName={attestation.gardenerName}
                />
              }
              meta={
                <>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 body-sm",
                      isBundled
                        ? "border-warning-light bg-warning-lighter text-warning-dark"
                        : isSelected
                          ? "border-transparent bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]"
                          : "border-stroke-sub text-text-sub"
                    )}
                  >
                    {!isBundled && isSelected && <RiCheckboxCircleLine className="h-3.5 w-3.5" />}
                    {isBundled
                      ? formatMessage({ id: "app.hypercerts.attestations.bundledBadge" })
                      : isSelected
                        ? formatMessage({ id: "app.hypercerts.attestations.selectedBadge" })
                        : formatMessage({ id: "app.hypercerts.attestations.select" })}
                  </span>
                  {attestation.domain && (
                    <span className="rounded-full bg-bg-weak px-2 py-0.5 body-sm text-text-sub">
                      {formatMessage({ id: `app.hypercerts.domain.${attestation.domain}` })}
                    </span>
                  )}
                  {attestation.actionType && (
                    <span className="rounded-full bg-bg-weak px-2 py-0.5 body-sm text-text-sub">
                      {formatMessage({ id: `app.hypercerts.action.${attestation.actionType}` })}
                    </span>
                  )}
                  {formattedDate && (
                    <span className="body-sm text-text-sub">
                      {formatMessage(
                        { id: "app.hypercerts.attestations.approvedOn" },
                        { date: formattedDate }
                      )}
                    </span>
                  )}
                  {isBundled && bundledLabel && (
                    <span className="body-sm text-text-sub">
                      {formatMessage(
                        { id: "app.hypercerts.attestations.bundledIn" },
                        { title: bundledLabel }
                      )}
                    </span>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
