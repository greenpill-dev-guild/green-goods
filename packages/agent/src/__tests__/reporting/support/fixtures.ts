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
import type { FakeChain } from "./fake-chain";
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

/** A fixed directory whose reads of an account's gardens a test can make fail or go stale. */
export interface FixedGardens extends GardenDirectory {
  /**
   * While true the indexer is down and every read fails. As with the live directory, an account
   * the last good read placed in a garden keeps its gardens meanwhile, and one that read placed
   * nowhere cannot be read. A failed read is left alone for as long as the live directory leaves
   * it, and only a read that goes through ends that state.
   */
  unavailable: boolean;
  /**
   * While true an account's gardens are those of the last read, held as long as the live
   * directory holds them. Otherwise they follow the chain at once.
   */
  cached: boolean;
  /** How many times the list has been read. */
  reads: number;
}

/**
 * A fixed garden list; the live directory reads every garden from the indexer. Given the fake
 * chain, an account's gardens follow the roles granted there, as the indexer follows the real
 * chain. Without it no account is in any garden.
 */
export function fixedGardens(
  gardens: ReportingGarden[] = [TAS, AIYELOJA],
  chain?: Pick<FakeChain, "roles">
): FixedGardens {
  /** The roles as the last good read found them. */
  let read = new Map(chain?.roles);
  let readAt: number | null = null;
  let failedAt: number | null = null;
  const directory: FixedGardens = {
    unavailable: false,
    cached: false,
    reads: 0,
    list: () => gardens,
    membershipsOf(account) {
      // With no current read the last good one answers, and only for an account it placed.
      const down = directory.unavailable || failedAt !== null;
      const granted = down || directory.cached ? read : chain?.roles;
      const own = gardens.filter((garden) => {
        const roles = granted?.get(`${garden.address}:${account.toLowerCase()}`);
        return Boolean(roles && (roles.gardener || roles.operator || roles.owner));
      });
      return own.length > 0 || !down
        ? { ok: true, gardens: own }
        : { ok: false, reason: "unavailable" };
    },
    async refresh(nowMs, maxAgeMs = 5 * 60 * 1000, retryAfterMs = 30_000) {
      if (failedAt !== null && nowMs - failedAt < retryAfterMs) return;
      if (directory.unavailable) {
        // An uncached list followed the chain until now, so that is what its last read held.
        if (failedAt === null && !directory.cached) read = new Map(chain?.roles);
        failedAt = nowMs;
        readAt = null;
        throw new Error("indexer unavailable");
      }
      failedAt = null;
      if (readAt !== null && nowMs - readAt < maxAgeMs) return;
      read = new Map(chain?.roles);
      readAt = nowMs;
      directory.reads += 1;
    },
  };
  return directory;
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
