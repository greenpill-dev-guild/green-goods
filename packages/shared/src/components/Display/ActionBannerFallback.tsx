import { RiBookOpenLine, RiPlantLine, RiRecycleLine, RiSunLine } from "@remixicon/react";
import * as React from "react";
import { Domain } from "../../types/domain";
import { cn } from "../../utils/styles/cn";

/**
 * Domain-keyed gradient palettes.
 * Each domain has 3 variations so cards within the same domain
 * still look visually distinct (selected by title hash).
 */
const DOMAIN_GRADIENTS: Record<Domain, readonly string[]> = {
  [Domain.SOLAR]: [
    "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)", // Sunrise
    "linear-gradient(135deg, #92400e 0%, #fbbf24 100%)", // Golden Hour
    "linear-gradient(135deg, #451a03 0%, #d97706 100%)", // Desert Sun
  ],
  [Domain.AGRO]: [
    "linear-gradient(135deg, #14532d 0%, #22c55e 100%)", // Growth
    "linear-gradient(135deg, #052e16 0%, #16a34a 100%)", // Canopy
    "linear-gradient(135deg, #365314 0%, #84cc16 100%)", // Orchard
  ],
  [Domain.EDU]: [
    "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%)", // Knowledge
    "linear-gradient(135deg, #1e1b4b 0%, #6366f1 100%)", // Cosmos
    "linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%)", // Stream
  ],
  [Domain.WASTE]: [
    "linear-gradient(135deg, #7c2d12 0%, #f97316 100%)", // Reclaim
    "linear-gradient(135deg, #9a3412 0%, #fb923c 100%)", // Terracotta
    "linear-gradient(135deg, #431407 0%, #ea580c 100%)", // Ember
  ],
};

/** Domain icon mapping — matches actions.json domainConfig */
const DOMAIN_ICONS: Record<Domain, React.ComponentType<{ className?: string }>> = {
  [Domain.SOLAR]: RiSunLine,
  [Domain.AGRO]: RiPlantLine,
  [Domain.EDU]: RiBookOpenLine,
  [Domain.WASTE]: RiRecycleLine,
};

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
  domain: Domain;
  /** Action title — used for deterministic gradient variation within the domain */
  title: string;
  /** Additional class names for the root container */
  className?: string;
}

/**
 * Domain-colored gradient fallback for action card images.
 *
 * Renders a gradient in the domain's color family (solar=amber, agro=green,
 * edu=blue, waste=orange) with a subtle dot-grid texture and centered domain icon.
 * The specific gradient variation is selected by hashing the action title.
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
    const gradients = DOMAIN_GRADIENTS[domain] ?? DOMAIN_GRADIENTS[Domain.AGRO];
    const gradient = gradients[hashName(title || "Action") % gradients.length];
    const Icon = DOMAIN_ICONS[domain] ?? DOMAIN_ICONS[Domain.AGRO];

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
