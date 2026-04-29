import {
  type Address,
  ConfirmDialog,
  ENSProgressTimeline,
  validateSlug,
  useENSClaim,
  useENSReleaseName,
  useGreenGoodsEnsName,
  useENSRegistrationStatus,
  useOffline,
  useProtocolMemberStatus,
  useSlugAvailability,
  useSlugForm,
} from "@green-goods/shared";
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
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface ENSSectionProps {
  primaryAddress: Address | undefined;
}

type ENSUsernameChangeReason = "same-passkey" | "lost-passkey" | "other";

const ENS_SUPPORT_URL = "https://t.me/+N3o3_43iRec1Y2Jh";
const ENS_USERNAME_CHANGE_REQUESTS_KEY = "green-goods:ens-username-change-requests";

function normalizeRequestedSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\.greengoods\.eth$/, "");
}

function createUsernameChangeRequestId(owner: Address) {
  return `ens-change-${Date.now()}-${owner.slice(2, 8).toLowerCase()}`;
}

function saveUsernameChangeRequest(request: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    let parsed: unknown = [];
    const existing = window.localStorage.getItem(ENS_USERNAME_CHANGE_REQUESTS_KEY);
    parsed = existing ? (JSON.parse(existing) as unknown) : [];
    const requests = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(
      ENS_USERNAME_CHANGE_REQUESTS_KEY,
      JSON.stringify([request, ...requests].slice(0, 10))
    );
  } catch {
    // Local storage is best-effort; the prepared support packet still renders.
  }
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
  const ensRelease = useENSReleaseName();
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const [releasingSlug, setReleasingSlug] = useState<string | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [requestedSlug, setRequestedSlug] = useState("");
  const [requestReason, setRequestReason] = useState<ENSUsernameChangeReason>("same-passkey");
  const [requestContact, setRequestContact] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [preparedRequest, setPreparedRequest] = useState<{
    id: string;
    copied: boolean;
    message: string;
  } | null>(null);
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
  const showENSSection = primaryAddress && isProtocolMember && !hasExistingName;
  const showExistingENSSection = primaryAddress && isProtocolMember && existingSlug && !claimedSlug;
  const isReleaseUnavailable = ensRelease.isSponsoredReleaseUnavailable;
  const requestReasonOptions: Array<{ value: ENSUsernameChangeReason; label: string }> = [
    {
      value: "same-passkey",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonSamePasskey",
        defaultMessage: "I still use this passkey",
      }),
    },
    {
      value: "lost-passkey",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonLostPasskey",
        defaultMessage: "I lost the old passkey",
      }),
    },
    {
      value: "other",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonOther",
        defaultMessage: "Something else",
      }),
    },
  ];

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
      setRequestError(null);
      return;
    }
    setIsReleaseConfirmOpen(true);
  };

  const confirmENSRelease = async () => {
    try {
      const release = await ensRelease.mutateAsync();
      setReleasingSlug(release.slug);
    } catch {
      // Error handling is in the mutation hook
    } finally {
      setIsReleaseConfirmOpen(false);
    }
  };

  const handlePrepareUsernameChangeRequest = async () => {
    if (!primaryAddress || !existingSlug) return;

    const desiredSlug = normalizeRequestedSlug(requestedSlug);
    const slugValidation = validateSlug(desiredSlug);
    if (!slugValidation.valid) {
      setRequestError(
        intl.formatMessage(
          {
            id: "app.profile.ensChangeDesiredSlugError",
            defaultMessage: "Enter a valid desired username: {error}",
          },
          { error: slugValidation.error ?? "invalid username" }
        )
      );
      return;
    }
    if (requestContact.trim().length < 3) {
      setRequestError(
        intl.formatMessage({
          id: "app.profile.ensChangeContactError",
          defaultMessage: "Add a Telegram handle, email, or another contact path.",
        })
      );
      return;
    }

    const requestId = createUsernameChangeRequestId(primaryAddress);
    const reasonLabel =
      requestReasonOptions.find((option) => option.value === requestReason)?.label ?? requestReason;
    const message = [
      "ENS username change request",
      `Request ID: ${requestId}`,
      `Current username: ${existingSlug}.greengoods.eth`,
      `Desired username: ${desiredSlug}.greengoods.eth`,
      `Current account: ${primaryAddress}`,
      `Reason: ${reasonLabel}`,
      `Contact: ${requestContact.trim()}`,
      requestNotes.trim() ? `Notes: ${requestNotes.trim()}` : null,
      "",
      "Operator path:",
      requestReason === "same-passkey"
        ? "Fund this smart account on Arbitrum, have the user sign releaseName(), wait for CCIP, then have them claim the desired username."
        : "Review exact-name recovery. If the user lost the passkey, L1 recovery may be possible but current L2 sender state can block normal self-service reuse.",
    ]
      .filter(Boolean)
      .join("\n");

    saveUsernameChangeRequest({
      id: requestId,
      currentSlug: existingSlug,
      desiredSlug,
      owner: primaryAddress,
      reason: requestReason,
      contact: requestContact.trim(),
      notes: requestNotes.trim(),
      createdAt: new Date().toISOString(),
      message,
    });

    let copied = false;
    try {
      await navigator.clipboard?.writeText(message);
      copied = Boolean(navigator.clipboard);
    } catch {
      copied = false;
    }

    setPreparedRequest({ id: requestId, copied, message });
    setRequestError(null);
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
                  <div className="font-mono text-sm font-medium text-text-strong-950">
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
                leadingIcon={
                  ensRelease.isPending ? (
                    <RiLoader4Line className="w-4 animate-spin" />
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
                        defaultMessage: "Go online to release",
                      })
                    : isReleaseUnavailable
                      ? intl.formatMessage({
                          id: "app.profile.ensChangeRequestButton",
                          defaultMessage: "Request username change",
                        })
                      : ensRelease.isPending
                        ? intl.formatMessage({
                            id: "app.profile.releasingENS",
                            defaultMessage: "Releasing...",
                          })
                        : releasingSlug === existingSlug
                          ? intl.formatMessage({
                              id: "app.profile.releaseStarted",
                              defaultMessage: "Release started",
                            })
                          : intl.formatMessage({
                              id: "app.profile.releaseENSButton",
                              defaultMessage: "Release username",
                            })
                }
                className="w-full"
              />
              {isReleaseUnavailable && (
                <div className="flex flex-col gap-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-3">
                  <p className="text-xs text-text-sub-600">
                    {intl.formatMessage({
                      id: "app.profile.ensChangeSupportDescription",
                      defaultMessage:
                        "Username changes are support-assisted on this ENS sender. If you still have this passkey, an operator can fund the release transaction. If you lost it, support can review recovery.",
                    })}
                  </p>
                  {showChangeRequest && (
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1 text-xs text-text-sub-600">
                        {intl.formatMessage({
                          id: "app.profile.ensChangeDesiredSlug",
                          defaultMessage: "Desired username",
                        })}
                        <input
                          value={requestedSlug}
                          onChange={(event) => setRequestedSlug(event.target.value)}
                          placeholder={intl.formatMessage({
                            id: "app.profile.ensChangeDesiredSlugPlaceholder",
                            defaultMessage: "new-name",
                          })}
                          inputMode="text"
                          autoCapitalize="none"
                          autoComplete="off"
                          spellCheck={false}
                          className="h-9 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 font-mono text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-sub-600">
                        {intl.formatMessage({
                          id: "app.profile.ensChangeReason",
                          defaultMessage: "What happened?",
                        })}
                        <select
                          value={requestReason}
                          onChange={(event) =>
                            setRequestReason(event.target.value as ENSUsernameChangeReason)
                          }
                          className="h-9 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {requestReasonOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-sub-600">
                        {intl.formatMessage({
                          id: "app.profile.ensChangeContact",
                          defaultMessage: "Contact",
                        })}
                        <input
                          value={requestContact}
                          onChange={(event) => setRequestContact(event.target.value)}
                          placeholder={intl.formatMessage({
                            id: "app.profile.ensChangeContactPlaceholder",
                            defaultMessage: "@telegram, email, or phone",
                          })}
                          className="h-9 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-sub-600">
                        {intl.formatMessage({
                          id: "app.profile.ensChangeNotes",
                          defaultMessage: "Notes",
                        })}
                        <textarea
                          value={requestNotes}
                          onChange={(event) => setRequestNotes(event.target.value)}
                          placeholder={intl.formatMessage({
                            id: "app.profile.ensChangeNotesPlaceholder",
                            defaultMessage: "Anything support should know",
                          })}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      {requestError && <p className="text-xs text-error-base">{requestError}</p>}
                      {preparedRequest && (
                        <div className="flex flex-col gap-2 rounded-lg border border-success-light bg-success-lighter/40 p-2 text-xs text-text-sub-600">
                          <p>
                            {intl.formatMessage(
                              {
                                id: "app.profile.ensChangeRequestPrepared",
                                defaultMessage:
                                  "Request {id} is ready. {copied, select, true {Details were copied.} other {Copy the details below.}} Send it to support so an operator can help.",
                              },
                              { id: preparedRequest.id, copied: String(preparedRequest.copied) }
                            )}
                          </p>
                          <label className="sr-only" htmlFor="ens-change-request-details">
                            {intl.formatMessage({
                              id: "app.profile.ensChangeRequestDetails",
                              defaultMessage: "Request details",
                            })}
                          </label>
                          <textarea
                            id="ens-change-request-details"
                            readOnly
                            value={preparedRequest.message}
                            rows={6}
                            className="w-full resize-none rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-2 py-1 font-mono text-[11px] text-text-sub-600"
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="primary"
                          mode="filled"
                          size="small"
                          onClick={handlePrepareUsernameChangeRequest}
                          label={intl.formatMessage({
                            id: "app.profile.ensChangePrepareRequest",
                            defaultMessage: "Prepare request",
                          })}
                          className="w-full"
                        />
                        <a
                          href={ENS_SUPPORT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-center text-sm font-medium text-primary"
                        >
                          {intl.formatMessage({
                            id: "app.profile.ensChangeOpenSupport",
                            defaultMessage: "Open Telegram support",
                          })}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
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
              defaultMessage: "Claim ENS name and subdomain",
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
                      defaultMessage: "Claim ENS name and subdomain",
                    })}
                  </div>
                  <div className="text-xs text-text-sub-600">
                    {intl.formatMessage({
                      id: "app.profile.claimENSDescription",
                      defaultMessage:
                        "Choose a greengoods.eth name tied to your Green Goods identity and garden work. Registration takes about 15-20 minutes.",
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
                    className="h-9 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-3 pr-10 font-mono text-sm text-text-strong-950 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                          className={`h-4 w-4 ${pwaStatusStyles.success.icon}`}
                          aria-label="Name available"
                        />
                      ) : isSlugAvailable === false ? (
                        <RiAlertLine className="h-4 w-4 text-error-base" aria-label="Name taken" />
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
                          defaultMessage: "Choose your personal subdomain on greengoods.eth",
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
                            defaultMessage: "Claim subdomain",
                          })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </Card>
        </>
      )}

      {activeSlug && registrationData && registrationData.status !== "available" && (
        <>
          <h5 className="text-label-md text-text-strong-950">
            {intl.formatMessage({
              id: "app.profile.ensRegistration",
              defaultMessage: "ENS Registration",
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
            "It will stop resolving after cross-chain delivery completes, and the name will enter the cooldown period.",
        })}
        variant="warning"
        confirmLabel={intl.formatMessage({
          id: "app.profile.releaseENSButton",
          defaultMessage: "Release username",
        })}
        isLoading={ensRelease.isPending}
      />
    </>
  );
};
