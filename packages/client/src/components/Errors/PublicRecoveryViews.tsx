import type { ReactNode } from "react";
import { CeremonyPageError } from "./CeremonyPageError";
import { type RecoveryViews, RecoveryViewsContext } from "./ErrorRecovery";
import { PublicPageError } from "./PublicPageError";
import { PublicSiteError } from "./PublicSiteError";

const PUBLIC_RECOVERY_VIEWS: RecoveryViews = {
  frame: PublicSiteError,
  page: PublicPageError,
  ceremony: CeremonyPageError,
};

/**
 * The website's recovery screens. It sits outside every boundary in the public entry, so the
 * outermost one can still read it, and it holds nothing that can fail.
 */
export function PublicRecoveryViews({ children }: { children: ReactNode }) {
  return (
    <RecoveryViewsContext.Provider value={PUBLIC_RECOVERY_VIEWS}>
      {children}
    </RecoveryViewsContext.Provider>
  );
}
