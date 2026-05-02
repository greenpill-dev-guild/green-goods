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
    ink: "rgb(160 90 44)",
    soft: "rgb(248 237 224)",
    fg: "rgb(45 33 24)",
  },
  {
    // agro — deep moss → pale sage
    ink: "rgb(62 85 50)",
    soft: "rgb(234 239 226)",
    fg: "rgb(45 33 24)",
  },
  {
    // education — slate violet → pale violet
    ink: "rgb(74 69 100)",
    soft: "rgb(235 232 240)",
    fg: "rgb(45 33 24)",
  },
  {
    // waste — harbour blue → pale harbour
    ink: "rgb(46 79 107)",
    soft: "rgb(226 234 240)",
    fg: "rgb(45 33 24)",
  },
  {
    // editorial — walnut → linen
    ink: "rgb(45 33 24)",
    soft: "rgb(241 236 226)",
    fg: "rgb(45 33 24)",
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
