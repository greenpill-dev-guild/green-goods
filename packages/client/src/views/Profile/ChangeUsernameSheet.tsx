import { useENSReleaseFee } from "@green-goods/shared/hooks/ens/useENSReleaseName";
import { useSlugAvailability } from "@green-goods/shared/hooks/ens/useSlugAvailability";
import { useSlugForm } from "@green-goods/shared/hooks/ens/useSlugForm";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { formatEther } from "viem";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { UsernameField } from "./UsernameField";
import { nameOf } from "./usernameCardWords";

export interface ChangeUsernameSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The name the account holds now. */
  currentSlug: string;
  isOnline: boolean;
  /** The release is with the wallet or on its way. */
  isReleasing: boolean;
  /** Step 1: release the current name, keeping `to` for step 2. Throws when it doesn't land. */
  onChange: (to: string) => Promise<void>;
}

const strong = (chunks: ReactNode[]) => (
  <strong className="font-medium text-text-strong-950">{chunks}</strong>
);

/**
 * Change Username for a wallet account (PRD-1026 p9, D6): the new name typed
 * once, then what happens and when: the release now, with its fee read as the
 * sheet opens (D4), and the claim once the old name clears, two signatures in
 * all. It says plainly that the new name isn't held meanwhile. The tall sheet
 * in every state (D9); one action, and Close cancels. A release that doesn't
 * land keeps the sheet open with the name typed.
 */
export function ChangeUsernameSheet({
  isOpen,
  onClose,
  currentSlug,
  isOnline,
  isReleasing,
  onChange,
}: ChangeUsernameSheetProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const form = useSlugForm("");
  const typed = form.watch("slug");
  const availability = useSlugAvailability(isOpen && typed ? typed : undefined);
  const fee = useENSReleaseFee(currentSlug, isOpen);
  // Never guess a fee: without a fresh read, nothing is released.
  const feeKnown = fee.isSuccess;
  const feeEth =
    typeof fee.data === "string"
      ? Number(formatEther(BigInt(fee.data))).toLocaleString(intl.locale, {
          maximumSignificantDigits: 3,
        })
      : null;
  const canChange =
    isOnline &&
    feeKnown &&
    !isReleasing &&
    typed.length > 0 &&
    typed !== currentSlug &&
    !form.formState.errors.slug &&
    availability.data === true;

  // Close cancels: the next opening starts from an empty name.
  const close = () => {
    form.reset({ slug: "" });
    onClose();
  };
  const submit = async () => {
    if (!(await form.trigger("slug"))) return;
    try {
      await onChange(form.getValues("slug"));
      close();
    } catch {
      // The release hook says why; the sheet keeps the name for another try.
    }
  };

  const stepOne = fee.isError
    ? formatMessage(
        {
          id: "app.profile.username.stepReleaseUnread",
          defaultMessage:
            "<b>Now</b>, your wallet releases {name}. The fee couldn’t be read, so nothing can be released yet. Close this and try again.",
        },
        { name: nameOf(currentSlug), b: strong }
      )
    : !feeKnown
      ? formatMessage(
          {
            id: "app.profile.username.stepReleaseReading",
            defaultMessage: "<b>Now</b>, your wallet releases {name}. Reading the fee…",
          },
          { name: nameOf(currentSlug), b: strong }
        )
      : feeEth
        ? formatMessage(
            {
              id: "app.profile.username.stepReleaseFee",
              defaultMessage: "<b>Now</b>, your wallet releases {name} for a {fee} ETH fee.",
            },
            { name: nameOf(currentSlug), fee: feeEth, b: strong }
          )
        : formatMessage(
            {
              id: "app.profile.username.stepRelease",
              defaultMessage: "<b>Now</b>, your wallet releases {name}.",
            },
            { name: nameOf(currentSlug), b: strong }
          );
  const stepTwo = formatMessage(
    {
      id: "app.profile.username.stepClaim",
      defaultMessage: "<b>In about 15–20 minutes</b>, your wallet claims {name}.",
    },
    {
      name: typed
        ? nameOf(typed)
        : formatMessage({
            id: "app.profile.username.theNewName",
            defaultMessage: "the new name",
          }),
      b: strong,
    }
  );

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={close}
      size="tall"
      header={{
        title: formatMessage({
          id: "app.profile.username.change",
          defaultMessage: "Change Username",
        }),
        description: formatMessage(
          { id: "app.profile.username.current", defaultMessage: "Your username is {name}." },
          { name: nameOf(currentSlug) }
        ),
      }}
      actions={{
        primary: {
          label: isOnline
            ? formatMessage({
                id: "app.profile.username.change",
                defaultMessage: "Change Username",
              })
            : formatMessage({
                id: "app.profile.username.goOnlineToChange",
                defaultMessage: "Go Online to Change",
              }),
          onClick: () => void submit(),
          loading: isReleasing,
          disabled: !canChange,
          testId: "change-username-submit",
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <UsernameField
          id="new-username"
          label={formatMessage({
            id: "app.profile.username.newLabel",
            defaultMessage: "New username",
          })}
          form={form}
          typed={typed}
          availability={{ available: availability.data, checking: availability.isFetching }}
          disabled={isReleasing}
        />
        <ol className="flex flex-col gap-3" data-testid="change-username-steps">
          {[stepOne, stepTwo].map((step, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-text-sub-600">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stroke-soft-200 text-xs text-text-sub-600"
              >
                {index + 1}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{step}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
          {formatMessage(
            {
              id: "app.profile.username.gapNote",
              defaultMessage:
                "The new name isn’t held while you wait, and {current} stays locked for everyone, you included, for 30 days.",
            },
            { current: currentSlug }
          )}
        </p>
      </div>
    </AppSheet>
  );
}
