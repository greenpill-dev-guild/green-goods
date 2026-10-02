import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { type MessageDescriptor, useIntl } from "react-intl";

/**
 * Command surface, solid material: one step at a time using the PWA's field-tool primitives. The page
 * is never indexed, never sends a referrer, and its title never carries the chat link.
 */
export function CeremonyFrame({
  channel,
  title,
  body,
  values,
  error,
  children,
  actions,
}: {
  channel: string | null;
  title: MessageDescriptor;
  body?: MessageDescriptor;
  values?: Record<string, string>;
  error?: { message: MessageDescriptor; caution: boolean } | null;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const intl = useIntl();
  return (
    <section
      className="@container mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6 px-4 py-6 font-sans sm:px-6 sm:py-10"
      aria-labelledby="ceremony-title"
    >
      <Helmet>
        <title>
          {intl.formatMessage({
            id: "public.reporting.documentTitle",
            defaultMessage: "Green Goods",
          })}
        </title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <header className="flex min-w-0 flex-col gap-3">
        {channel ? (
          <p className="text-sm font-medium text-text-sub-600">
            {intl.formatMessage(
              { id: "public.reporting.eyebrow", defaultMessage: "From your {channel} chat" },
              { channel }
            )}
          </p>
        ) : null}
        <h1
          id="ceremony-title"
          className="break-words text-[22px] font-semibold leading-7 text-text-strong-950"
        >
          {intl.formatMessage(title, values)}
        </h1>
        {body ? (
          <p className="max-w-prose text-sm leading-6 text-text-sub-600">
            {intl.formatMessage(body, values)}
          </p>
        ) : null}
      </header>
      {children}
      {error ? (
        <Alert variant={error.caution ? "warning" : "error"}>
          {intl.formatMessage(error.message)}
        </Alert>
      ) : null}
      {actions ? (
        <div className="flex min-w-0 flex-col gap-3 border-t border-stroke-soft-200 pt-4 pb-[env(safe-area-inset-bottom)] [&>.gg-button]:w-full sm:flex-row sm:flex-wrap sm:items-center sm:[&>.gg-button]:w-auto">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

/** Connect or prove an existing account; this page never creates one. */
export function AccountStep({
  account,
  connecting,
  proving,
  onConnectWallet,
  onConnectPasskey,
  onProve,
}: {
  account: string | null;
  connecting: boolean;
  proving: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
  onProve: () => void;
}) {
  const intl = useIntl();
  if (account) {
    return (
      <>
        <Button size="lg" loading={proving} onClick={onProve}>
          {intl.formatMessage({
            id: "public.reporting.connect.sign",
            defaultMessage: "Sign to continue",
          })}
        </Button>
        <p className="min-w-0 self-center break-words text-sm text-text-sub-600" title={account}>
          {intl.formatMessage(
            { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" },
            { account: formatAddress(account) }
          )}
        </p>
      </>
    );
  }
  return (
    <>
      <Button size="lg" loading={connecting} onClick={onConnectWallet}>
        {intl.formatMessage({
          id: "public.reporting.connect.wallet",
          defaultMessage: "Connect wallet",
        })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={connecting} onClick={onConnectPasskey}>
        {intl.formatMessage({
          id: "public.reporting.connect.passkey",
          defaultMessage: "Use my passkey",
        })}
      </Button>
    </>
  );
}
