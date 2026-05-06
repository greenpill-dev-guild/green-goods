import { cn } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { EditorialLinkArrow } from "./EditorialAtoms";

export interface ReadDeeperLink {
  labelId: string;
  defaultLabel: string;
  href: string;
  /** When true, opens the link in a new tab and bypasses the SPA router. Defaults
   * to true since the docs site is a separate Docusaurus build. */
  external?: boolean;
}

export interface EditorialReadDeeperProps {
  /** Optional override of the kicker label. Defaults to a localized "Read deeper". */
  kickerId?: string;
  defaultKicker?: string;
  /** Community-flavored deep-link — written for visitors, not implementers. */
  community: ReadDeeperLink;
  /** Optional builder-flavored deep-link — points at architecture / contract docs. */
  builder?: ReadDeeperLink;
  /** Visual tone. `default` is for linen and warm surfaces; `dark` inverts the
   * link color for the editorial-deep walnut footer surfaces. */
  tone?: "default" | "dark";
  className?: string;
}

/**
 * "Read deeper" — quiet pathway from an editorial section into the docs site.
 *
 * Sits at the end of an editorial block (Pipeline, Funding Bridge, Evidence
 * dialog, etc.) as a hairline-bordered footer with one or two arrow links.
 * Always sparse: never more than one of these per section, never above the
 * fold, never more than two links per occurrence.
 *
 * Pair the `community` link (plain-language guide) with an optional `builder`
 * link (architecture / contracts / why-on-chain). Skipping `builder` is the
 * right move when the section's audience is purely a visitor or funder, not
 * a developer.
 */
export function EditorialReadDeeper({
  kickerId = "public.readDeeper.kicker",
  defaultKicker = "Read deeper",
  community,
  builder,
  tone = "default",
  className,
}: EditorialReadDeeperProps) {
  const { formatMessage } = useIntl();
  const borderClasses = tone === "dark" ? "border-editorial-deep-fg/20" : "border-stroke-soft-200";
  const kickerClasses = tone === "dark" ? "text-editorial-deep-fg/60" : "text-text-soft-400";

  return (
    <div className={cn("mt-12 border-t pt-6", borderClasses, className)}>
      <p
        className={cn(
          "font-mono text-[11px] font-medium uppercase tracking-[0.18em]",
          kickerClasses
        )}
      >
        {formatMessage({ id: kickerId, defaultMessage: defaultKicker })}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <EditorialLinkArrow to={community.href} external={community.external ?? true} tone={tone}>
          {formatMessage({ id: community.labelId, defaultMessage: community.defaultLabel })}
        </EditorialLinkArrow>
        {builder ? (
          <EditorialLinkArrow to={builder.href} external={builder.external ?? true} tone={tone}>
            {formatMessage({ id: builder.labelId, defaultMessage: builder.defaultLabel })}
          </EditorialLinkArrow>
        ) : null}
      </div>
    </div>
  );
}
