import {
  ENSProgressTimeline,
  useENSClaim,
  useENSRegistrationStatus,
  useOffline,
  useProtocolMemberStatus,
  useSlugAvailability,
  useSlugForm,
  type Address,
} from "@green-goods/shared";
import { RiAlertLine, RiCheckLine, RiGlobalLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";

interface ENSSectionProps {
  primaryAddress: Address | undefined;
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
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const { data: registrationData } = useENSRegistrationStatus(claimedSlug ?? undefined);

  const hasExistingName =
    registrationData?.status === "pending" || registrationData?.status === "active";
  const showENSSection = primaryAddress && isProtocolMember && !hasExistingName;

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

      {claimedSlug && registrationData && registrationData.status !== "available" && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensRegistration",
              defaultMessage: "ENS Registration",
            })}
          </h5>
          <ENSProgressTimeline data={registrationData} slug={claimedSlug} />
        </>
      )}
    </>
  );
};
