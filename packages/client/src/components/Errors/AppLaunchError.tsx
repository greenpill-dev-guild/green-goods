import { Button } from "@green-goods/shared/components/Button";
import { SplashScaffold } from "@/components/Layout/SplashScaffold";
import { recoveryCopy, recoveryLanguage } from "./recoveryCopy";

export interface AppLaunchErrorProps {
  /** The app's code could not be fetched without a connection; it reloads on reconnect. */
  offline?: boolean;
  /** The app is reloading itself onto a new build: the loading screen, saying so. */
  updating?: boolean;
  /** Required unless `updating`, which has nothing to press. */
  onReload?: () => void;
}

/**
 * The installed app when it could not start, or when its shell failed and the bottom bar cannot
 * be trusted. It is drawn on the scaffold sign-in and the loading screen share, so the logo and
 * the line under it stay where they were and Reload sits where sign-in's first button sits.
 *
 * It reads no provider and no router, so it still renders when one of them is what failed. Its
 * words come from `recoveryCopy` for the same reason.
 */
export function AppLaunchError({
  offline = false,
  updating = false,
  onReload,
}: AppLaunchErrorProps) {
  const language = recoveryLanguage();
  const copy = recoveryCopy(language);

  if (updating) {
    return (
      <div role="status" lang={language}>
        <SplashScaffold pulse title={copy.launchUpdating} titleVoice="status" />
      </div>
    );
  }

  return (
    // The document's language is the provider's to set; this screen declares its own.
    <div role="alert" lang={language}>
      <SplashScaffold
        title={offline ? copy.launchOfflineTitle : copy.launchTitle}
        titleVoice="status"
        slotOne={
          <Button type="button" className="w-full" onClick={onReload}>
            {copy.reload}
          </Button>
        }
        slotTwo={
          <p className="w-full self-start pt-1 text-center text-sm leading-5 text-text-sub-600">
            {offline ? copy.launchOfflineNote : copy.launchNote}
          </p>
        }
      />
    </div>
  );
}
