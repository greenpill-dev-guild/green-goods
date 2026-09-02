declare module "svg-pan-zoom" {
  type SvgPanZoomOptions = {
    controlIconsEnabled?: boolean;
    fit?: boolean;
    center?: boolean;
    mouseWheelZoomEnabled?: boolean;
    dblClickZoomEnabled?: boolean;
    minZoom?: number;
    maxZoom?: number;
    zoomScaleSensitivity?: number;
  };
  type SvgPanZoomInstance = {
    destroy(): void;
    resize(): void;
    fit(): void;
    center(): void;
  };
  export default function svgPanZoom(
    element: SVGElement | HTMLElement | string,
    options?: SvgPanZoomOptions,
  ): SvgPanZoomInstance;
}
