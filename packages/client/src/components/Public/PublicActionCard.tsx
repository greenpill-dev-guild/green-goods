import { getDomainStyle } from "@green-goods/shared/config/domain";
import type { Action } from "@green-goods/shared/types/domain";
import { localizeAction } from "@green-goods/shared/utils/action/translations";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display/Image/ImageWithFallback";

export interface PublicActionCardProps {
  action: Action;
  onOpen: (action: Action) => void;
}

/**
 * PublicActionCard — read-only Action template card for the public library.
 * Opens a source-anchored dialog (no create/edit controls).
 *
 * Editorial dialect: no border, no shadow, hairline-only chrome. Domain tag
 * carries the Action's domain ink (umber / moss / violet / harbour) so the
 * grid reads as a field index rather than a generic card wall.
 *
 * The title and description read in the visitor's language when the template
 * stores a reviewed translation for it, and in English otherwise. `onOpen`
 * hands back the template as given, not the translated copy.
 */
export function PublicActionCard({ action, onOpen }: PublicActionCardProps) {
  const { formatMessage, locale } = useIntl();
  const { title, description } = localizeAction(action, locale);
  const domain = getDomainStyle(action.domain);
  const domainLabel = formatMessage({
    id: domain?.labelId ?? "app.domain.tab.unknown",
    defaultMessage: domain?.defaultLabel ?? String(action.domain),
  });

  return (
    <button
      type="button"
      data-pressable="card"
      onClick={(event) => {
        // Safari leaves a pressed button unfocused, and the dialog returns focus to the opener
        // that holds it.
        event.currentTarget.focus({ preventScroll: true });
        onOpen(action);
      }}
      className="group flex h-full cursor-pointer flex-col gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-editorial-warm">
        <ImageWithFallback
          src={action.media[0] ?? "/images/no-image-placeholder.png"}
          alt={title}
          className="h-full w-full object-cover"
        />
      </div>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
          domain ? cn(domain.colors.bg, domain.colors.text) : "bg-bg-weak-50 text-text-sub-600"
        )}
      >
        {domainLabel}
      </span>
      <h3
        className="font-serif text-xl font-normal leading-[1.18] tracking-[-0.01em] text-text-strong-950 group-hover:text-primary-action"
        title={title}
      >
        <span className="line-clamp-2">{title}</span>
      </h3>
      {description ? (
        <p className="line-clamp-3 text-sm leading-[1.55] text-text-sub-600" title={description}>
          {description}
        </p>
      ) : null}
    </button>
  );
}
