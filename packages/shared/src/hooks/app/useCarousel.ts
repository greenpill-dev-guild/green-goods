import { createContext, useContext } from "react";
import type { UseEmblaCarouselType } from "embla-carousel-react";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof import("embla-carousel-react").default>[0];
type CarouselPlugin = Parameters<typeof import("embla-carousel-react").default>[1];

export type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
  enablePreview?: boolean;
  previewImages?: string[];
};

export type CarouselContextProps = {
  carouselRef: ReturnType<typeof import("embla-carousel-react").default>[0];
  api: ReturnType<typeof import("embla-carousel-react").default>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  openPreview?: (index: number) => void;
} & CarouselProps;

export const CarouselContext = createContext<CarouselContextProps | null>(null);

export function useCarousel(): CarouselContextProps {
  const context = useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}
