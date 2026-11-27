import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminTextField } from "@/components/AdminTextField";
import { EnsAddressText } from "@/components/EnsAddressText";
import { publicJarLink } from "./helpers";

/**
 * What a created jar is, shown on the Review under its status row (DL-080):
 * its address and public link, and what the chain reads back. The status row
 * says it was created; the footer's Done and Create Another are the ways on.
 */
export function CampaignCookieJarCreatedState({ jarAddress }: { jarAddress: Address }) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(jarAddress);
  const isVariableClaim = jar?.withdrawalType === "variable";
  const publicUrl = publicJarLink(jarAddress);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-3 rounded-[var(--m3-shape-md)] border border-stroke-soft bg-bg-white-0 p-4">
        <div>
          <p className="type-label-sm text-text-strong">
            {formatMessage({
              id: "hub.community.cookies.jarAddress",
              defaultMessage: "Jar address",
            })}
          </p>
          <p className="mt-1 break-all type-meta text-text-sub">
            <EnsAddressText address={jarAddress} />
          </p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 break-all type-label-sm text-primary-dark underline-offset-4 hover:underline"
          >
            {publicUrl}
            <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden />
          </a>
        </div>
        <Button type="button" emphasis="secondary" size="sm" asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            {formatMessage({
              id: "hub.community.cookies.openPublicLink",
              defaultMessage: "Open Public Link",
            })}
          </a>
        </Button>
      </div>
      <AdminCard variant="outlined" className="space-y-3">
        <AdminCardTitle>
          {formatMessage({
            id: "hub.community.cookies.onchainReadTitle",
            defaultMessage: "Onchain read",
          })}
        </AdminCardTitle>
        {isLoading ? (
          <p className="type-meta text-text-sub">
            {formatMessage({
              id: "hub.community.cookies.onchainReadLoading",
              defaultMessage: "Reading jar details...",
            })}
          </p>
        ) : jar ? (
          <FactList frame="inset">
            <FactRow
              label={formatMessage({
                id: "hub.community.cookies.rowBalance",
                defaultMessage: "Jar balance",
              })}
              value={`${formatTokenAmount(jar.balance, jar.decimals, 4)} ${jar.symbol}`}
            />
            <FactRow
              label={formatMessage(
                isVariableClaim
                  ? {
                      id: "hub.community.cookies.maximumClaimPerSteward",
                      defaultMessage: "Maximum claim per steward",
                    }
                  : {
                      id: "hub.community.cookies.claimAmountPerSteward",
                      defaultMessage: "Claim amount per steward",
                    }
              )}
              value={`${formatTokenAmount(
                isVariableClaim ? jar.maxWithdrawal : jar.fixedAmount,
                jar.decimals,
                jar.decimals
              )} ${jar.symbol}`}
            />
            <FactRow
              label={formatMessage({
                id: "hub.community.cookies.generatedStewards",
                defaultMessage: "Stewards who can claim",
              })}
              value={jar.allowlist.length}
            />
          </FactList>
        ) : (
          <p className="type-meta text-error-dark">
            {formatMessage({
              id: "hub.community.cookies.onchainReadUnavailable",
              defaultMessage:
                "The jar was created, but this browser could not read the jar details yet.",
            })}
          </p>
        )}
        {hasDetailReadFailure ? (
          <p className="type-meta text-text-sub">
            {formatMessage({
              id: "hub.community.cookies.onchainReadPartial",
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
        <p className="type-label-sm text-text-strong">
          {formatMessage({
            id: "hub.community.cookies.submittedTransaction",
            defaultMessage: "Submitted transaction",
          })}
        </p>
        <p className="mt-1 break-all type-meta text-text-sub">{hash}</p>
      </div>
      <AdminTextField
        id="campaign-cookie-jar-created-address"
        label={formatMessage({
          id: "hub.community.cookies.createdJarAddressInput",
          defaultMessage: "Created jar address",
        })}
        value={manualInput}
        onChange={(event) => onManualInputChange(event.target.value)}
        error={
          manualInput && !manualAddress
            ? formatMessage({
                id: "hub.community.cookies.invalidAddress",
                defaultMessage: "Enter a valid Ethereum address.",
              })
            : undefined
        }
        action={
          <Button size="sm" type="button" onClick={onUseManualAddress} disabled={!manualAddress}>
            {formatMessage({
              id: "hub.community.cookies.useCreatedJar",
              defaultMessage: "Use jar address",
            })}
          </Button>
        }
      />
    </div>
  );
}
