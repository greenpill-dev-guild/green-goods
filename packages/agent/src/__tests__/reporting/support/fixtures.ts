import {
  type ActionDefinition,
  type ActionDefinitionSnapshot,
  snapshotActionDefinition,
} from "@green-goods/shared/modules/agent-reporting";
import type { CatalogResult, ReportingCatalog } from "../../../services/reporting/catalog";
import type {
  InterpretationRequest,
  InterpretationResult,
  ReportInterpreter,
} from "../../../services/reporting/interpretation";
import type { GardenDirectory, ReportingGarden } from "../../../services/reporting/gardens";
import type { ReportingClock, ReportingIds } from "../../../services/reporting/runtime";
import type {
  OutboundRequest,
  OutboundResult,
  OutboundTransport,
} from "../../../services/reporting/transport";

/**
 * Deterministic test doubles for the reporting harness. They prove orchestration only: canned
 * catalog, model and transport behavior says nothing about live provider or chain compatibility.
 */
export const TEST_KEYS = `k1:${Buffer.alloc(32, 1).toString("base64")},k2:${Buffer.alloc(32, 2).toString("base64")}`;

export const TAS: ReportingGarden = {
  key: "tas",
  chainId: 42161,
  address: "0x00000000000000000000000000000000000000a1",
  label: "TAS",
};
export const AIYELOJA: ReportingGarden = {
  key: "aiyeloja",
  chainId: 42161,
  address: "0x00000000000000000000000000000000000000a2",
  label: "Aiyeloja Family Garden",
};

/** A fixed garden list; the live directory reads every garden from the indexer. */
export function fixedGardens(gardens: ReportingGarden[] = [TAS, AIYELOJA]): GardenDirectory {
  return { list: () => gardens, refresh: async () => undefined };
}

export const ACTION_REGISTRY = "0x00000000000000000000000000000000000000b0" as const;

export function planting(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    chainId: 42161,
    actionUID: 7,
    slug: "tree-planting",
    title: "Tree planting",
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER,
    domain: 1,
    inputs: [
      {
        key: "seedlings",
        title: "Seedlings planted",
        placeholder: "",
        type: "number",
        required: true,
        options: [],
        unit: "seedlings",
      },
      {
        key: "species",
        title: "Main species",
        placeholder: "",
        type: "select",
        required: true,
        options: ["moringa", "baobab", "neem"],
        optionLabels: { moringa: "Moringa", baobab: "Baobab", neem: "Neem" },
      },
      { key: "notes", title: "Notes", placeholder: "", type: "text", required: false, options: [] },
    ],
    media: { required: false, minImageCount: 0, maxImageCount: 3 },
    ...overrides,
  };
}

export function weeding(): ActionDefinition {
  return {
    chainId: 42161,
    actionUID: 8,
    slug: "weeding",
    title: "Weeding",
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER,
    domain: 1,
    inputs: [
      {
        key: "area",
        title: "Area weeded",
        placeholder: "",
        type: "band",
        required: true,
        options: [],
        bands: ["small", "large"],
      },
    ],
    media: { required: false, minImageCount: 0, maxImageCount: 3 },
  };
}

export function snapshot(
  definition: ActionDefinition,
  instructionsRef = `bafy-${definition.slug}`,
  block = 100n
): ActionDefinitionSnapshot {
  return snapshotActionDefinition(
    definition,
    { registry: ACTION_REGISTRY, instructionsRef },
    block
  );
}

/** A catalog whose contents and availability each test controls. */
export class FixtureCatalog implements ReportingCatalog {
  unavailable = false;
  calls = 0;
  readonly actions = new Map<string, ActionDefinitionSnapshot[]>([
    [TAS.key, [snapshot(planting()), snapshot(weeding())]],
    [AIYELOJA.key, [snapshot(planting())]],
  ]);

  async eligibleActions(garden: ReportingGarden): Promise<CatalogResult> {
    this.calls += 1;
    if (this.unavailable) return { ok: false, reason: "unavailable" };
    return { ok: true, actions: this.actions.get(garden.key) ?? [] };
  }
}

/** Scripted interpretation with an optional hook that runs while the "model call" is in flight. */
export class FixtureInterpreter implements ReportInterpreter {
  readonly requests: InterpretationRequest[] = [];
  responses: Array<InterpretationResult | Error> = [];
  duringCall: (() => void | Promise<void>) | null = null;

  async interpret(request: InterpretationRequest): Promise<InterpretationResult> {
    this.requests.push(request);
    const hook = this.duringCall;
    this.duringCall = null;
    await hook?.();
    const next = this.responses.shift();
    if (!next) throw new Error("No scripted interpretation");
    if (next instanceof Error) throw next;
    return next;
  }
}

export class RecordingTransport implements OutboundTransport {
  readonly sent: OutboundRequest[] = [];
  script: Array<OutboundResult | Error> = [];
  private counter = 0;

  async send(request: OutboundRequest): Promise<OutboundResult> {
    const scripted = this.script.shift();
    if (scripted instanceof Error) throw scripted;
    if (scripted && scripted.status !== "accepted") return scripted;
    this.sent.push(request);
    this.counter += 1;
    return scripted ?? { status: "accepted", providerMessageId: `msg-${this.counter}` };
  }

  texts(): string[] {
    return this.sent.map((request) => request.message.text);
  }

  last(): OutboundRequest {
    const request = this.sent.at(-1);
    if (!request) throw new Error("Nothing was sent");
    return request;
  }
}

export class ManualClock implements ReportingClock {
  constructor(public time = Date.UTC(2026, 8, 27, 9, 0, 0)) {}
  now(): number {
    return this.time;
  }
  advance(ms: number): void {
    this.time += ms;
  }
}

export class SequentialIds implements ReportingIds {
  private next = 0;
  private codeCounter = 1000;
  id(): string {
    this.next += 1;
    return `id-${String(this.next).padStart(5, "0")}`;
  }
  token(): string {
    this.next += 1;
    return `token-${String(this.next).padStart(5, "0")}-${"x".repeat(20)}`;
  }
  code(digits: number): string {
    this.codeCounter += 7;
    return String(this.codeCounter).slice(-digits).padStart(digits, "0");
  }
}
