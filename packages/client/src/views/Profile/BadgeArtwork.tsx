import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAwardLine, RiCoinsLine, RiHammerLine, RiSeedlingLine } from "@remixicon/react";
import { useState } from "react";
import { isAddress, zeroAddress } from "viem";

function BadgeGlyph({ slug }: { slug: string }) {
  switch (slug) {
    case "genesis":
      return <RiSeedlingLine />;
    case "first-work":
      return <RiHammerLine />;
    case "first-support":
      return <RiCoinsLine />;
    default:
      return <RiAwardLine />;
  }
}

/** The tile's 80px mark (DL-186) and the badge sheet's 144px one (DL-183). */
const SIZES = {
  tile: { box: "size-20 [&>svg]:size-7", px: 80 },
  sheet: { box: "size-36 [&>svg]:size-16", px: 144 },
} as const;

interface BadgeArtworkProps {
  slug: string;
  chainId: number;
  unlockLock: Address;
  size: keyof typeof SIZES;
}

/**
 * A badge's artwork on the app's green round mark. Unlock serves artwork for
 * the badge's collection, even before the badge is claimed. A badge with no
 * collection, or whose artwork fails to load, shows its own glyph on the mark.
 * The artwork is decorative: the badge's name is always beside it.
 */
export function BadgeArtwork({ slug, chainId, unlockLock, size }: BadgeArtworkProps) {
  const { box, px } = SIZES[size];
  const [failedSrc, setFailedSrc] = useState<string>();
  const src =
    isAddress(unlockLock, { strict: false }) && unlockLock !== zeroAddress
      ? `https://locksmith.unlock-protocol.com/${chainId}/lock/${unlockLock}/icon`
      : undefined;

  return (
    <span
      aria-hidden="true"
      data-testid="badge-artwork"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--primary-container))] [&>svg]:text-[rgb(var(--primary-container-foreground))]",
        box
      )}
    >
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          className="size-full object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <BadgeGlyph slug={slug} />
      )}
    </span>
  );
}
