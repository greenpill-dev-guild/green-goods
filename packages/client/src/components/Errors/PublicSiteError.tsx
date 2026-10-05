import { Button } from "@green-goods/shared/components/Button";
import { EditorialHeading, EditorialLede } from "@/components/Public/atoms";
import { recoveryCopy, recoveryLanguage } from "./recoveryCopy";

export interface PublicSiteErrorProps {
  /** The site's code could not be fetched without a connection; it reloads on reconnect. */
  offline?: boolean;
  /** The site is reloading itself onto a new build: the ground alone, with nothing to read. */
  updating?: boolean;
  /** Required unless `updating`, which has nothing to press. */
  onReload?: () => void;
}

/**
 * The website when its own frame failed: no header, navigation or footer can be trusted.
 *
 * It reads no provider and no router, so it still renders when one of them is what failed. Its
 * words come from `recoveryCopy` for the same reason. The card sits where the boot shell's
 * recovery card sits (`#boot-website-recovery` in index.html), on the same ground.
 */
export function PublicSiteError({
  offline = false,
  updating = false,
  onReload,
}: PublicSiteErrorProps) {
  const language = recoveryLanguage();
  const copy = recoveryCopy(language);

  return (
    // data-site gives the shared button the website corner (DL-026) outside PublicShell. The
    // document's language is the provider's to set; this screen declares its own.
    <div
      data-site="website"
      lang={language}
      className="relative min-h-screen min-h-[100svh] overflow-hidden bg-editorial-deep"
    >
      {updating ? null : (
        <div className="absolute inset-x-0 bottom-14 px-6 sm:bottom-24 sm:px-10 lg:bottom-[12svh]">
          <div className="mx-auto max-w-7xl">
            <div
              role="alert"
              className="max-w-[31rem] bg-bg-weak-50 p-6 shadow-[var(--shadow-editorial-panel)] sm:p-8 lg:max-w-[33.5rem] lg:p-10"
            >
              <EditorialHeading as="h1" size="display">
                {offline ? copy.siteOfflineTitle : copy.siteTitle}
              </EditorialHeading>
              <div className="mt-4 max-w-prose">
                <EditorialLede>{offline ? copy.siteOfflineBody : copy.siteBody}</EditorialLede>
              </div>
              <div className="mt-6">
                <Button type="button" onClick={onReload}>
                  {copy.reload}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
