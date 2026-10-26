// Command Surface: the row that stands in for a Home section's list (DL-127, DL-056).
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiErrorWarningLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

export interface JournalStateRowProps {
  /** `error` is announced and tries again; `offline` is a wait, with the calm mark. */
  kind: "empty" | "error" | "offline";
  /** The empty state's own mark; a failure and a wait take theirs. */
  icon?: ReactNode;
  title: string;
  /** One short line: what to do, or that nothing was lost. */
  detail?: string;
  onRetry?: () => void;
  /** An empty state's one way on, in the row's right slot, such as See All on a narrowed list. */
  action?: ReactNode;
}

/**
 * The one row that stands for a Home section's list while it is empty, offline with nothing
 * saved, or could not be read: a content item row in the list's own frame, so the section
 * keeps its place (DL-056). A failed read says nothing was lost and takes Try Again in the
 * row's right slot; an empty state may take its one way on there.
 */
export function JournalStateRow({
  kind,
  icon,
  title,
  detail,
  onRetry,
  action,
}: JournalStateRowProps) {
  const { formatMessage } = useIntl();
  const tryAgain = formatMessage({ id: "app.common.tryAgain" });
  const line =
    kind === "error"
      ? formatMessage({ id: "app.home.journal.nothingLost" })
      : kind === "offline"
        ? formatMessage({ id: "app.home.journal.offlineDetail" })
        : detail;
  return (
    <li>
      <ItemRow
        role={kind === "error" ? "alert" : undefined}
        data-state={kind}
        lead={{
          kind: "icon",
          icon:
            kind === "error" ? (
              <RiErrorWarningLine className="text-error-base" />
            ) : kind === "offline" ? (
              <RiWifiOffLine />
            ) : (
              icon
            ),
        }}
        title={title}
        details={line ? [line] : undefined}
        action={
          kind === "error" && onRetry ? (
            <IconButton
              emphasis="tertiary"
              size="compact"
              onClick={onRetry}
              aria-label={tryAgain}
              title={tryAgain}
              icon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
            />
          ) : kind === "empty" ? (
            action
          ) : undefined
        }
      />
    </li>
  );
}

/**
 * A section's placeholder rows while it reads, in the loaded row's own frame so nothing moves
 * when the list arrives (DL-056), heard once as what is gathering.
 */
export function JournalLoadingRows({
  label,
  count,
  placeholder,
}: {
  label: string;
  count: number;
  placeholder: ReactNode;
}) {
  return (
    <>
      <li role="status" className="sr-only">
        {label}
      </li>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
          {placeholder}
        </li>
      ))}
    </>
  );
}
