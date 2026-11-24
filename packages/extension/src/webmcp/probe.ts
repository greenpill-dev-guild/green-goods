// Shared by the isolated-world and main-world content scripts: can this world see the page's
// WebMCP tools, and can it run one? The result is written to a data attribute on <html> so the
// page, the other world and the CDP rig can all read it.

export interface ToolSummary {
  name: string;
  description?: string;
  annotations?: Record<string, unknown> | null;
  hasInputSchema: boolean;
}

export interface ProbeResult {
  world: "isolated" | "main";
  modelContextType: string;
  api: string[];
  tools: ToolSummary[] | null;
  executed: { name: string; ok: boolean; resultPreview: string | null; error: string | null } | null;
  error: string | null;
  elapsedMs: number;
}

interface ModelContextLike {
  getTools?: (options?: { fromOrigins?: string[] }) => Promise<Array<Record<string, unknown>>>;
  executeTool?: (tool: unknown, input?: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
}

const TOOL_PREFIX = "green_goods_";

export async function probeModelContext(world: ProbeResult["world"], timeoutMs = 4000): Promise<ProbeResult> {
  const started = performance.now();
  const result: ProbeResult = { world, modelContextType: "undefined", api: [], tools: null, executed: null, error: null, elapsedMs: 0 };
  try {
    const modelContext = (document as Document & { modelContext?: ModelContextLike }).modelContext;
    result.modelContextType = typeof modelContext;
    if (!modelContext) return finish(result, started);
    result.api = Object.getOwnPropertyNames(Object.getPrototypeOf(modelContext)).filter((name) => name !== "constructor");
    if (typeof modelContext.getTools !== "function") {
      result.error = "getTools is not a function";
      return finish(result, started);
    }
    let tools: Array<Record<string, unknown>> = [];
    const deadline = started + timeoutMs;
    while (performance.now() < deadline) {
      tools = await modelContext.getTools();
      if (tools.some((tool) => String(tool.name).startsWith(TOOL_PREFIX))) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    result.tools = tools.map((tool) => ({
      name: String(tool.name),
      description: typeof tool.description === "string" ? tool.description : undefined,
      annotations: (tool.annotations as Record<string, unknown> | undefined) ?? null,
      hasInputSchema: Boolean(tool.inputSchema),
    }));
    const target = tools.find((tool) => String(tool.name).startsWith(TOOL_PREFIX));
    if (!target) return finish(result, started);
    if (typeof modelContext.executeTool !== "function") {
      result.error = "executeTool is not a function";
      return finish(result, started);
    }
    try {
      const controller = new AbortController();
      const value = await modelContext.executeTool(target, { includeWork: true }, { signal: controller.signal });
      const text = typeof value === "string" ? value : JSON.stringify(value);
      result.executed = { name: String(target.name), ok: true, resultPreview: text.slice(0, 160), error: null };
    } catch (error) {
      result.executed = { name: String(target.name), ok: false, resultPreview: null, error: String((error as Error)?.message ?? error) };
    }
  } catch (error) {
    result.error = String((error as Error)?.message ?? error);
  }
  return finish(result, started);
}

export function publishProbeResult(result: ProbeResult): void {
  const key = result.world === "main" ? "g0Main" : "g0Isolated";
  document.documentElement.dataset[key] = JSON.stringify(result);
}

function finish(result: ProbeResult, started: number): ProbeResult {
  result.elapsedMs = Math.round(performance.now() - started);
  return result;
}
