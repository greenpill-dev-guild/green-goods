import { useIntl } from "react-intl";
import { EditorialGhostLink, EditorialPrimaryButton } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

export interface PublicPageErrorProps {
  /** The page's code could not be fetched without a connection; it returns on its own. */
  offline?: boolean;
  onReload: () => void;
}

/**
 * A public page that failed, drawn as an ordinary editorial page inside the site's own frame.
 *
 * It renders below `PublicShell`, so the header stays and the reader can leave by the navigation
 * they already know. Everything here is static: a failed page must not depend on the reads that
 * may have failed it.
 */
export function PublicPageError({ offline = false, onReload }: PublicPageErrorProps) {
  const { formatMessage } = useIntl();

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-page-error-title"
        title={
          offline
            ? formatMessage({
                id: "public.pageError.offline.title",
                defaultMessage: "You're offline",
              })
            : formatMessage({
                id: "public.pageError.title",
                defaultMessage: "This page could not be loaded",
              })
        }
        lede={
          offline
            ? formatMessage({
                id: "public.pageError.offline.lede",
                defaultMessage: "This page will load as soon as you are back online.",
              })
            : formatMessage({
                id: "public.pageError.lede",
                defaultMessage: "We could not show this page right now. Reload to try again.",
              })
        }
        actions={
          <>
            <EditorialPrimaryButton onClick={onReload}>
              {formatMessage({ id: "public.pageError.reload", defaultMessage: "Reload" })}
            </EditorialPrimaryButton>
            <EditorialGhostLink to="/gardens">
              {formatMessage({
                id: "public.gardenDetail.backToGardens",
                defaultMessage: "Browse Gardens",
              })}
            </EditorialGhostLink>
          </>
        }
      />
      {/* The banner's card spills past the image; this band is the ground it lands on. */}
      <div
        aria-hidden="true"
        className="min-h-40 flex-1 bg-bg-soft-200 dark:bg-bg-surface-800 sm:min-h-48"
      />
      <PublicFooter variant="soil" />
    </>
  );
}
