import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ComponentPropsWithoutRef } from "react";
import { useIntl } from "react-intl";
import { EditorialGhostButton, EditorialPrimaryButton } from "./EditorialAtoms";

// Paradigm: Ambient Display. Material: warm vellum.
export type EditorialSkeletonProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "aria-hidden" | "children"
>;

/** Decorative placeholder that preserves editorial layout without announcing noise. */
export function EditorialSkeleton({ className, ...props }: EditorialSkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-editorial-skeleton=""
      className={cn("editorial-skeleton", className)}
    />
  );
}

export function EditorialMediaCardSkeleton({
  className,
  mediaClassName = "aspect-[3/2]",
}: {
  className?: string;
  mediaClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="media-card"
      className={cn("flex flex-col gap-4", className)}
    >
      <EditorialSkeleton className={cn("w-full", mediaClassName)} />
      <EditorialSkeleton className="h-5 w-3/4" />
      <EditorialSkeleton className="h-3 w-1/2" />
    </div>
  );
}

export function EditorialListRowSkeleton({ className }: { className?: string }) {
  const { formatMessage } = useIntl();
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="list-row"
      className={cn("flex h-full min-w-0 items-stretch gap-4 py-4 sm:gap-5", className)}
    >
      <div className="flex min-w-0 flex-1 basis-0 items-stretch gap-4 sm:gap-5">
        <EditorialSkeleton className="h-20 w-28 shrink-0 sm:h-24 sm:w-36" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <EditorialSkeleton className="-mb-0.5 h-[1lh] w-1/2 text-[11px]" />
          <EditorialSkeleton className="h-[2lh] w-3/4 text-lg leading-[1.15]" />
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
            {[
              formatMessage(
                { id: "public.gardens.gardeners", defaultMessage: "{count} gardeners" },
                { count: 0 }
              ),
              formatMessage(
                { id: "public.gardens.works", defaultMessage: "{count} entries" },
                { count: 0 }
              ),
            ].map((label, index) => (
              <span key={label} className="flex min-w-0 items-center gap-x-2">
                {index > 0 ? <span className="invisible">·</span> : null}
                <span className="editorial-skeleton [overflow-wrap:anywhere]">
                  <span className="invisible">{label}</span>
                </span>
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch justify-center gap-3">
        <EditorialPrimaryButton
          disabled
          size="sm"
          className="editorial-skeleton"
          data-skeleton-action="donate"
        >
          <span className="invisible">
            {formatMessage({ id: "public.fund.dialog.donate.title", defaultMessage: "Donate" })}
          </span>
        </EditorialPrimaryButton>
        <EditorialGhostButton
          disabled
          variant="warm"
          size="sm"
          className="editorial-skeleton"
          data-skeleton-action="endow"
        >
          <span className="invisible">
            {formatMessage({ id: "public.fund.dialog.endow.title", defaultMessage: "Endow" })}
          </span>
        </EditorialGhostButton>
      </div>
    </div>
  );
}

export function EditorialStatSkeleton({ className }: { className?: string }) {
  return <EditorialSkeleton className={cn("inline-block h-10 w-20", className)} />;
}

export const EDITORIAL_COOKIE_JAR_CARD_FRAME =
  "flex h-full flex-col gap-4 border-t border-stroke-soft-200 pt-5 text-left";

/** The campaign-list placeholder uses the same media, balance, and action slots as a jar. */
export function EditorialCookieJarCardSkeleton({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="cookie-jar"
      className={EDITORIAL_COOKIE_JAR_CARD_FRAME}
    >
      <div className="flex items-center justify-between gap-3">
        <EditorialSkeleton className="h-[19px] w-24 rounded-full" />
      </div>
      <EditorialSkeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-3">
        <EditorialSkeleton className="h-[1lh] w-3/4 text-xl leading-[1.15]" />
        <EditorialSkeleton className="h-[1lh] w-full text-sm leading-[1.55]" />
      </div>
      <div className="grid gap-1">
        <EditorialStatSkeleton className="h-[30px] w-24" />
        <EditorialSkeleton className="h-[19.5px] w-32" />
      </div>
      <EditorialSkeleton className="h-4 w-24" />
      <EditorialCookieJarActionsSkeleton isConnected={isConnected} />
    </div>
  );
}

export function EditorialCookieJarActionsSkeleton({ isConnected }: { isConnected: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="jar-actions"
      className="mt-auto grid gap-4 border-t border-stroke-soft-200 pt-4"
    >
      {isConnected ? (
        <>
          <div className="grid gap-3">
            <EditorialSkeleton className="h-4 w-20" />
            <div className="flex items-start gap-3 rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3">
              <EditorialSkeleton className="h-5 w-5 shrink-0" />
              <span className="editorial-skeleton flex-1 text-sm">
                <span className="invisible">
                  {formatMessage({
                    id: "public.cookies.ready",
                    defaultMessage: "You are on the list. Claim when you are ready.",
                  })}
                </span>
              </span>
            </div>
            <EditorialSkeleton data-skeleton-action="claim" className="h-11 w-full" />
          </div>
          <div className="grid gap-3 border-t border-stroke-soft-200 pt-4">
            <div>
              <span className="invisible text-sm font-medium">
                {formatMessage({
                  id: "public.cookies.depositAmount",
                  defaultMessage: "Deposit amount",
                })}
              </span>
              <EditorialSkeleton className="mt-2 h-11 w-full rounded-lg" />
              <div
                className="mt-3 text-sm"
                style={{ minBlockSize: "var(--form-feedback-block-size, 2lh)" }}
              />
            </div>
            <EditorialSkeleton className="h-4 w-36" />
            <EditorialSkeleton data-skeleton-action="deposit" className="h-11 w-full" />
          </div>
          <div className="min-h-0" />
        </>
      ) : (
        <div className="grid gap-3">
          <p className="editorial-skeleton text-sm leading-[1.5]">
            <span className="invisible">
              {formatMessage({
                id: "public.cookies.connectHint",
                defaultMessage: "Connect a wallet to check claim access and add funds.",
              })}
            </span>
          </p>
          <EditorialSkeleton data-skeleton-action="claim" className="h-11 w-full" />
          <EditorialSkeleton data-skeleton-action="deposit" className="h-11 w-full" />
        </div>
      )}
    </div>
  );
}

export function EditorialVaultAssetCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="vault-asset"
      className="border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-[var(--shadow-editorial-card)]"
    >
      <EditorialSkeleton className="h-[1lh] w-28 text-[11px]" />
      <div className="mt-5">
        <EditorialSkeleton className="h-[1lh] w-24 text-[11px]" />
        <EditorialSkeleton className="mt-2 h-[1lh] w-36 text-3xl leading-none md:text-4xl" />
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3, 4].map((metric) => (
          <div key={metric} className="border-t border-stroke-soft-200 pt-3">
            <dt>
              <EditorialSkeleton className="h-[1lh] w-3/4 text-[11px]" />
            </dt>
            <dd className="mt-1">
              <EditorialSkeleton className="h-[1lh] w-1/2 text-sm leading-[1.5]" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
