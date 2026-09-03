import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

// Every mermaid diagram gets a visible Expand control that opens a full-screen
// overlay with zoom and pan. Attachment is a plain DOM decoration (no
// measurement, no IntersectionObserver), so it works no matter when or where
// mermaid finishes rendering.
const CONTAINER_SELECTOR = ".docusaurus-mermaid-container";
const SCALE_MIN = 0.25;
const SCALE_MAX = 8;
const SCALE_STEP = 1.25;

let observer: MutationObserver | null = null;

function viewBoxSize(svg: SVGSVGElement): {width: number; height: number} {
  const parts = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
  const width = Number(parts[2]);
  const height = Number(parts[3]);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 800,
    height: Number.isFinite(height) && height > 0 ? height : 400,
  };
}

// Mermaid scopes its embedded stylesheet to the SVG id, so the clone gets a
// fresh id and a rewritten stylesheet instead of duplicating the original id.
function cloneDiagram(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const oldId = svg.id;
  if (oldId) {
    const newId = `${oldId}-expanded`;
    clone.id = newId;
    for (const style of clone.querySelectorAll("style")) {
      style.textContent = (style.textContent ?? "").split(`#${oldId}`).join(`#${newId}`);
    }
  }
  return clone;
}

function openOverlay(svg: SVGSVGElement, trigger: HTMLButtonElement): void {
  const {width, height} = viewBoxSize(svg);
  let scale = 1;

  const overlay = document.createElement("div");
  overlay.className = "gg-diagram-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Expanded diagram");

  const toolbar = document.createElement("div");
  toolbar.className = "gg-diagram-toolbar";

  const viewport = document.createElement("div");
  viewport.className = "gg-diagram-viewport";

  const stage = document.createElement("div");
  stage.className = "gg-diagram-stage";

  const clone = cloneDiagram(svg);
  clone.removeAttribute("width");
  clone.style.maxWidth = "none";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const applyScale = () => {
    stage.style.width = `${width * scale}px`;
    stage.style.height = `${height * scale}px`;
    clone.style.transform = `scale(${scale})`;
    stage.dataset.scale = scale.toFixed(2);
  };

  const setScale = (next: number) => {
    scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
    applyScale();
  };

  const close = () => {
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.classList.remove("gg-diagram-overlay-open");
    trigger.focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };

  const button = (label: string, title: string, onClick: () => void) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "gg-diagram-button";
    el.textContent = label;
    el.title = title;
    el.setAttribute("aria-label", title);
    el.addEventListener("click", onClick);
    return el;
  };

  toolbar.append(
    button("−", "Zoom out", () => setScale(scale / SCALE_STEP)),
    button("100%", "Reset zoom", () => setScale(1)),
    button("+", "Zoom in", () => setScale(scale * SCALE_STEP)),
    button("×", "Close", close),
  );

  clone.style.transformOrigin = "top left";
  applyScale();
  stage.append(clone);
  viewport.append(stage);
  overlay.append(toolbar, viewport);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target === viewport) {
      close();
    }
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setScale(event.deltaY < 0 ? scale * 1.1 : scale / 1.1);
    },
    {passive: false},
  );
  viewport.addEventListener("dblclick", () => setScale(scale === 1 ? 2 : 1));
  document.addEventListener("keydown", onKeydown, true);

  document.body.append(overlay);
  document.body.classList.add("gg-diagram-overlay-open");
  (toolbar.lastElementChild as HTMLButtonElement).focus();
}

function decorate(container: Element): void {
  if (!(container instanceof HTMLElement) || container.dataset.ggExpand) {
    return;
  }
  container.dataset.ggExpand = "true";
  container.classList.add("gg-diagram-container");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "gg-diagram-expand";
  trigger.textContent = "⛶ Expand";
  trigger.setAttribute("aria-label", "Expand diagram to full screen");
  trigger.addEventListener("click", () => {
    const svg = container.querySelector("svg");
    if (svg) {
      openOverlay(svg as SVGSVGElement, trigger);
    }
  });
  container.append(trigger);
}

function scan(root: ParentNode): void {
  if (root instanceof Element && root.matches(CONTAINER_SELECTOR)) {
    decorate(root);
  }
  for (const container of root.querySelectorAll(CONTAINER_SELECTOR)) {
    decorate(container);
  }
}

function start(): void {
  scan(document);
  observer?.disconnect();
  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          scan(node);
        }
      }
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
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
