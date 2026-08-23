import { ActionBannerFallback, type Domain, ImageWithFallback } from "@green-goods/shared";

interface ActionDetailMediaTileProps {
  src?: string;
  alt: string;
  domain: Domain | null;
  title: string;
}

export function ActionDetailMediaTile({ src, alt, domain, title }: ActionDetailMediaTileProps) {
  return (
    <div className="relative h-40 overflow-hidden rounded-lg">
      <ImageWithFallback
        src={src || ""}
        alt={alt}
        className="h-40 w-full object-cover"
        fallbackClassName="h-40 w-full"
        backgroundFallback={
          <ActionBannerFallback domain={domain} title={title} className="rounded-lg" />
        }
      />
    </div>
  );
}
