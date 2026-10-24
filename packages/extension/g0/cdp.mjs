// Minimal Chrome DevTools Protocol driver over Node's global WebSocket.
// Launches a browser with a scratch --user-data-dir and --remote-debugging-port=0,
// reads DevToolsActivePort, and exposes evaluate/open/close helpers.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.console = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code}) ${msg.error.data ?? ""}`));
        else resolve(msg.result);
      } else if (msg.method) {
        if (msg.sessionId && (msg.method === "Runtime.consoleAPICalled" || msg.method === "Runtime.exceptionThrown")) {
          const lines = this.console.get(msg.sessionId) ?? [];
          if (msg.method === "Runtime.consoleAPICalled") {
            lines.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(" ")}`);
          } else {
            const d = msg.params.exceptionDetails;
            lines.push(`[exception] ${d.exception?.description ?? d.text} @ ${d.url ?? ""}:${d.lineNumber}`);
          }
          this.console.set(msg.sessionId, lines.slice(-200));
        }
        for (const l of this.listeners) l(msg);
      }
    });
  }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", (e) => reject(new Error(`ws error ${e.message ?? ""}`)), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(handler) {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== handler);
    };
  }
  async targets() {
    return (await this.send("Target.getTargets")).targetInfos;
  }
  async attach(targetId) {
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    this.console.set(sessionId, []);
    await this.send("Runtime.enable", {}, sessionId);
    return sessionId;
  }
  logs(sessionId) {
    return this.console.get(sessionId) ?? [];
  }
  async openPage(url) {
    const { targetId } = await this.send("Target.createTarget", { url });
    const sessionId = await this.attach(targetId);
    await this.send("Page.enable", {}, sessionId);
    return { targetId, sessionId };
  }
  async waitForLoad(sessionId, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { result } = await this.send(
        "Runtime.evaluate",
        { expression: "document.readyState", returnByValue: true },
        sessionId,
      );
      if (result.value === "complete") return;
      await sleep(100);
    }
    throw new Error("page did not reach readyState complete");
  }
  async evaluate(sessionId, expression, { awaitPromise = true, timeoutMs = 120000 } = {}) {
    const res = await this.send(
      "Runtime.evaluate",
      { expression, awaitPromise, returnByValue: true, timeout: timeoutMs },
      sessionId,
    );
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(`evaluate threw: ${d.exception?.description ?? d.text}`);
    }
    return res.result.value;
  }
  async closeTarget(targetId) {
    await this.send("Target.closeTarget", { targetId });
  }
  close() {
    this.ws.close();
  }
}

export const BRAVE_BETA = "/Applications/Brave Browser Beta.app/Contents/MacOS/Brave Browser Beta";

export async function launchBrowser({
  executable = BRAVE_BETA,
  userDataDir,
  headless = true,
  extensions = [],
  args = [],
  fresh = false,
  env = {},
  logFile,
}) {
  if (fresh && existsSync(userDataDir)) rmSync(userDataDir, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });
  const portFile = join(userDataDir, "DevToolsActivePort");
  if (existsSync(portFile)) rmSync(portFile);
  const argv = [
    `--user-data-dir=${userDataDir}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    ...(headless ? ["--headless"] : []),
    ...(extensions.length
      ? [`--load-extension=${extensions.join(",")}`, `--disable-extensions-except=${extensions.join(",")}`]
      : []),
    ...args,
    "about:blank",
  ];
  const child = spawn(executable, argv, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  const chunks = [];
  const log = (d) => {
    chunks.push(d.toString());
    if (logFile) import("node:fs").then((fs) => fs.appendFileSync(logFile, d));
  };
  child.stdout.on("data", log);
  child.stderr.on("data", log);
  const start = Date.now();
  while (!existsSync(portFile)) {
    if (child.exitCode !== null) throw new Error(`browser exited early (${child.exitCode}): ${chunks.join("")}`);
    if (Date.now() - start > 30000) throw new Error(`DevToolsActivePort not written: ${chunks.join("")}`);
    await sleep(100);
  }
  await sleep(200);
  const [port, path] = readFileSync(portFile, "utf8").trim().split("\n");
  const wsUrl = `ws://127.0.0.1:${port}${path}`;
  const cdp = await Cdp.connect(wsUrl);
  await cdp.send("Target.setDiscoverTargets", { discover: true });
  return {
    child,
    cdp,
    port: Number(port),
    wsUrl,
    argv,
    stderr: () => chunks.join(""),
    async kill() {
      try { cdp.close(); } catch {}
      child.kill("SIGTERM");
      const t = Date.now();
      while (child.exitCode === null && Date.now() - t < 5000) await sleep(100);
      if (child.exitCode === null) child.kill("SIGKILL");
    },
  };
}

export async function waitForTarget(cdp, predicate, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await cdp.targets();
    const found = list.find(predicate);
    if (found) return found;
    await sleep(150);
  }
  return null;
}
