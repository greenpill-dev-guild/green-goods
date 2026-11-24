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

const loadCommitmentsSheet = () => import("./CommitmentsSheet");
export const CommitmentsSheet = lazy(() =>
  loadCommitmentsSheet().then(({ CommitmentsSheet }) => ({ default: CommitmentsSheet }))
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
const loadWalletSheet = () => import("./WalletSheet");
export const WalletSheet = lazy(() =>
  loadWalletSheet().then(({ WalletSheet }) => ({ default: WalletSheet }))
);

/*
 * A sheet's code, fetched ahead of its first opening. Its launcher waits for it, disabled and
 * busy, so a tap never asks for a sheet that has nothing to show yet, as Your Work's launcher
 * does (DL-132). A fetch that fails frees the launcher instead of holding it: its tap then opens
 * the sheet through the lazy import above, which reports the failure through the route's error
 * frame and its reload, as every sheet here does.
 */
export const preloadCommitmentsSheet = loadCommitmentsSheet;
export const preloadWalletSheet = loadWalletSheet;
// The switcher is a sheet like the others: its code, and the app's sheet frame with it, arrive
// with its first opening rather than with Home.
export const GardenSwitcherSheet = lazy(() =>
  import("./GardenSwitcher").then(({ GardenSwitcherSheet }) => ({ default: GardenSwitcherSheet }))
);
