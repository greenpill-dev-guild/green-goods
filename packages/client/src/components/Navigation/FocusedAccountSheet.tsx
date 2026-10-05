import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { REPORTING_SUPPORT_CONTACT } from "@green-goods/shared/config/app";
import {
  RiArrowDropRightLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiUserLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
// Named files, not the Cards and Display barrels: this sheet loads with the website's frame on
// every public page, and the barrels bring the work cards, and through them sign-in, the work
// queue and the wallet kit. scripts/check-pwa-precache-budget.mjs fails a build where the frame
// reaches any of them.
import { Card, FlexCard } from "@/components/Cards/Card";
import { Faq, FaqContent, FaqItem, FaqTrigger } from "@/components/Display/Accordion/Faq";
import { Avatar } from "@/components/Display/Avatar/Avatar";

/** The questions someone has on a reporting page, in the order they tend to come up. */
const TOPICS = ["page", "public", "cost", "change", "permission", "chat"] as const;

/** A section's heading inside the sheet, as the app's Profile labels its sections. */
function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-label-md text-text-strong-950">{children}</h3>;
}

/**
 * One row of the account card, as the app's Profile draws its own: an avatar with the row's icon,
 * a title, and a line or two under it.
 */
export function AccountRow({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex w-full items-center gap-3">
        <Avatar>
          <div className="mx-auto flex items-center justify-center text-center text-primary [&>svg]:w-4">
            {icon}
          </div>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-sm font-medium">{title}</div>
          {children ? <div className="min-w-0 text-xs text-text-sub-600">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}

/** No one is signed in to the page yet: said until the account step has been taken. */
export function SignedOutRow() {
  const intl = useIntl();
  return (
    <AccountRow
      icon={<RiUserLine aria-hidden="true" />}
      title={intl.formatMessage({
        id: "public.reporting.account.none",
        defaultMessage: "Not signed in yet",
      })}
    >
      {intl.formatMessage({
        id: "public.reporting.account.noneBody",
        defaultMessage: "You'll show the account is yours on the Account step.",
      })}
    </AccountRow>
  );
}

/** Opens the owner permissions page beside the reporting page, never in its place. */
export function ManagePermissionsLink() {
  const intl = useIntl();
  return (
    <Button
      emphasis="secondary"
      className="w-full"
      leadingIcon={<RiExternalLinkLine className="h-5 w-5" aria-hidden="true" />}
      asChild
    >
      <a href="/agent/reporting/permissions" target="_blank" rel="noopener noreferrer">
        {intl.formatMessage({
          id: "public.reporting.grant.manage",
          defaultMessage: "Manage Permissions",
        })}
        <span className="sr-only">
          {intl.formatMessage({
            id: "public.reporting.opensInNewTab",
            defaultMessage: "(opens in a new tab)",
          })}
        </span>
      </a>
    </Button>
  );
}

/**
 * Account and Help for a reporting page, opened from the top bar's profile button. It is the app's
 * sheet below 640px and comes in from the right from there, under the top bar, as the cockpit shows
 * Profile. One scroll, as the app's Profile page stacks its sections: who is signed in to this page
 * and what they can do about it, how to reach a person, then the page's own questions as the app's
 * Help draws its dropdowns.
 *
 * The page fills the account section through `accountRef`. Until its code has loaded, the section
 * says no one is signed in yet.
 */
export function FocusedAccountSheet({
  open,
  onOpenChange,
  accountRef,
  pageSaysAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the element the page draws its account section into, while the sheet is open. */
  accountRef: (element: HTMLElement | null) => void;
  /** The page fills the account section; without one the sheet says no one is signed in. */
  pageSaysAccount: boolean;
}) {
  const intl = useIntl();
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      placement="right"
      // The app's tallest sheet: an account, its acts and six questions want the room.
      sheetSize="full"
      // From 640px, clear of the 5rem top bar, so the bar and its steps stay in view above the
      // sheet. Below that it is the bottom sheet, which this does not touch.
      className="sm:top-[5.5rem]"
      title={intl.formatMessage({
        id: "public.reporting.account.title",
        defaultMessage: "Account and Help",
      })}
    >
      <div className="flex flex-col gap-4">
        <SectionHeading>
          {intl.formatMessage({ id: "app.profile.account", defaultMessage: "Account" })}
        </SectionHeading>
        <div ref={accountRef} className="flex flex-col gap-3 empty:hidden" />
        {pageSaysAccount ? null : (
          <div className="flex flex-col gap-3">
            <SignedOutRow />
            <ManagePermissionsLink />
          </div>
        )}

        <SectionHeading>
          {intl.formatMessage({
            id: "public.reporting.help.contact",
            defaultMessage: "Get in touch",
          })}
        </SectionHeading>
        <a href={`https://${REPORTING_SUPPORT_CONTACT}`} target="_blank" rel="noreferrer">
          <FlexCard>
            <div className="flex grow flex-row items-center gap-3">
              <Avatar>
                <div className="mx-auto flex items-center justify-center text-center text-grey-200">
                  <RiGlobalLine aria-hidden="true" />
                </div>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-base">
                  {intl.formatMessage({
                    id: "public.reporting.help.site",
                    defaultMessage: "Visit Green Goods",
                  })}
                </div>
                <div className="text-xs text-text-sub-600 [overflow-wrap:anywhere]">
                  {REPORTING_SUPPORT_CONTACT}
                </div>
              </div>
              <div className="flex text-right">
                <RiArrowDropRightLine aria-hidden="true" />
              </div>
            </div>
          </FlexCard>
        </a>

        <SectionHeading>
          {intl.formatMessage({ id: "public.reporting.help.label", defaultMessage: "Help" })}
        </SectionHeading>
        <Faq>
          {TOPICS.map((topic) => (
            <FaqItem key={topic} value={topic}>
              <FaqTrigger>
                {intl.formatMessage({ id: `public.reporting.help.faq.${topic}.question` })}
              </FaqTrigger>
              <FaqContent>
                {intl.formatMessage({ id: `public.reporting.help.faq.${topic}.answer` })}
              </FaqContent>
            </FaqItem>
          ))}
        </Faq>
      </div>
    </DialogShell>
  );
}
