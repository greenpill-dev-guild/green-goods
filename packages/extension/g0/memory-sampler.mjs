// Samples the resident set size of every process of one browser launch (matched by its
// --user-data-dir) through `ps`, and keeps the peak per process type and in total.
import { execFile } from "node:child_process";

function psSnapshot() {
  return new Promise((resolve) => {
    execFile("ps", ["-axo", "pid=,rss=,args="], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? "" : stdout);
    });
  });
}

function processType(args) {
  const type = args.match(/--type=([a-z-]+)/)?.[1];
  if (!type) return "browser";
  if (type === "renderer") return args.includes("--extension-process") ? "renderer-extension" : "renderer";
  return type;
}

export function startMemorySampler(profileDir, intervalMs = 500) {
  const peaks = { total: 0 };
  const series = [];
  let samples = 0;
  let timer = null;
  let running = true;
  const sample = async () => {
    const snapshot = await psSnapshot();
    if (!running) return;
    const byType = {};
    let total = 0;
    for (const line of snapshot.split("\n")) {
      if (!line.includes(profileDir)) continue;
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) continue;
      const rssBytes = Number(match[2]) * 1024;
      const type = processType(match[3]);
      byType[type] = (byType[type] ?? 0) + rssBytes;
      total += rssBytes;
    }
    samples += 1;
    series.push({ at: Date.now(), total, ...byType });
    peaks.total = Math.max(peaks.total, total);
    for (const [type, bytes] of Object.entries(byType)) peaks[type] = Math.max(peaks[type] ?? 0, bytes);
    if (running) timer = setTimeout(sample, intervalMs);
  };
  timer = setTimeout(sample, 0);
  return {
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      return { peaks, samples, baseline: series[0] ?? null, last: series.at(-1) ?? null };
    },
  };
}
