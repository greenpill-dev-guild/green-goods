import { type Address, AddressDisplay, useHypercerts, useInViewReveal } from "@green-goods/shared";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker } from "@/components/Public/atoms";
import { ListSkeleton, SectionEmpty } from "./GardenDetailAtoms";

/**
 * Shared section shell — reveal wrapper, kicker, heading, helper. Every section
 * renders whether or not it has content, so the ordinals stay stable across
 * Gardens and an absent thing can say it is absent.
 */
export function Section({
  id,
  kicker,
  heading,
  helper,
  children,
}: {
  id: string;
  kicker: string;
  heading: string;
  helper?: string;
  children: ReactNode;
}) {
  const { ref, revealed } = useInViewReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      data-revealed={revealed}
      className="editorial-section-reveal"
      aria-labelledby={id}
    >
      <header className="border-b border-stroke-soft-200 pb-6">
        <EditorialKicker className="mb-3">{kicker}</EditorialKicker>
        <EditorialHeading id={id}>{heading}</EditorialHeading>
        {helper ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-sub-600 md:text-base">
            {helper}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function CertificatesSection({
  certificates,
  loading,
}: {
  certificates: ReturnType<typeof useHypercerts>["hypercerts"];
  loading: boolean;
}) {
  const { formatMessage } = useIntl();

  return (
    <Section
      id="public-garden-detail-certificates"
      kicker={formatMessage({
        id: "public.gardenDetail.section.certificates",
        defaultMessage: "§ 03: Certificates",
      })}
      heading={formatMessage({
        id: "public.gardenDetail.certificates.heading",
        defaultMessage: "Impact Certificates",
      })}
      helper={formatMessage({
        id: "public.gardenDetail.certificates.helper",
        defaultMessage:
          "Bundles of approved Work grounded in an Assessment and anchored to a public blockchain.",
      })}
    >
      {loading ? (
        <ListSkeleton />
      ) : certificates.length === 0 ? (
        <SectionEmpty
          message={formatMessage({
            id: "public.gardenDetail.certificates.empty",
            defaultMessage:
              "No Impact Certificates yet. They appear when approved Work is bundled.",
          })}
        />
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-stroke-soft-200 border-b border-stroke-soft-200">
          {certificates.map((cert) => (
            <li key={cert.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p
                  className="truncate font-serif text-base text-text-strong-950"
                  title={cert.title ?? cert.id}
                >
                  {cert.title ||
                    formatMessage({
                      id: "public.gardenDetail.certificates.untitled",
                      defaultMessage: "Untitled certificate",
                    })}
                </p>
                {cert.workScopes && cert.workScopes.length > 0 ? (
                  <p
                    className="mt-1 truncate text-xs uppercase tracking-wide text-text-soft-400"
                    title={cert.workScopes.join(" · ")}
                  >
                    {cert.workScopes.join(" · ")}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                {formatMessage(
                  {
                    id: "public.gardenDetail.certificates.attestations",
                    defaultMessage: "{count, plural, one {# attestation} other {# attestations}}",
                  },
                  { count: cert.attestationCount }
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function OperatorsSection({
  operators,
  loading,
}: {
  operators: Address[];
  loading: boolean;
}) {
  const { formatMessage } = useIntl();

  return (
    <Section
      id="public-garden-detail-operators"
      kicker={formatMessage({
        id: "public.gardenDetail.section.operators",
        defaultMessage: "§ 04: Operators",
      })}
      heading={formatMessage({
        id: "public.gardenDetail.operators.heading",
        defaultMessage: "Operators",
      })}
      helper={formatMessage({
        id: "public.gardenDetail.operators.helper",
        defaultMessage: "Trusted coordinators who approve Work and steward the Garden.",
      })}
    >
      {loading ? (
        <ListSkeleton rows={2} />
      ) : operators.length === 0 ? (
        <SectionEmpty
          message={formatMessage({
            id: "public.gardenDetail.operators.empty",
            defaultMessage: "No operators are listed for this Garden yet.",
          })}
        />
      ) : (
        <ul className="mt-8 flex flex-wrap gap-3">
          {operators.map((address) => (
            <li
              key={address}
              className="border border-stroke-soft-200 bg-bg-white-0 px-4 py-2 text-sm text-text-sub-600"
            >
              <AddressDisplay address={address} showCopyButton={false} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
