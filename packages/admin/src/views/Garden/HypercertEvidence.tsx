import { Alert } from "@green-goods/shared/components/Alert";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import { useIntl } from "react-intl";
import { EnsAddressText } from "@/components/EnsAddressText";

/** Linked evidence has its own read state; issuance facts remain available independently. */
export function HypercertEvidence({
  attestations,
  isLoading,
  hasError,
}: {
  attestations: HypercertRecord["attestations"];
  isLoading: boolean;
  hasError: boolean;
}) {
  const { formatMessage } = useIntl();
  const untitledWork = formatMessage({ id: "app.admin.work.untitledWork" });
  if (!isLoading && !hasError && !attestations?.length) return null;
  return (
    <section className="surface-inset p-6">
      <h3 className="type-body font-semibold text-text-strong">
        {formatMessage({ id: "app.hypercerts.detail.attestationRefs" })}
      </h3>
      {isLoading && (
        <p role="status" className="mt-3 type-body text-text-sub">
          {formatMessage({ id: "app.hypercerts.attestations.loading" })}
        </p>
      )}
      {hasError && (
        <Alert variant="error">{formatMessage({ id: "app.hypercerts.attestations.error" })}</Alert>
      )}
      {!isLoading && (
        <div className="mt-3 space-y-2">
          {attestations?.map((attestation) => (
            <div
              key={attestation.id}
              className="rounded-md border border-stroke-soft bg-bg-weak px-3 py-2 type-meta"
            >
              <div className="font-medium text-text-strong">
                {toWorkDisplayTitle(attestation.title, untitledWork)}
              </div>
              <div className="text-text-sub">
                <EnsAddressText
                  address={attestation.gardenerAddress}
                  fallbackName={attestation.gardenerName}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
