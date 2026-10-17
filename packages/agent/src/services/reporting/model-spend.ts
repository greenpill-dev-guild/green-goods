import { createLogger } from "../logger";
import { readControl } from "./controls";
import { inTransaction } from "./database";
import type { ReportingCore } from "./runtime";

const log = createLogger("reporting");

/**
 * The model spend ledger and its daily cap (technical brief §11.3). Each provider adapter reports
 * every request it sends: the pinned model, the outcome and the tokens the provider billed. The
 * ledger prices the call and keeps it with no message content and no participant, conversation or
 * account identifier. Once a UTC day's recorded cost reaches the cap, model processing stops
 * exactly as if its operator switch were off: chat turns ask plain questions, files are kept
 * unread and voice notes are declined, until 00:00 UTC.
 *
 * A request that got no answer (a network error or timeout) may still have been billed; its cost
 * is unknown and it counts toward nothing but the call totals in the operator view.
 */
export type ModelPurpose = "routing" | "extraction" | "media" | "transcription";

/** One request to a model provider, as its adapter reports it. */
export interface ModelCall {
  provider: "openai" | "jev";
  model: string;
  purpose: ModelPurpose;
  /** `answered`: a 2xx reply; `failed`: an error reply; `unanswered`: no reply at all. */
  outcome: "answered" | "failed" | "unanswered";
  inputTokens?: number;
  outputTokens?: number;
  /** A transcription's recording length, priced per minute when the reply reports no tokens. */
  audioSeconds?: number;
}

/** Records one provider call. Adapters call it once for every request they send. */
export type ModelMeter = (call: ModelCall) => void;

/** Two US dollars per UTC day (Afo, 2026-10-16). */
const DAILY_CAP_MICRO_USD = 2_000_000;

/** Whole micro-USD, so a cost is one exact division: $0.40 per million tokens is 400_000. */
interface Price {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  /** The provider's own per-minute estimate for transcriptions. */
  perMinute?: number;
}

/**
 * Standard-tier list prices of the models config.ts pins, read from
 * https://developers.openai.com/api/docs/pricing on 2026-10-16. Cached input is charged at the
 * full input price so the cap rounds up, never down. A model missing here is recorded without a
 * cost and cannot reach the cap, so pinning a new model means adding its price.
 */
const PRICES: Readonly<Record<string, Price>> = {
  "gpt-4.1-mini-2025-04-14": { inputPerMillionTokens: 400_000, outputPerMillionTokens: 1_600_000 },
  "gpt-4o-mini-transcribe-2025-12-15": {
    inputPerMillionTokens: 1_250_000,
    outputPerMillionTokens: 5_000_000,
    perMinute: 3_000,
  },
};

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function costMicroUsd(call: ModelCall): number | null {
  const price = PRICES[call.model];
  if (!price || call.outcome !== "answered") return null;
  if (call.inputTokens !== undefined || call.outputTokens !== undefined) {
    const priced =
      (call.inputTokens ?? 0) * price.inputPerMillionTokens +
      (call.outputTokens ?? 0) * price.outputPerMillionTokens;
    return Math.ceil(priced / 1_000_000);
  }
  if (call.audioSeconds !== undefined && price.perMinute !== undefined) {
    return Math.ceil((call.audioSeconds * price.perMinute) / 60);
  }
  return null;
}

function spentOn(core: ReportingCore, day: string): number {
  const row = core.db
    .query("SELECT COALESCE(SUM(cost_micro_usd), 0) AS spent FROM model_calls WHERE day = $day")
    .get({ day }) as { spent: number };
  return row.spent;
}

export function recordModelCall(core: ReportingCore, call: ModelCall): void {
  const now = core.clock.now();
  const day = utcDay(now);
  const cost = costMicroUsd(call);
  inTransaction(core.db, () => {
    const before = spentOn(core, day);
    core.db
      .query(
        `INSERT INTO model_calls
           (id, day, provider, model, purpose, outcome, input_tokens, output_tokens, cost_micro_usd, created_at)
         VALUES ($id, $day, $provider, $model, $purpose, $outcome, $input, $output, $cost, $now)`
      )
      .run({
        id: core.ids.id(),
        day,
        provider: call.provider,
        model: call.model,
        purpose: call.purpose,
        outcome: call.outcome,
        input: call.inputTokens ?? null,
        output: call.outputTokens ?? null,
        cost,
        now,
      });
    if (cost !== null && before < DAILY_CAP_MICRO_USD && before + cost >= DAILY_CAP_MICRO_USD) {
      log.warn(
        { day, spentMicroUsd: before + cost, capMicroUsd: DAILY_CAP_MICRO_USD },
        "Daily model spend cap reached; model processing is off until 00:00 UTC"
      );
    }
  });
}

/** A meter that writes each reported call to this reporting database. */
export function modelMeter(core: ReportingCore): ModelMeter {
  return (call) => recordModelCall(core, call);
}

export interface ModelSpend {
  day: string;
  spentMicroUsd: number;
  capMicroUsd: number;
  capReached: boolean;
  /** Calls today by `provider:purpose:outcome`; counts only, never content or identifiers. */
  calls: Record<string, number>;
}

export function modelSpend(core: ReportingCore): ModelSpend {
  const day = utcDay(core.clock.now());
  const spentMicroUsd = spentOn(core, day);
  const rows = core.db
    .query(
      `SELECT provider || ':' || purpose || ':' || outcome AS key, count(*) AS n FROM model_calls
       WHERE day = $day GROUP BY provider, purpose, outcome`
    )
    .all({ day }) as Array<{ key: string; n: number }>;
  return {
    day,
    spentMicroUsd,
    capMicroUsd: DAILY_CAP_MICRO_USD,
    capReached: spentMicroUsd >= DAILY_CAP_MICRO_USD,
    calls: Object.fromEntries(rows.map((row) => [row.key, row.n])),
  };
}

/** Model processing runs while its operator switch is on and today's spend is under the cap. */
export function modelProcessingOn(core: ReportingCore): boolean {
  return (
    readControl(core, "model_processing").enabled &&
    spentOn(core, utcDay(core.clock.now())) < DAILY_CAP_MICRO_USD
  );
}
