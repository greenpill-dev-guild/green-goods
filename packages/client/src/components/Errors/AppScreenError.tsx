import { Button } from "@green-goods/shared/components/Button";
import { RiErrorWarningLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication/EmptyState";

export interface AppScreenErrorProps {
  /** The screen's code could not be fetched without a connection; it returns on its own. */
  offline?: boolean;
  onReload: () => void;
  /** Set on screens that hide the bottom bar, so the screen still has a way out. */
  onBack?: () => void;
  /**
   * The frame the screen failed in: the installed app's shell, or the focused bar the reporting
   * ceremony pages use.
   */
  shell?: "app" | "focused";
}

const SHELL_FRAME = {
  // The scroller reserves the bottom bar's 69px; centring in what is left keeps the state clear
  // of the bar on every screen height.
  app: "grid min-h-[calc(100dvh-69px-env(safe-area-inset-bottom))] place-items-center",
  // Under the top bar, where a reporting page shows its own "this link can't be used" state.
  focused: "pt-8 pb-6",
};

/**
 * One screen of the installed app that failed, in the anatomy every failed list and sheet tab
 * already uses (DL-056): the mark, a title, one line saying nothing was lost, and the way on.
 * The acts are the screen's own, so they take the sign-in screen's width and stack as it stacks
 * them: the filled primary, then the outlined second act.
 *
 * It renders inside `AppShell`, so the bottom bar stays where the route shows it, or inside the
 * reporting pages' focused shell, which are drawn as the app draws.
 */
export function AppScreenError({
  offline = false,
  onReload,
  onBack,
  shell = "app",
}: AppScreenErrorProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={SHELL_FRAME[shell]}>
      <div className="flex w-full flex-col items-center px-4">
        <EmptyState
          titleAs="h1"
          // The acts sit below at the screen's width, so the state keeps only its own height.
          className="min-h-0 px-2 py-0"
          // Offline is a wait, not a fault, so it keeps the calm mark (DESIGN.pwa.md § Offline).
          tone={offline ? "neutral" : "error"}
          icon={offline ? <RiWifiOffLine /> : <RiErrorWarningLine />}
          title={
            offline
              ? formatMessage({
                  id: "app.screenError.offline.title",
                  defaultMessage: "You're offline",
                })
              : formatMessage({
                  id: "app.screenError.title",
                  defaultMessage: "This screen didn't load",
                })
          }
          description={
            offline
              ? formatMessage({
                  id: "app.screenError.offline.description",
                  defaultMessage: "Nothing was lost. This screen loads when you are back online.",
                })
              : formatMessage({
                  id: "app.screenError.description",
                  defaultMessage: "Nothing was lost. Reload to carry on.",
                })
          }
        />
        <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
          <Button type="button" className="w-full" onClick={onReload}>
            {formatMessage({ id: "app.screenError.reload", defaultMessage: "Reload" })}
          </Button>
          {onBack ? (
            <Button type="button" emphasis="secondary" className="w-full" onClick={onBack}>
              {formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
