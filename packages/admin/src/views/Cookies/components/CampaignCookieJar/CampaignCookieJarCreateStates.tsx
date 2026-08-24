import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import type { Address } from "@green-goods/shared/types/domain";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiTimeLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { EnsAddressText } from "@/components/EnsAddressText";
import { publicJarLink } from "./helpers";
import { ReviewLine } from "./ReviewLine";

export function CampaignCookieJarCreatedState({
  jarAddress,
  onBackToList,
  onCreateAnother,
}: {
  jarAddress: Address;
  onBackToList: () => void;
  onCreateAnother: () => void;
}) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, hasDetailReadFailure } = useCampaignCookieJar(jarAddress);
  const publicUrl = publicJarLink(jarAddress);

  return (
    <section className="surface-section">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]">
              <RiCheckboxCircleLine className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteEyebrow",
                  defaultMessage: "Transaction confirmed",
                })}
              </p>
              <h2 className="mt-1 text-headline-sm font-semibold text-[rgb(var(--m3-on-surface))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteTitle",
                  defaultMessage: "Cookie jar created",
                })}
              </h2>
              <p className="mt-2 max-w-2xl text-body-md text-[rgb(var(--m3-on-surface-variant))]">
                {formatMessage({
                  id: "cockpit.community.cookies.createCompleteDescription",
                  defaultMessage:
                    "The jar address was captured from the confirmed transaction and is queryable onchain. It may take the indexer a moment to show it in the campaign list.",
                })}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-4">
            <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.jarAddress",
                defaultMessage: "Jar address",
              })}
            </p>
            <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              <EnsAddressText address={jarAddress} />
            </p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 break-all text-label-md text-[rgb(var(--m3-primary))] underline-offset-4 hover:underline"
            >
              {publicUrl}
              <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" leadingIcon={<RiArrowLeftLine />} onClick={onBackToList}>
              {formatMessage({
                id: "cockpit.community.cookies.backToJars",
                defaultMessage: "Back to cookie jars",
              })}
            </AdminButton>
            <AdminButton type="button" variant="outlined" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {formatMessage({
                  id: "cockpit.community.cookies.openPublicLink",
                  defaultMessage: "Open public link",
                })}
              </a>
            </AdminButton>
            <AdminButton
              type="button"
              variant="text"
              leadingIcon={<RiAddLine />}
              onClick={onCreateAnother}
            >
              {formatMessage({
                id: "cockpit.community.cookies.createAnother",
                defaultMessage: "Create another",
              })}
            </AdminButton>
          </div>
        </div>

        <AdminCard variant="outlined" className="space-y-3">
          <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.onchainReadTitle",
              defaultMessage: "Onchain read",
            })}
          </h3>
          {isLoading ? (
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
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
                  id: "cockpit.community.cookies.claimAmountPerOperator",
                  defaultMessage: "Claim amount per operator",
                })}
                value={`${formatTokenAmount(jar.fixedAmount, jar.decimals, 4)} ${jar.symbol}`}
              />
              <ReviewLine
                label={formatMessage({
                  id: "cockpit.community.cookies.generatedOperators",
                  defaultMessage: "Generated operators",
                })}
                value={jar.allowlist.length}
              />
            </div>
          ) : (
            <p className="text-body-sm text-[rgb(var(--m3-error))]">
              {formatMessage({
                id: "cockpit.community.cookies.onchainReadUnavailable",
                defaultMessage:
                  "The jar was created, but this browser could not read the jar details yet.",
              })}
            </p>
          )}
          {hasDetailReadFailure ? (
            <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.onchainReadPartial",
                defaultMessage:
                  "Some optional metadata reads failed. The direct jar link still works.",
              })}
            </p>
          ) : null}
        </AdminCard>
      </div>
    </section>
  );
}

export function CampaignCookieJarSubmittedState({
  hash,
  manualInput,
  manualAddress,
  onManualInputChange,
  onUseManualAddress,
  onBackToList,
}: {
  hash: string;
  manualInput: string;
  manualAddress: Address | null;
  onManualInputChange: (value: string) => void;
  onUseManualAddress: () => void;
  onBackToList: () => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <section className="surface-section">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]">
            <RiTimeLine className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmittedEyebrow",
                defaultMessage: "Submitted",
              })}
            </p>
            <h2 className="mt-1 text-headline-sm font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmitted",
                defaultMessage: "Creation submitted",
              })}
            </h2>
            <p className="mt-2 max-w-2xl text-body-md text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage({
                id: "cockpit.community.cookies.createSubmittedDescription",
                defaultMessage:
                  "The wallet returned a submitted transaction without a final jar address. Once the transaction is executed, paste the created jar address to generate the public link and seed the sync form.",
              })}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-4">
          <p className="text-label-md text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.submittedTransaction",
              defaultMessage: "Submitted transaction",
            })}
          </p>
          <p className="mt-1 break-all text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {hash}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <FormField
            label={formatMessage({
              id: "cockpit.community.cookies.createdJarAddressInput",
              defaultMessage: "Created jar address",
            })}
            htmlFor="campaign-cookie-jar-created-address"
            error={
              manualInput && !manualAddress
                ? formatMessage({
                    id: "cockpit.community.cookies.invalidAddress",
                    defaultMessage: "Enter a valid Ethereum address.",
                  })
                : undefined
            }
          >
            <TextInput
              id="campaign-cookie-jar-created-address"
              surface="admin"
              value={manualInput}
              onChange={(event) => onManualInputChange(event.target.value)}
            />
          </FormField>
          <AdminButton type="button" onClick={onUseManualAddress} disabled={!manualAddress}>
            {formatMessage({
              id: "cockpit.community.cookies.useCreatedJar",
              defaultMessage: "Use jar address",
            })}
          </AdminButton>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminButton type="button" variant="outlined" onClick={onBackToList}>
            {formatMessage({
              id: "cockpit.community.cookies.backToJars",
              defaultMessage: "Back to cookie jars",
            })}
          </AdminButton>
        </div>
      </div>
    </section>
  );
}
