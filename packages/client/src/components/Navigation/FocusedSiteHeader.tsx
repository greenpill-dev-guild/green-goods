import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { APP_NAME, REPORTING_SUPPORT_CONTACT } from "@green-goods/shared/config/app";
import { useState } from "react";
import { useIntl } from "react-intl";

/**
 * Header for reporting ceremony pages: the mark on a solid canvas and one Help control. There is
 * no navigation or install action, so nothing competes with the one step the person came to
 * finish. Help explains the page without leaving it; the permissions link opens separately and
 * works without a chat link or an Agent session.
 */
export function FocusedSiteHeader() {
  const intl = useIntl();
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <header className="border-b border-stroke-soft-200 bg-bg-white-0" data-variant="focused">
      <div className="px-6 sm:px-10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3">
          {/* At large text on a small phone the mark gives way, so Help stays inside the page. */}
          <img
            src="/icon.png"
            alt={APP_NAME}
            className="h-8 w-auto min-w-0 shrink object-contain object-left"
          />
          <Button emphasis="tertiary" size="lg" onClick={() => setHelpOpen(true)}>
            {intl.formatMessage({ id: "public.reporting.help.label", defaultMessage: "Help" })}
          </Button>
        </div>
      </div>
      <DialogShell
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title={intl.formatMessage({
          id: "public.reporting.help.title",
          defaultMessage: "Help with this page",
        })}
      >
        <div className="flex flex-col gap-3 text-sm leading-[1.55] text-text-sub-600">
          <p>
            {intl.formatMessage({
              id: "public.reporting.help.what",
              defaultMessage:
                "This page finishes a step you started in chat. It shows exactly what will be published and asks you to sign it with your own wallet or passkey. Nothing is signed until you choose to.",
            })}
          </p>
          <p>
            {intl.formatMessage({
              id: "public.reporting.help.public",
              defaultMessage:
                "What you publish is public and permanent: the details shown on this page and your account address, on Arbitrum and IPFS. Your chat messages and files you didn't include stay private.",
            })}
          </p>
          <p>
            {intl.formatMessage({
              id: "public.reporting.help.chat",
              defaultMessage: "You can go back to your chat at any time and close this page.",
            })}
          </p>
          <a
            className="font-medium text-text-strong-950 underline"
            href="/agent/reporting/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            {intl.formatMessage({
              id: "public.reporting.help.permissions",
              defaultMessage: "Reporting permissions",
            })}
          </a>
          <p>
            {intl.formatMessage(
              {
                id: "public.reporting.help.support",
                defaultMessage: "Need a person? Email {email}.",
              },
              {
                email: (
                  <a
                    className="font-medium text-text-strong-950 underline"
                    href={`mailto:${REPORTING_SUPPORT_CONTACT}`}
                  >
                    {REPORTING_SUPPORT_CONTACT}
                  </a>
                ),
              }
            )}
          </p>
        </div>
      </DialogShell>
    </header>
  );
}
