import {
  formatDateTime,
  FormInput,
  ACTION_DOMAINS,
  type ActionDomain,
  type HypercertAttestation,
} from "@green-goods/shared";
import { cn } from "@green-goods/shared/utils";
import { RiCheckboxCircleLine, RiCheckboxMultipleLine, RiCloseCircleLine } from "@remixicon/react";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";

interface AttestationSelectorProps {
  attestations: HypercertAttestation[];
  selectedIds: string[];
  onToggle: (uid: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onDeselectAll?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  bundledInfo?: Record<string, { hypercertId: string; title?: string | null }>;
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
}: AttestationSelectorProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainOption | "">("");

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return attestations.filter((attestation) => {
      if (domainFilter && attestation.domain !== domainFilter) return false;
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
  }, [attestations, domainFilter, searchQuery]);

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

      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <FormInput
          id="attestation-search"
          label={formatMessage({ id: "app.hypercerts.attestations.search.label" })}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={formatMessage({
            id: "app.hypercerts.attestations.search.placeholder",
          })}
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="domain-filter"
            className="font-semibold text-text-strong-950 text-label-sm"
          >
            {formatMessage({ id: "app.hypercerts.attestations.filter.domain" })}
          </label>
          <select
            id="domain-filter"
            aria-label={formatMessage({ id: "app.hypercerts.attestations.filter.domain" })}
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value as DomainOption | "")}
            className="block w-full bg-bg-white-0 border border-stroke-sub-300 rounded-lg py-3 px-4 text-sm text-text-strong-950 transition-all duration-200 focus:ring-2 focus:ring-primary-lighter focus:border-primary-base"
          >
            <option value="">{formatMessage({ id: "app.hypercerts.filters.all" })}</option>
            {DOMAIN_OPTIONS.map((domain) => (
              <option key={domain} value={domain}>
                {formatMessage({ id: `app.hypercerts.domain.${domain}` })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk selection buttons */}
      {!isLoading && !hasError && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={allFilteredSelected || selectable.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
              allFilteredSelected || selectable.length === 0
                ? "border-stroke-soft bg-bg-weak text-text-disabled cursor-not-allowed"
                : "border-stroke-sub text-text-sub hover:bg-bg-weak"
            )}
          >
            <RiCheckboxMultipleLine className="h-3.5 w-3.5" />
            {formatMessage({ id: "app.hypercerts.attestations.selectAll" })}
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={!someSelected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
              !someSelected
                ? "border-stroke-soft bg-bg-weak text-text-disabled cursor-not-allowed"
                : "border-stroke-sub text-text-sub hover:bg-bg-weak"
            )}
          >
            <RiCloseCircleLine className="h-3.5 w-3.5" />
            {formatMessage({ id: "app.hypercerts.attestations.deselectAll" })}
          </button>
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
        <div className="rounded-lg border border-error-light bg-error-lighter p-6 text-sm text-error-dark">
          {formatMessage({ id: "app.hypercerts.attestations.error" })}
        </div>
      )}

      {!isLoading && !hasError && filtered.length === 0 && (
        <div className="rounded-lg border border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
          {formatMessage({ id: "app.hypercerts.attestations.empty" })}
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
            <button
              key={attestation.id}
              type="button"
              onClick={() => {
                if (isBundled) return;
                onToggle(attestation.id);
              }}
              aria-pressed={isSelected}
              aria-disabled={isBundled}
              disabled={isBundled}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-4 text-left transition",
                "focus:outline-none focus:ring-2 focus:ring-primary-base focus:ring-offset-2",
                isBundled
                  ? "border-stroke-soft bg-bg-weak text-text-disabled cursor-not-allowed"
                  : isSelected
                    ? "border-primary-base bg-primary-lighter"
                    : "border-stroke-soft bg-bg-white hover:border-primary-light"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-text-strong">{attestation.title}</h3>
                  <p className="text-xs text-text-sub">
                    {attestation.gardenerName ?? attestation.gardenerAddress}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                    isBundled
                      ? "border-warning-light bg-warning-lighter text-warning-dark"
                      : isSelected
                        ? "border-primary-base bg-primary-base text-primary-foreground"
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
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-sub">
                {attestation.domain && (
                  <span className="rounded-full bg-bg-weak px-2 py-0.5">
                    {formatMessage({ id: `app.hypercerts.domain.${attestation.domain}` })}
                  </span>
                )}
                {attestation.actionType && (
                  <span className="rounded-full bg-bg-weak px-2 py-0.5">
                    {formatMessage({ id: `app.hypercerts.action.${attestation.actionType}` })}
                  </span>
                )}
                {formattedDate && (
                  <span>
                    {formatMessage(
                      { id: "app.hypercerts.attestations.approvedOn" },
                      { date: formattedDate }
                    )}
                  </span>
                )}
                {isBundled && bundledLabel && (
                  <span>
                    {formatMessage(
                      { id: "app.hypercerts.attestations.bundledIn" },
                      { title: bundledLabel }
                    )}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
