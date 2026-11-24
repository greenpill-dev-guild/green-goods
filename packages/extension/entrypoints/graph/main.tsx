import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { mountGardenGraph, type CanvasStats } from "../../src/graph/canvas";
import { buildSyntheticGarden } from "../../src/graph/synthetic";
import { createG0Api, type G0Api } from "./g0-api";

// The graph tab: one Sigma canvas over the synthetic garden plus a side panel that shows what the
// g0 rig drives through `window.__g0`. The buttons let a person run the same measurements by hand.

declare global {
  interface Window {
    __g0: G0Api;
  }
}

function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<CanvasStats | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ fraction: number; file: string } | null>(null);
  const [api, setApi] = useState<G0Api | null>(null);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    let cancelled = false;
    const say = (line: string) => setLog((lines) => [...lines.slice(-40), `${new Date().toISOString().slice(11, 19)} ${line}`]);
    void mountGardenGraph(container, buildSyntheticGarden()).then(({ stats: rendered }) => {
      if (cancelled) return;
      setStats(rendered);
      const created = createG0Api({ graph: rendered, say, onModelProgress: (fraction, file) => setProgress({ fraction, file }) });
      window.__g0 = created;
      setApi(created);
      document.title = `Grove G0 graph (${rendered.nodeCount} nodes)`;
      say(`graph ready: ${rendered.nodeCount} nodes, ${rendered.edgeCount} edges, mount ${rendered.mountMs} ms, render confirmed ${rendered.renderConfirmedMs ?? "no"} ms`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = (label: string, task: () => Promise<unknown>) => () => {
    setLog((lines) => [...lines, `… ${label}`]);
    task()
      .then((result) => setLog((lines) => [...lines, `${label}: ${JSON.stringify(result).slice(0, 600)}`]))
      .catch((error: Error) => setLog((lines) => [...lines, `${label} failed: ${error.message}`]));
  };

  return (
    <>
      <header>
        <h1>Grove G0 graph</h1>
        <code>extension {browser.runtime.id}</code>
        {stats ? <code>{stats.nodeCount} nodes, {stats.edgeCount} edges, mount {stats.mountMs} ms</code> : <code>rendering…</code>}
      </header>
      <main>
        <div id="canvas" ref={canvasRef} />
        <aside>
          <h2>Model</h2>
          <button type="button" disabled={!api} onClick={api ? run("model", () => api.model.run()) : undefined}>Load Gemma and propose</button>
          {progress ? <progress value={progress.fraction} max={1} title={progress.file} /> : null}
          <h2>Pi Durable</h2>
          <button type="button" disabled={!api} onClick={api ? run("resume", () => api.pi.resumeDemo()) : undefined}>Crash mid-work, reopen</button>
          <button type="button" disabled={!api} onClick={api ? run("apply", () => api.pi.crashAfterApplyDemo()) : undefined}>Crash after apply, reopen</button>
          <h2>Extension</h2>
          <button type="button" onClick={() => browser.runtime.reload()}>Reload extension</button>
          <h2>Log</h2>
          <pre>{log.join("\n")}</pre>
        </aside>
      </main>
    </>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
