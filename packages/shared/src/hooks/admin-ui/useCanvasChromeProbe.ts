import { useEffect } from "react";

export type CanvasChromeProbeComponent = "CanvasLayout" | "FabAwareNavigationBar" | "NavigationBar";
type CanvasChromeProbePhase = "render" | "mount" | "update" | "unmount";

interface CanvasChromeProbeStats {
  renders: number;
  mounts: number;
  updates: number;
  unmounts: number;
  lastDetail?: unknown;
}

interface CanvasChromeProbeEvent {
  sequence: number;
  component: CanvasChromeProbeComponent;
  phase: CanvasChromeProbePhase;
  detail?: unknown;
}

interface CanvasChromeProbeState {
  sequence: number;
  components: Partial<Record<CanvasChromeProbeComponent, CanvasChromeProbeStats>>;
  events: CanvasChromeProbeEvent[];
}

declare global {
  interface Window {
    __GG_CANVAS_CHROME_DEBUG__?: CanvasChromeProbeState;
  }
}

function isLocalCanvasChromeProbeHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function reflectCanvasChromeProbeToDom(
  component: CanvasChromeProbeComponent,
  stats: CanvasChromeProbeStats,
  sequence: number
) {
  const key = component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const root = document.documentElement;

  root.setAttribute("data-gg-canvas-chrome-sequence", String(sequence));
  root.setAttribute(`data-gg-canvas-chrome-${key}-renders`, String(stats.renders));
  root.setAttribute(`data-gg-canvas-chrome-${key}-mounts`, String(stats.mounts));
  root.setAttribute(`data-gg-canvas-chrome-${key}-updates`, String(stats.updates));
  root.setAttribute(`data-gg-canvas-chrome-${key}-unmounts`, String(stats.unmounts));
}

function recordCanvasChromeProbe(
  component: CanvasChromeProbeComponent,
  phase: CanvasChromeProbePhase,
  detail?: unknown
) {
  if (typeof window === "undefined" || !isLocalCanvasChromeProbeHost(window.location.hostname)) {
    return;
  }

  const probe = (window.__GG_CANVAS_CHROME_DEBUG__ ??= {
    sequence: 0,
    components: {},
    events: [],
  });
  const stats = (probe.components[component] ??= {
    renders: 0,
    mounts: 0,
    updates: 0,
    unmounts: 0,
  });

  if (phase === "render") stats.renders += 1;
  if (phase === "mount") stats.mounts += 1;
  if (phase === "update") stats.updates += 1;
  if (phase === "unmount") stats.unmounts += 1;
  stats.lastDetail = detail;

  probe.sequence += 1;
  probe.events.push({ sequence: probe.sequence, component, phase, detail });
  if (probe.events.length > 200) {
    probe.events.splice(0, probe.events.length - 200);
  }
  reflectCanvasChromeProbeToDom(component, stats, probe.sequence);
}

/** Records bounded local-only render and lifecycle diagnostics for admin canvas chrome. */
export function useCanvasChromeProbe(component: CanvasChromeProbeComponent, detail?: unknown) {
  recordCanvasChromeProbe(component, "render", detail);

  useEffect(() => {
    recordCanvasChromeProbe(component, "mount", detail);
    return () => recordCanvasChromeProbe(component, "unmount", detail);
    // Mount/unmount identity is component-scoped. Render detail is recorded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component]);
}
