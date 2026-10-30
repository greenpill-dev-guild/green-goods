import { logger } from "@green-goods/shared/modules/app/logger";
import { type ComponentType, lazy } from "react";
import { NotificationsIcon } from "./Notifications/Icon";
import type { NotificationsLauncherProps } from "./Notifications/Launcher";

/*
 * What Home loads after its first paint, each in a chunk of its own: the sheets with their first
 * opening, and the launchers once Home is idle (`DeferredLauncher`). A sheet whose code cannot
 * load reaches the screen's recovery state through the route's error frame; a launcher, an
 * ambient adjunct, degrades in place as it says below.
 */

export const CommitmentsSheet = lazy(() =>
  import("./CommitmentsSheet").then(({ CommitmentsSheet }) => ({ default: CommitmentsSheet }))
);
export const CommitmentsSheetLauncher = lazy(
  (): Promise<{ default: ComponentType<{ onClick: () => void }> }> =>
    import("./CommitmentsSheet/Launcher")
      .then(({ CommitmentsSheetLauncher }) => ({
        default: CommitmentsSheetLauncher,
      }))
      // Ambient adjunct: if the launcher chunk cannot load (offline dev serving),
      // hide it rather than failing the whole Home route.
      .catch(() => ({ default: () => null }))
);
export const NotificationsLauncher = lazy(
  (): Promise<{ default: ComponentType<NotificationsLauncherProps> }> =>
    import("./Notifications/Launcher")
      .then(({ NotificationsLauncher }) => ({ default: NotificationsLauncher }))
      // Ambient adjunct: without its chunk the bell keeps its place, disabled. A browser keeps a
      // failed dynamic import for the page's life, so a bell left enabled would do nothing on
      // every tap until a reload.
      .catch((error: unknown) => {
        logger.warn("The notifications bell's code could not load", {
          source: "Home",
          error,
        });
        return { default: () => <NotificationsIcon disabled /> };
      })
);
export const WalletSheet = lazy(() =>
  import("./WalletSheet").then(({ WalletSheet }) => ({ default: WalletSheet }))
);
// The switcher is a sheet like the others: its code, and the app's sheet frame with it, arrive
// with its first opening rather than with Home.
export const GardenSwitcherSheet = lazy(() =>
  import("./GardenSwitcher").then(({ GardenSwitcherSheet }) => ({ default: GardenSwitcherSheet }))
);
