import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";
import { publicJarLink } from "./helpers";
import { ReviewLine } from "./ReviewLine";

/**
 * What a created jar is, shown on the Review under its status row (DL-080):
 * its address and public link, and what the chain reads back. The status row
 * says it was created; the footer's Done and Create Another are the ways on.
 */
export function CampaignCookieJarCreatedState({ jarAddress }: { jarAddress: Address }) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(jarAddress);
  const publicUrl = publicJarLink(jarAddress);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-3 rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-white-0 p-4">
        <div>
          <p className="text-label-md text-text-strong">
            {formatMessage({
              id: "cockpit.community.cookies.jarAddress",
              defaultMessage: "Jar address",
            })}
          </p>
          <p className="mt-1 break-all text-body-sm text-text-sub">
            <EnsAddressText address={jarAddress} />
          </p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 break-all text-label-md text-primary-dark underline-offset-4 hover:underline"
          >
            {publicUrl}
            <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden />
          </a>
        </div>
        <AdminButton type="button" variant="outlined" asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            {formatMessage({
              id: "cockpit.community.cookies.openPublicLink",
              defaultMessage: "Open Public Link",
            })}
          </a>
        </AdminButton>
      </div>
      <AdminCard variant="outlined" className="space-y-3">
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.community.cookies.onchainReadTitle",
            defaultMessage: "Onchain read",
          })}
        </AdminCardTitle>
        {isLoading ? (
          <p className="text-body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.cookies.onchainReadLoading",
              defaultMessage: "Reading jar details...",
            })}
          </p>
        ) : jar ? (
          <div>
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.rowBalance",
                defaultMessage: "Jar balance",
              })}
              value={`${formatTokenAmount(jar.balance, jar.decimals, 4)} ${jar.symbol}`}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.claimAmountPerSteward",
                defaultMessage: "Claim amount per steward",
              })}
              value={`${formatTokenAmount(jar.fixedAmount, jar.decimals, 4)} ${jar.symbol}`}
            />
            <ReviewLine
              label={formatMessage({
                id: "cockpit.community.cookies.generatedStewards",
                defaultMessage: "Stewards who can claim",
              })}
              value={jar.allowlist.length}
            />
          </div>
        ) : (
          <p className="text-body-sm text-error-dark">
            {formatMessage({
              id: "cockpit.community.cookies.onchainReadUnavailable",
              defaultMessage:
                "The jar was created, but this browser could not read the jar details yet.",
            })}
          </p>
        )}
        {hasDetailReadFailure ? (
          <p className="text-body-sm text-text-sub">
            {formatMessage({
              id: "cockpit.community.cookies.onchainReadPartial",
              defaultMessage:
                "Some optional metadata reads failed. The direct jar link still works.",
            })}
          </p>
        ) : null}
      </AdminCard>
    </div>
  );
}

/**
 * A create the wallet submitted without saying which jar it made (a Safe-style
 * queue), shown on the Review under its status row: the transaction, and a
 * field for the jar's address once it runs.
 */
export function CampaignCookieJarSubmittedState({
  hash,
  manualInput,
  manualAddress,
  onManualInputChange,
  onUseManualAddress,
}: {
  hash: string;
  manualInput: string;
  manualAddress: Address | null;
  onManualInputChange: (value: string) => void;
  onUseManualAddress: () => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-white-0 p-4">
        <p className="text-label-md text-text-strong">
          {formatMessage({
            id: "cockpit.community.cookies.submittedTransaction",
            defaultMessage: "Submitted transaction",
          })}
        </p>
        <p className="mt-1 break-all text-body-sm text-text-sub">{hash}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <AdminTextField
          id="campaign-cookie-jar-created-address"
          className="min-w-0"
          label={formatMessage({
            id: "cockpit.community.cookies.createdJarAddressInput",
            defaultMessage: "Created jar address",
          })}
          value={manualInput}
          onChange={(event) => onManualInputChange(event.target.value)}
          error={
            manualInput && !manualAddress
              ? formatMessage({
                  id: "cockpit.community.cookies.invalidAddress",
                  defaultMessage: "Enter a valid Ethereum address.",
                })
              : undefined
          }
        />
        {/* Lifted over the field's reserved supporting line, so it lines up with the field. */}
        <AdminButton
          type="button"
          onClick={onUseManualAddress}
          disabled={!manualAddress}
          className="md:mb-5"
        >
          {formatMessage({
            id: "cockpit.community.cookies.useCreatedJar",
            defaultMessage: "Use jar address",
          })}
        </AdminButton>
      </div>
    </div>
  );
}
