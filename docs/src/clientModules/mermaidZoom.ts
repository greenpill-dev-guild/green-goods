import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

// Mermaid renders client-side after hydration, and this pane (or tab) can be
// hidden while that happens — hidden elements measure 0×0, which breaks
// svg-pan-zoom's fit math. Discovery therefore runs through a MutationObserver
// and attachment waits for first visibility via an IntersectionObserver.
const MERMAID_SVG_SELECTOR = 'svg[id^="mermaid"], [class*="mermaid"] > svg';
const MIN_HEIGHT_PX = 220;
const MAX_HEIGHT_PX = 640;

let mutations: MutationObserver | null = null;
let visibility: IntersectionObserver | null = null;

function viewBoxHeight(svg: SVGSVGElement): number {
  const parts = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
  const height = Number(parts[3]);
  return Number.isFinite(height) && height > 0 ? height : MIN_HEIGHT_PX;
}

async function enhance(svg: SVGSVGElement): Promise<void> {
  svg.dataset.ggPanZoom = "attached";
  const {default: svgPanZoom} = await import("svg-pan-zoom");
  svg.style.height = `${Math.min(Math.max(viewBoxHeight(svg), MIN_HEIGHT_PX), MAX_HEIGHT_PX)}px`;
  svg.style.width = "100%";
  svg.style.maxWidth = "100%";
  svgPanZoom(svg, {
    controlIconsEnabled: true,
    fit: true,
    center: true,
    // Wheel zoom hijacks page scrolling; the control icons, double-click, and
    // drag cover zooming without trapping the reader.
    mouseWheelZoomEnabled: false,
    dblClickZoomEnabled: true,
    minZoom: 0.4,
    maxZoom: 12,
    zoomScaleSensitivity: 0.4,
  });
}

function queue(svg: SVGSVGElement): void {
  if (svg.dataset.ggPanZoom) {
    return;
  }
  svg.dataset.ggPanZoom = "queued";
  visibility?.observe(svg);
}

function scan(root: ParentNode): void {
  for (const svg of root.querySelectorAll<SVGSVGElement>(MERMAID_SVG_SELECTOR)) {
    queue(svg);
  }
}

function start(): void {
  visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.boundingClientRect.width > 0) {
        visibility?.unobserve(entry.target);
        void enhance(entry.target as SVGSVGElement);
      }
    }
  });
  scan(document);
  mutations?.disconnect();
  mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }
        // querySelectorAll only reaches descendants, and mermaid can inject the
        // SVG as the added node itself — match it directly as well.
        if (node.matches(MERMAID_SVG_SELECTOR)) {
          queue(node as unknown as SVGSVGElement);
        }
        scan(node);
      }
    }
  });
  mutations.observe(document.body, {childList: true, subtree: true});
}

if (ExecutionEnvironment.canUseDOM) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once: true});
  } else {
    start();
  }
}

export function onRouteDidUpdate(): void {
  if (ExecutionEnvironment.canUseDOM) {
    scan(document);
  }
}
