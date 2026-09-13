import { Alert } from "@green-goods/shared/components/Alert";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { ENSProgressTimeline } from "@green-goods/shared/components/Progress/ENSProgressTimeline";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useENSClaim } from "@green-goods/shared/hooks/ens/useENSClaim";
import { useENSRegistrationStatus } from "@green-goods/shared/hooks/ens/useENSRegistrationStatus";
import { useENSReleaseName } from "@green-goods/shared/hooks/ens/useENSReleaseName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "@green-goods/shared/hooks/ens/useProtocolMemberStatus";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import { useSlugForm } from "@green-goods/shared/hooks/ens/useSlugForm";
import type { Address } from "@green-goods/shared/types/domain";
import {
  RiAlertLine,
  RiCheckLine,
  RiCloseCircleLine,
  RiGlobalLine,
  RiHeadphoneLine,
  RiLoader4Line,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { ENSUsernameChangeRequest } from "./ENSUsernameChangeRequest";

interface ENSSectionProps {
  primaryAddress: Address | undefined;
}

export const ENSSection: React.FC<ENSSectionProps> = ({ primaryAddress }) => {
  const intl = useIntl();
  const { isOnline } = useOffline();
  const { data: isProtocolMember = false, isLoading: isMembershipLoading } =
    useProtocolMemberStatus(primaryAddress as `0x${string}` | undefined);
  const slugForm = useSlugForm();
  const slugValue = slugForm.watch("slug");
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useSlugAvailability(
    slugValue || undefined
  );
  const ensClaim = useENSClaim();
  const ensRelease = useENSReleaseName();
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const [releasingSlug, setReleasingSlug] = useState<string | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const { data: existingGreenGoodsEnsName } = useGreenGoodsEnsName(primaryAddress);
  const existingSlug = existingGreenGoodsEnsName?.endsWith(".greengoods.eth")
    ? existingGreenGoodsEnsName.replace(/\.greengoods\.eth$/, "")
    : null;
  const activeSlug = claimedSlug ?? releasingSlug ?? existingSlug;
  const { data: registrationData } = useENSRegistrationStatus(activeSlug ?? undefined);

  const hasExistingName =
    Boolean(existingGreenGoodsEnsName) ||
    Boolean(releasingSlug) ||
    registrationData?.status === "pending" ||
    registrationData?.status === "active";
  // The claim renders for every signed-in gardener without a name; non-members see it
  // marked unavailable. Wait for membership to resolve so members never flash that state.
  const showENSSection = primaryAddress && !isMembershipLoading && !hasExistingName;
  const showExistingENSSection = primaryAddress && isProtocolMember && existingSlug && !claimedSlug;
  const isReleaseUnavailable = ensRelease.isSponsoredReleaseUnavailable;

  const ensNotifiedRef = useRef(false);
  useEffect(() => {
    if (claimedSlug && registrationData?.status === "active" && !ensNotifiedRef.current) {
      ensNotifiedRef.current = true;
      const sw = navigator.serviceWorker?.controller;
      if (sw) {
        sw.postMessage({
          type: "ENS_REGISTRATION_COMPLETE",
          slug: claimedSlug,
        });
      }
    }
  }, [claimedSlug, registrationData?.status]);

  const handleENSClaim = async () => {
    const result = slugForm.trigger("slug");
    if (!(await result)) return;
    const slug = slugForm.getValues("slug");
    try {
      await ensClaim.mutateAsync({ slug });
      setClaimedSlug(slug);
      slugForm.reset();
    } catch {
      // Error handling is in the mutation hook
    }
  };

  const handleENSRelease = () => {
    if (isReleaseUnavailable) {
      setShowChangeRequest((current) => !current);
      return;
    }
    setIsReleaseConfirmOpen(true);
  };

  const confirmENSRelease = async () => {
    try {
      const release = await ensRelease.mutateAsync();
      setReleasingSlug(release.slug);
      // Reset the SW-notification one-shot so a reclaim later in the same
      // session can refire ENS_REGISTRATION_COMPLETE. Without this, the next
      // claim's "ready" status wouldn't push to the service worker.
      ensNotifiedRef.current = false;
    } catch {
      // Error handling is in the mutation hook
    } finally {
      setIsReleaseConfirmOpen(false);
    }
  };

  return (
    <>
      {showExistingENSSection && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.currentENSName",
              defaultMessage: "Username",
            })}
          </h5>
          <Card>
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary">
                    <RiGlobalLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div
                    className="truncate font-mono text-sm font-medium text-text-strong-950"
                    title={existingSlug}
                  >
                    {existingSlug}
                  </div>
                  <div className="text-xs text-text-sub-600">
                    {intl.formatMessage(
                      {
                        id: "app.profile.currentENSDescription",
                        defaultMessage: "People can find you as {name}.greengoods.eth.",
                      },
                      { name: existingSlug }
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="neutral"
                mode="stroke"
                size="small"
                onClick={handleENSRelease}
                disabled={!isOnline || ensRelease.isPending || releasingSlug === existingSlug}
                aria-busy={ensRelease.isPending || undefined}
                leadingIcon={
                  ensRelease.isPending ? (
                    <RiLoader4Line className="w-4 animate-spin" aria-hidden />
                  ) : isReleaseUnavailable ? (
                    <RiHeadphoneLine className="w-4" />
                  ) : (
                    <RiCloseCircleLine className="w-4" />
                  )
                }
                label={
                  !isOnline
                    ? intl.formatMessage({
                        id: "app.profile.releaseOffline",
                        defaultMessage: "Go Online to Release",
                      })
                    : isReleaseUnavailable
                      ? intl.formatMessage({
                          id: "app.profile.ensChangeRequestButton",
                          defaultMessage: "Request Username Change",
                        })
                      : releasingSlug === existingSlug
                        ? intl.formatMessage({
                            id: "app.profile.releaseStarted",
                            defaultMessage: "Release started",
                          })
                        : intl.formatMessage({
                            id: "app.profile.releaseENSButton",
                            defaultMessage: "Release Username",
                          })
                }
                className="w-full"
              />
              {isReleaseUnavailable && (
                <ENSUsernameChangeRequest
                  primaryAddress={primaryAddress}
                  existingSlug={existingSlug}
                  isOpen={showChangeRequest}
                />
              )}
            </div>
          </Card>
        </>
      )}

      {showENSSection && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensName",
              defaultMessage: "Claim your name",
            })}
          </h5>
          <Card>
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                <Avatar>
                  <div className="flex items-center justify-center text-center mx-auto text-primary">
                    <RiGlobalLine className="w-4" />
                  </div>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {intl.formatMessage({
                      id: "app.profile.claimENSTitle",
                      defaultMessage: "Claim your Green Goods name",
                    })}
                  </div>
                  <div className="text-xs text-text-sub-600">
                    {intl.formatMessage({
                      id: "app.profile.claimENSDescription",
                      defaultMessage:
                        "Choose a personal name tied to your work. Registration takes about 15-20 minutes.",
                    })}
                  </div>
                </div>
              </div>
              {isProtocolMember ? (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      {...slugForm.register("slug")}
                      aria-label={intl.formatMessage({
                        id: "app.profile.slugHint",
                        defaultMessage: "Choose your personal Green Goods name",
                      })}
                      placeholder={intl.formatMessage({
                        id: "app.profile.slugPlaceholder",
                        defaultMessage: "your-name",
                      })}
                      inputMode="text"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      className="gg-control pr-10 font-mono"
                      data-size="sm"
                    />
                    {slugValue && slugValue.length >= 3 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingSlug ? (
                          <RiLoader4Line
                            className="h-4 w-4 animate-spin text-text-soft-400"
                            aria-label={intl.formatMessage({
                              id: "app.profile.slugChecking",
                              defaultMessage: "Checking availability",
                            })}
                          />
                        ) : isSlugAvailable ? (
                          <RiCheckLine
                            className={`h-4 w-4 ${pwaStatusStyles.success.icon}`}
                            aria-label={intl.formatMessage({
                              id: "app.profile.slugAvailable",
                              defaultMessage: "Name available",
                            })}
                          />
                        ) : isSlugAvailable === false ? (
                          <RiAlertLine
                            className="h-4 w-4 text-error-base"
                            aria-label={intl.formatMessage({
                              id: "app.profile.slugTakenLabel",
                              defaultMessage: "Name taken",
                            })}
                          />
                        ) : null}
                      </span>
                    )}
                  </div>
                  <div className="min-h-[48px]">
                    <span className="text-xs text-text-sub-600">
                      {slugValue
                        ? `${slugValue}.greengoods.eth`
                        : intl.formatMessage({
                            id: "app.profile.slugHint",
                            defaultMessage: "Choose your personal Green Goods name",
                          })}
                    </span>
                    {slugForm.formState.errors.slug && (
                      <p className="text-xs text-error-base mt-0.5">
                        {slugForm.formState.errors.slug.message}
                      </p>
                    )}
                    {!isCheckingSlug && isSlugAvailable === false && slugValue && (
                      <p className="text-xs text-error-base mt-0.5">
                        {intl.formatMessage({
                          id: "app.profile.slugTaken",
                          defaultMessage: "This name is already taken",
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    mode="filled"
                    size="small"
                    onClick={handleENSClaim}
                    disabled={
                      !isOnline ||
                      ensClaim.isPending ||
                      !isSlugAvailable ||
                      isCheckingSlug ||
                      !slugValue
                    }
                    aria-busy={ensClaim.isPending || undefined}
                    leadingIcon={
                      ensClaim.isPending ? (
                        <RiLoader4Line className="w-4 animate-spin" aria-hidden />
                      ) : (
                        <RiGlobalLine className="w-4" />
                      )
                    }
                    label={
                      !isOnline
                        ? intl.formatMessage({
                            id: "app.profile.claimOffline",
                            defaultMessage: "Go Online to Claim",
                          })
                        : intl.formatMessage({
                            id: "app.profile.claimButton",
                            defaultMessage: "Claim Name",
                          })
                    }
                    className="w-full"
                  />
                </div>
              ) : (
                <Alert
                  variant="info"
                  className="p-3"
                  title={intl.formatMessage({
                    id: "app.profile.claimENSUnavailable",
                    defaultMessage: "Not available yet",
                  })}
                >
                  {intl.formatMessage({
                    id: "app.profile.claimENSJoinHint",
                    defaultMessage: "Join a garden to unlock your Green Goods name.",
                  })}
                </Alert>
              )}
            </div>
          </Card>
        </>
      )}

      {activeSlug && registrationData && registrationData.status !== "available" && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensRegistration",
              defaultMessage: "Registration progress",
            })}
          </h5>
          <ENSProgressTimeline data={registrationData} slug={activeSlug} />
        </>
      )}

      <ConfirmDialog
        isOpen={isReleaseConfirmOpen}
        onClose={() => setIsReleaseConfirmOpen(false)}
        onConfirm={confirmENSRelease}
        title={intl.formatMessage({
          id: "app.profile.releaseENSConfirmTitle",
          defaultMessage: "Release this username?",
        })}
        description={intl.formatMessage({
          id: "app.profile.releaseENSConfirmDescription",
          defaultMessage:
            "Your name will stop working in a few minutes, and there's a waiting period before someone else can claim it.",
        })}
        variant="warning"
        confirmLabel={intl.formatMessage({
          id: "app.profile.releaseENSButton",
          defaultMessage: "Release Username",
        })}
        isLoading={ensRelease.isPending}
      />
    </>
  );
};
