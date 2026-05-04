import { cn } from "@green-goods/shared";

/**
 * GardenCoverFallback — themed cover used when a Garden has no `bannerImage`
 * or the image fails to load.
 *
 * Picks a domain-flavored warm-earth gradient deterministically from the
 * Garden slug, plus the Garden's initial(s) typeset in Fraunces. Every Garden
 * gets a recognizable, distinct fallback rather than the icon-in-middle
 * placeholder. Replaces `/images/no-image-placeholder.png` for the public
 * Garden card surfaces while bannerImage uploads stabilize.
 */

interface Palette {
  /** Stronger warm-earth ink for the gradient stop and the initial. */
  ink: string;
  /** Soft surface stop for the gradient base. */
  soft: string;
  /** Foreground color for the initial (defaults to walnut for legibility on light grounds). */
  fg: string;
}

// Palettes drawn from the editorial domain ink + soft surface tokens
// (see packages/client/src/styles/editorial.css). Walnut foreground reads
// well across all four soft surfaces.
const PALETTES: readonly Palette[] = [
  {
    // solar — warm umber → pale amber
    ink: "var(--color-domain-solar)",
    soft: "var(--color-domain-solar-soft)",
    fg: "var(--color-editorial-deep)",
  },
  {
    // agro — deep moss → pale sage
    ink: "var(--color-domain-agro)",
    soft: "var(--color-domain-agro-soft)",
    fg: "var(--color-editorial-deep)",
  },
  {
    // education — slate violet → pale violet
    ink: "var(--color-domain-education)",
    soft: "var(--color-domain-education-soft)",
    fg: "var(--color-editorial-deep)",
  },
  {
    // waste — harbour blue → pale harbour
    ink: "var(--color-domain-waste)",
    soft: "var(--color-domain-waste-soft)",
    fg: "var(--color-editorial-deep)",
  },
  {
    // editorial — walnut → linen
    ink: "var(--color-editorial-deep)",
    soft: "var(--color-editorial-warm)",
    fg: "var(--color-editorial-deep)",
  },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function deriveInitial(name: string, slug: string): string {
  const source = (name || slug || "").trim();
  if (!source) return "G";
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return source.charAt(0).toUpperCase();
  if (words.length === 1) {
    const first = words[0]!;
    return first.length >= 2 ? first.slice(0, 2).toUpperCase() : first.charAt(0).toUpperCase();
  }
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export interface GardenCoverFallbackProps {
  /** Garden display name; first 1–2 letters become the initial. */
  name: string;
  /** Garden slug; used as the deterministic seed when name is empty. */
  slug: string;
  className?: string;
}

export function GardenCoverFallback({ name, slug, className }: GardenCoverFallbackProps) {
  const seed = hashString(slug || name || "garden");
  const palette = PALETTES[seed % PALETTES.length]!;
  const angle = 145 + (seed % 4) * 15; // 145 / 160 / 175 / 190deg
  const initial = deriveInitial(name, slug);

  return (
    <div
      aria-hidden="true"
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, ${palette.ink} 0%, ${palette.soft} 100%)`,
        color: palette.fg,
      }}
    >
      <span className="select-none font-serif text-6xl font-light tracking-[-0.04em] sm:text-7xl lg:text-8xl">
        {initial}
      </span>
    </div>
  );
}
