import {
  DEFAULT_CHAIN_ID,
  ENSProgressTimeline,
  useENSClaim,
  useENSRegistrationStatus,
  useOffline,
  useProtocolMemberStatus,
  useSlugAvailability,
  useSlugForm,
  type Address,
} from "@green-goods/shared";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "@green-goods/shared/utils";
import { RiAlertLine, RiCheckLine, RiGlobalLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { zeroAddress } from "viem";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

interface ENSSectionProps {
  primaryAddress: Address | undefined;
}

const GREENGOODS_ENS_SUFFIX = ".greengoods.eth";

function getStoredSlugKey(address: Address) {
  return `gg:ens:slug:${DEFAULT_CHAIN_ID}:${address.toLowerCase()}`;
}

function normalizeSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;

  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized.includes(".") || normalized.endsWith(GREENGOODS_ENS_SUFFIX)) {
    return null;
  }

  return normalized;
}

export const ENSSection: React.FC<ENSSectionProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const { isOnline } = useOffline();
  const { data: isProtocolMember = false } = useProtocolMemberStatus(
    primaryAddress as `0x${string}` | undefined
  );
  const slugForm = useSlugForm();
  const slugValue = slugForm.watch("slug");
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useSlugAvailability(
    slugValue || undefined
  );
  const ensClaim = useENSClaim();
  const [accountEnsState, setAccountEnsState] = useState<{
    address: Address;
    slug: string | null;
    status: "loading" | "ready" | "error";
  } | null>(null);
  const [trackedSlugState, setTrackedSlugState] = useState<{
    address: Address;
    slug: string | null;
  } | null>(null);

  const storageKey = useMemo(
    () => (primaryAddress ? getStoredSlugKey(primaryAddress) : null),
    [primaryAddress]
  );
  const accountEnsSlug =
    primaryAddress && accountEnsState?.address === primaryAddress ? accountEnsState.slug : null;
  const accountEnsLookupStatus =
    primaryAddress && accountEnsState?.address === primaryAddress ? accountEnsState.status : null;
  const trackedSlug =
    primaryAddress && trackedSlugState?.address === primaryAddress ? trackedSlugState.slug : null;

  useEffect(() => {
    let cancelled = false;

    if (!primaryAddress) {
      setAccountEnsState(null);
      return;
    }

    setAccountEnsState((current) =>
      current?.address === primaryAddress
        ? { ...current, status: "loading" }
        : { address: primaryAddress, slug: null, status: "loading" }
    );

    const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
    const ensAddress = contracts.greenGoodsENS as Address | undefined;
    if (!ensAddress || ensAddress === zeroAddress) {
      setAccountEnsState({ address: primaryAddress, slug: null, status: "ready" });
      return;
    }

    const { publicClient } = createClients(DEFAULT_CHAIN_ID);
    void publicClient
      .readContract({
        address: ensAddress,
        abi: GreenGoodsENSABI,
        functionName: "ownerToSlug",
        args: [primaryAddress],
      })
      .then((slug) => {
        if (!cancelled) {
          setAccountEnsState({
            address: primaryAddress,
            slug: normalizeSlug(slug as string),
            status: "ready",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountEnsState((current) =>
            current?.address === primaryAddress
              ? { ...current, status: "error" }
              : { address: primaryAddress, slug: null, status: "error" }
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [primaryAddress]);

  useEffect(() => {
    if (!storageKey || !primaryAddress) {
      setTrackedSlugState(null);
      return;
    }

    if (accountEnsSlug) {
      setTrackedSlugState({ address: primaryAddress, slug: accountEnsSlug });
      localStorage.setItem(storageKey, accountEnsSlug);
      return;
    }

    const storedSlug = localStorage.getItem(storageKey);
    setTrackedSlugState({
      address: primaryAddress,
      slug: storedSlug || null,
    });
  }, [accountEnsSlug, primaryAddress, storageKey]);

  const { data: registrationData } = useENSRegistrationStatus(trackedSlug ?? undefined);

  useEffect(() => {
    if (!storageKey) return;

    if (trackedSlug && registrationData?.status !== "available") {
      localStorage.setItem(storageKey, trackedSlug);
      return;
    }

    if (!accountEnsSlug && registrationData?.status === "available") {
      localStorage.removeItem(storageKey);
    }
  }, [accountEnsSlug, registrationData?.status, storageKey, trackedSlug]);

  const hasExistingName =
    Boolean(accountEnsSlug) ||
    registrationData?.status === "pending" ||
    registrationData?.status === "active" ||
    registrationData?.status === "timed_out";
  const showENSSection =
    Boolean(primaryAddress) &&
    isProtocolMember &&
    accountEnsLookupStatus === "ready" &&
    !hasExistingName;

  const ensNotifiedRef = useRef(false);
  useEffect(() => {
    ensNotifiedRef.current = false;
  }, [trackedSlug]);

  useEffect(() => {
    if (trackedSlug && registrationData?.status === "active" && !ensNotifiedRef.current) {
      ensNotifiedRef.current = true;
      const sw = navigator.serviceWorker?.controller;
      if (sw) {
        sw.postMessage({
          type: "ENS_REGISTRATION_COMPLETE",
          slug: trackedSlug,
        });
      }
    }
  }, [trackedSlug, registrationData?.status]);

  const handleENSClaim = async () => {
    const result = slugForm.trigger("slug");
    if (!(await result)) return;
    const slug = slugForm.getValues("slug");
    try {
      await ensClaim.mutateAsync({ slug });
      if (primaryAddress) setTrackedSlugState({ address: primaryAddress, slug });
      if (storageKey) {
        localStorage.setItem(storageKey, slug);
      }
      slugForm.reset();
    } catch {
      // Error handling is in the mutation hook
    }
  };

  return (
    <>
      {showENSSection && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensName",
              defaultMessage: "ENS Name",
            })}
          </h5>
          <Card>
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-start gap-3">
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary">
                    <RiGlobalLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-1 grow">
                  <div className="text-sm font-medium">
                    {intl.formatMessage({
                      id: "app.profile.claimENSTitle",
                      defaultMessage: "Claim your greengoods.eth name",
                    })}
                  </div>
                  <div className="text-xs text-text-sub-600">
                    {intl.formatMessage({
                      id: "app.profile.claimENSDescription",
                      defaultMessage:
                        "Get a personal subdomain as a protocol member. Registration takes ~15-20 minutes via cross-chain messaging.",
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    {...slugForm.register("slug")}
                    aria-label={intl.formatMessage({
                      id: "app.profile.slugHint",
                      defaultMessage: "Choose your personal subdomain on greengoods.eth",
                    })}
                    placeholder={intl.formatMessage({
                      id: "app.profile.slugPlaceholder",
                      defaultMessage: "your-name",
                    })}
                    inputMode="text"
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 py-2.5 pr-10 font-mono text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {slugValue && slugValue.length >= 3 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingSlug ? (
                        <RiLoader4Line
                          className="h-4 w-4 animate-spin text-text-soft-400"
                          aria-label="Checking availability"
                        />
                      ) : isSlugAvailable ? (
                        <RiCheckLine
                          className="h-4 w-4 text-green-500"
                          aria-label="Name available"
                        />
                      ) : isSlugAvailable === false ? (
                        <RiAlertLine className="h-4 w-4 text-error-base" aria-label="Name taken" />
                      ) : null}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-sub-600">
                  {slugValue
                    ? `${slugValue}.greengoods.eth`
                    : intl.formatMessage({
                        id: "app.profile.slugHint",
                        defaultMessage: "Choose your personal subdomain on greengoods.eth",
                      })}
                </span>
                {slugForm.formState.errors.slug && (
                  <span className="text-xs text-error-base">
                    {slugForm.formState.errors.slug.message}
                  </span>
                )}
                {!isCheckingSlug && isSlugAvailable === false && slugValue && (
                  <span className="text-xs text-error-base">
                    {intl.formatMessage({
                      id: "app.profile.slugTaken",
                      defaultMessage: "This name is already taken",
                    })}
                  </span>
                )}
                <Button
                  variant="primary"
                  mode="filled"
                  size="xsmall"
                  onClick={handleENSClaim}
                  disabled={
                    !isOnline ||
                    ensClaim.isPending ||
                    !isSlugAvailable ||
                    isCheckingSlug ||
                    !slugValue
                  }
                  leadingIcon={
                    ensClaim.isPending ? (
                      <RiLoader4Line className="w-4 animate-spin" />
                    ) : (
                      <RiGlobalLine className="w-4" />
                    )
                  }
                  label={
                    !isOnline
                      ? intl.formatMessage({
                          id: "app.profile.claimOffline",
                          defaultMessage: "Go online to claim",
                        })
                      : ensClaim.isPending
                        ? intl.formatMessage({
                            id: "app.profile.claiming",
                            defaultMessage: "Claiming...",
                          })
                        : intl.formatMessage({
                            id: "app.profile.claimButton",
                            defaultMessage: "Claim name",
                          })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </Card>
        </>
      )}

      {trackedSlug && registrationData && registrationData.status !== "available" && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensRegistration",
              defaultMessage: "ENS Registration",
            })}
          </h5>
          <ENSProgressTimeline data={registrationData} slug={trackedSlug} />
        </>
      )}
    </>
  );
};
