import { type Action, cn } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
import type { EditorialDomain } from "./atoms";

export interface PublicActionCardProps {
  action: Action;
  onOpen: (action: Action) => void;
}

const DOMAIN_INK_CLASSES: Record<EditorialDomain, string> = {
  all: "bg-bg-weak-50 text-text-sub-600",
  solar: "bg-domain-solar-soft text-domain-solar",
  agro: "bg-domain-agro-soft text-domain-agro",
  education: "bg-domain-education-soft text-domain-education",
  waste: "bg-domain-waste-soft text-domain-waste",
};

/**
 * PublicActionCard — read-only Action template card for the public library.
 * Opens a source-anchored dialog (no create/edit controls).
 *
 * Editorial dialect: no border, no shadow, hairline-only chrome. Domain tag
 * carries the Action's domain ink (umber / moss / violet / harbour) so the
 * grid reads as a field index rather than a generic card wall.
 */
export function PublicActionCard({ action, onOpen }: PublicActionCardProps) {
  const { formatMessage } = useIntl();
  const slug = domainSlug(action.domain);
  const domainKey: EditorialDomain = (slug ?? "all") as EditorialDomain;
  const domainLabel = formatMessage({
    id: `app.domain.tab.${slug ?? "unknown"}`,
    defaultMessage: slug ?? String(action.domain),
  });

  return (
    <button
      type="button"
      onClick={() => onOpen(action)}
      className="group flex h-full flex-col gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-editorial-warm">
        <ImageWithFallback
          src={action.media[0] ?? "/images/no-image-placeholder.png"}
          alt={action.title}
          className="h-full w-full object-cover transition-transform duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] group-hover:scale-[1.03]"
        />
      </div>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
          DOMAIN_INK_CLASSES[domainKey]
        )}
      >
        {domainLabel}
      </span>
      <h3
        className="font-serif text-xl font-normal leading-[1.18] tracking-[-0.01em] text-text-strong-950 group-hover:text-primary-action"
        title={action.title}
      >
        <span className="line-clamp-2">{action.title}</span>
      </h3>
      {action.description ? (
        <p
          className="line-clamp-3 text-sm leading-[1.55] text-text-sub-600"
          title={action.description}
        >
          {action.description}
        </p>
      ) : null}
    </button>
  );
}

function domainSlug(domain: number | string): EditorialDomain | null {
  if (typeof domain === "string") {
    const lower = domain.toLowerCase();
    if (["solar", "agro", "education", "waste"].includes(lower)) {
      return lower as EditorialDomain;
    }
    return null;
  }
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
      return null;
  }
}
