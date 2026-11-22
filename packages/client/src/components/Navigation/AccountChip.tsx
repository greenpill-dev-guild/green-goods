import { IconButton } from "@green-goods/shared/components/IconButton";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useOptionalAuthContext } from "@green-goods/shared/providers/Auth";
import { chosenPasskeyUsername, formatAddress } from "@green-goods/shared/utils/app/text";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiLogoutBoxRLine, RiUserLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { signOutToLogin } from "./signOutToLogin";

/**
 * Who is signed in, at the end of the top bar on every screen that can send something: the
 * account's button with its name under it, the way a flow's steps hang their names. A shared
 * phone keeps the last gardener signed in, so the name is there before the work is logged, and
 * the button opens the way out without a trip to Profile.
 *
 * `besideTracker` keeps the name clear of a flow's step markers, which share the bar: four 48px
 * columns in the middle leave it the width between the last marker and the page margin.
 */
export function AccountChip({ besideTracker = false }: { besideTracker?: boolean }) {
  const auth = useOptionalAuthContext();
  if (!auth?.isAuthenticated) return null;
  return (
    <SignedInAccount
      authMode={auth.authMode}
      userName={auth.userName}
      signOut={auth.signOut}
      besideTracker={besideTracker}
    />
  );
}

function SignedInAccount({
  authMode,
  userName,
  signOut,
  besideTracker,
}: {
  authMode: Parameters<typeof chosenPasskeyUsername>[0];
  userName: string | null;
  signOut: () => Promise<void>;
  besideTracker: boolean;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const primaryAddress = usePrimaryAddress();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name =
    chosenPasskeyUsername(authMode, userName) ??
    (primaryAddress ? formatAddress(primaryAddress, { variant: "card" }) : null);
  if (!name) return null;

  const leave = async () => {
    setSigningOut(true);
    const left = await signOutToLogin({ signOut, navigate, intl });
    setSigningOut(false);
    if (left) setSheetOpen(false);
  };

  return (
    <div data-component="AccountChip" className="flex flex-col items-end">
      <IconButton
        emphasis="secondary"
        size="compact"
        onClick={() => setSheetOpen(true)}
        aria-label={intl.formatMessage({ id: "app.account.chip.label" }, { name })}
        title={intl.formatMessage({ id: "app.account.chip.label" }, { name })}
        aria-haspopup="dialog"
        icon={<RiUserLine className={pwaStatusStyles.primary.icon} aria-hidden="true" />}
      />
      {/* The button's label already says the name, so a screen reader hears it once. */}
      <span
        aria-hidden="true"
        title={name}
        className={cn(
          "truncate text-right text-[11px] font-medium leading-[12px] text-text-sub-600",
          besideTracker ? "max-w-[calc((100vw-12rem)/2-1.75rem)] sm:max-w-36" : "max-w-36"
        )}
      >
        {name}
      </span>
      <AppSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        size="compact"
        preventClose={signingOut}
        header={{ title: intl.formatMessage({ id: "app.account.switch.title" }, { name }) }}
        actions={{
          primary: {
            label: intl.formatMessage({ id: "app.account.signOut" }),
            icon: <RiLogoutBoxRLine className="h-4 w-4" aria-hidden="true" />,
            onClick: leave,
            loading: signingOut,
            testId: "account-sign-out",
          },
          secondary: {
            label: intl.formatMessage({ id: "app.account.switch.stay" }),
            onClick: () => setSheetOpen(false),
            disabled: signingOut,
          },
        }}
      >
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({ id: "app.account.switch.body" })}
        </p>
      </AppSheet>
    </div>
  );
}
