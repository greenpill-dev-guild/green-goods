import type { Action } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";

export interface PublicActionCardProps {
  action: Action;
  onOpen: (action: Action) => void;
}

/**
 * PublicActionCard — read-only Action template card for the public library.
 * Opens a source-anchored dialog (no create/edit controls).
 */
export function PublicActionCard({ action, onOpen }: PublicActionCardProps) {
  const { formatMessage } = useIntl();
  const domainLabel = formatMessage({
    id: `app.domain.tab.${domainSlug(action.domain)}`,
    defaultMessage: domainSlug(action.domain),
  });

  return (
    <button
      type="button"
      onClick={() => onOpen(action)}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-stroke-soft-200 bg-bg-white-0 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
    >
      <div className="aspect-[4/3] w-full">
        <ImageWithFallback
          src={action.media[0] ?? "/images/no-image-placeholder.png"}
          alt={action.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className="inline-flex w-fit items-center rounded-full bg-bg-weak-50 px-2.5 py-0.5 text-xs font-medium text-text-soft-400">
          {domainLabel}
        </span>
        <h3 className="font-serif text-lg text-text-strong-950" title={action.title}>
          <span className="line-clamp-2">{action.title}</span>
        </h3>
        {action.description ? (
          <p className="line-clamp-3 text-sm text-text-sub-600" title={action.description}>
            {action.description}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function domainSlug(domain: number | string): string {
  if (typeof domain === "string") return domain;
  switch (domain) {
    case 0:
      return "solar";
    case 1:
      return "agro";
    case 2:
      return "education";
    case 3:
      return "waste";
    default:
      return "unknown";
  }
}
