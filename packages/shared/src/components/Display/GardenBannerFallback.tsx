import * as React from "react";
import { cn } from "../../utils/styles/cn";

/**
 * Curated nature-inspired gradient palette.
 * Each garden deterministically maps to one gradient via a name hash,
 * giving every garden a unique but consistent visual identity.
 */
const GARDEN_GRADIENTS = [
	"linear-gradient(135deg, #065f46 0%, #0d9488 100%)", // Forest
	"linear-gradient(135deg, #164e63 0%, #0891b2 100%)", // Ocean
	"linear-gradient(135deg, #14532d 0%, #16a34a 100%)", // Meadow
	"linear-gradient(135deg, #312e81 0%, #7c3aed 100%)", // Twilight
	"linear-gradient(135deg, #78350f 0%, #d97706 100%)", // Autumn
	"linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", // Sky
	"linear-gradient(135deg, #365314 0%, #65a30d 100%)", // Spring
	"linear-gradient(135deg, #4c1d95 0%, #a78bfa 100%)", // Lavender
] as const;

/**
 * Subtle dot-grid pattern overlay for texture depth.
 * Uses radial-gradient to create a repeating dot pattern at low opacity.
 */
const DOT_PATTERN =
	"radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)";
const DOT_SIZE = "16px 16px";

/** Simple string hash (djb2) for deterministic gradient selection */
function hashName(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash);
}

export interface GardenBannerFallbackProps {
	/** Garden name — used for initial letter and gradient selection */
	name: string;
	/** Additional class names for the root container */
	className?: string;
}

/**
 * Deterministic gradient fallback for garden banners.
 *
 * Renders a nature-inspired gradient with a subtle dot-grid texture and
 * the garden's initial letter. The gradient is selected based on a hash
 * of the garden name, so the same garden always gets the same color.
 *
 * Usage:
 * ```tsx
 * <div className="relative h-48">
 *   {bannerImage ? <img ... /> : <GardenBannerFallback name={gardenName} />}
 * </div>
 * ```
 */
export const GardenBannerFallback: React.FC<GardenBannerFallbackProps> =
	React.memo(({ name, className }) => {
		const gradient =
			GARDEN_GRADIENTS[hashName(name || "Garden") % GARDEN_GRADIENTS.length];

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
				{/* Initial letter */}
				<div className="absolute inset-0 grid place-items-center">
					<span className="text-5xl font-bold text-white/30 select-none drop-shadow-sm">
						{(name?.charAt(0) || "G").toUpperCase()}
					</span>
				</div>
			</div>
		);
	});

GardenBannerFallback.displayName = "GardenBannerFallback";
