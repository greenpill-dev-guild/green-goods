import * as React from "react";
import { DOMAIN_TOKEN_SLUG, Domain } from "../../types/domain";
import { DOMAIN_CONFIG } from "../../config/domain";
import { cn } from "../../utils/styles/cn";

const VARIANT_ANGLES = [120, 135, 150] as const;

function buildDomainGradient(domain: Domain | null, variantIndex: number): string {
  const resolvedDomain = domain ?? Domain.AGRO;
  const slug = DOMAIN_TOKEN_SLUG[resolvedDomain];
  const angle = VARIANT_ANGLES[variantIndex % VARIANT_ANGLES.length];
  return `linear-gradient(${angle}deg, rgb(var(--domain-${slug}-rgb)) 0%, rgb(var(--domain-${slug}-soft-rgb)) 100%)`;
}

/**
 * Subtle dot-grid pattern overlay for texture depth.
 * Shared with GardenBannerFallback for visual consistency.
 */
const DOT_PATTERN = "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)";
const DOT_SIZE = "16px 16px";

/** Simple string hash (djb2) for deterministic gradient variation */
function hashName(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export interface ActionBannerFallbackProps {
  /** Action domain — determines the base color palette */
  domain: Domain | null;
  /** Action title — used for deterministic gradient variation within the domain */
  title: string;
  /** Additional class names for the root container */
  className?: string;
}

/**
 * Domain-colored gradient fallback for action card images.
 *
 * Renders a Warm Earth gradient in the domain's color family
 * (solar=golden amber, agro=deep moss, edu=harbour blue, waste=terracotta)
 * with a subtle dot-grid texture and centered domain icon. The gradient
 * angle varies (120° / 135° / 150°) by `hashName(title)` for visual
 * distinction within the same domain.
 *
 * Usage:
 * ```tsx
 * <ImageWithFallback
 *   src={action.media[0]}
 *   backgroundFallback={<ActionBannerFallback domain={action.domain} title={action.title} />}
 * />
 * ```
 */
export const ActionBannerFallback: React.FC<ActionBannerFallbackProps> = React.memo(
  ({ domain, title, className }) => {
    const variantIndex = hashName(title || "Action") % VARIANT_ANGLES.length;
    const gradient = buildDomainGradient(domain, variantIndex);
    const Icon = DOMAIN_CONFIG[domain ?? Domain.AGRO].icon;

    return (
      <div className={cn("absolute inset-0", className)}>
        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: gradient }} />
        {/* Dot-grid texture overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: DOT_PATTERN,
            backgroundSize: DOT_SIZE,
          }}
        />
        {/* Domain icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-10 h-10 text-white/30" />
        </div>
      </div>
    );
  }
);

ActionBannerFallback.displayName = "ActionBannerFallback";
