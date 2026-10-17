import { createLogger } from "../logger";
import { readControl } from "./controls";
import { inTransaction } from "./database";
import { InterpretationUnavailableError } from "./interpretation";
import type { ReportingCore } from "./runtime";

const log = createLogger("reporting");

/**
 * The model spend ledger and its daily cap (technical brief §11.3). Every provider request is
 * recorded before it leaves, holding a reservation: the most it can plausibly bill. When the reply
 * states its bill, that replaces the reservation; an error reply bills nothing. A request whose
 * process dies before it settles stays recorded as unanswered and keeps its reservation, so a crash
 * loop cannot spend past the cap unseen. Rows carry no message content and no participant,
 * conversation or account identifier.
 *
 * Once a UTC day's recorded cost reaches the cap, model processing stops exactly as if its operator
 * switch were off: chat turns ask plain questions, files are kept unread and voice notes are
 * declined, until 00:00 UTC. The meter enforces the cap itself, in the transaction that would
 * record each request, so requests started together, such as a turn's routing and extraction,
 * cannot all pass a check made before either was recorded.
 */
export type ModelPurpose = "routing" | "extraction" | "media" | "transcription";

/** What a request bills: the provider's stated usage, or an estimate of it. */
export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  /** A transcription's recording length, priced per minute. */
  audioSeconds?: number;
}

/** One request, recorded before it is sent. */
export interface ModelRequest {
  provider: "openai" | "jev";
  model: string;
  purpose: ModelPurpose;
  /** The most the request can plausibly bill; it counts until the reply states the bill. */
  reserve: ModelUsage;
}

/** `answered`: a 2xx reply; `failed`: an error reply; `unanswered`: no reply at all. */
export type ModelSettlement =
  | { outcome: "answered"; usage?: ModelUsage }
  | { outcome: "failed" }
  | { outcome: "unanswered" };

/**
 * Records a request before it is sent and returns how to settle it. Adapters call it once per
 * request and settle once, with what the reply said. Once the day's recorded cost has reached the
 * cap it records nothing and throws InterpretationUnavailableError("disabled"), the error adapters
 * already report, so the request is never sent.
 */
export type ModelMeter = (request: ModelRequest) => (settlement: ModelSettlement) => void;

/**
 * The most tokens a text can become: every common tokenizer spends at least one UTF-8 byte on
 * each token, so the byte count bounds it whatever the script, where four characters a token
 * undercounts emoji and non-Latin text. Reservations use it so a crash cannot hide spend.
 */
export function tokenCeiling(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Two US dollars per UTC day (Afo, 2026-10-16). */
const DAILY_CAP_MICRO_USD = 2_000_000;

/** Whole micro-USD, so a cost is one exact division: $0.40 per million tokens is 400_000. */
interface Price {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  /** The provider's own per-minute estimate for transcriptions. */
  perMinute?: number;
  /** The context window: no request can bill more input than this. */
  maxInputTokens?: number;
  /** Tokens each 32-pixel patch of an input image costs. */
  tokensPerImagePatch?: number;
}

/**
 * List prices of the models config.ts pins, read on 2026-10-16: OpenAI's Standard tier from
 * https://developers.openai.com/api/docs/pricing, and Jev from https://docs.typesafe.ai/models,
 * which bills input tokens only. Cached input is charged at the full input price so the cap rounds
 * up, never down. The context window and image rule come from
 * https://developers.openai.com/api/docs/models/gpt-4.1-mini and
 * https://developers.openai.com/api/docs/guides/images-vision, read on 2026-10-17. A model missing
 * here is recorded without a cost and cannot reach the cap, so pinning a new model means adding
 * its price.
 */
const PRICES: Readonly<Record<string, Price>> = {
  "gpt-4.1-mini-2025-04-14": {
    inputPerMillionTokens: 400_000,
    outputPerMillionTokens: 1_600_000,
    maxInputTokens: 1_047_576,
    tokensPerImagePatch: 1.62,
  },
  "gpt-4o-mini-transcribe-2025-12-15": {
    inputPerMillionTokens: 1_250_000,
    outputPerMillionTokens: 5_000_000,
    perMinute: 3_000,
  },
  "jev-1.13.0": { inputPerMillionTokens: 42_000, outputPerMillionTokens: 0 },
};

/**
 * The most input one image of at most `edge` pixels a side can bill: its whole 32-pixel patches at
 * the model's rate, plus the one token of rounding the provider's guide allows. Null for a model
 * whose image rule is not recorded.
 */
export function imageTokenCeiling(model: string, edge: number): number | null {
  const perPatch = PRICES[model]?.tokensPerImagePatch;
  return perPatch === undefined ? null : Math.ceil(Math.ceil(edge / 32) ** 2 * perPatch) + 1;
}

/** The most input any one request can bill: the model's context window, or null when unknown. */
export function inputTokenCeiling(model: string): number | null {
  return PRICES[model]?.maxInputTokens ?? null;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function costMicroUsd(model: string, usage: ModelUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  if (usage.inputTokens !== undefined || usage.outputTokens !== undefined) {
    const priced =
      (usage.inputTokens ?? 0) * price.inputPerMillionTokens +
      (usage.outputTokens ?? 0) * price.outputPerMillionTokens;
    return Math.ceil(priced / 1_000_000);
  }
  if (usage.audioSeconds !== undefined && price.perMinute !== undefined) {
    return Math.ceil((usage.audioSeconds * price.perMinute) / 60);
  }
  return null;
}

function spentOn(core: ReportingCore, day: string): number {
  const row = core.db
    .query("SELECT COALESCE(SUM(cost_micro_usd), 0) AS spent FROM model_calls WHERE day = $day")
    .get({ day }) as { spent: number };
  return row.spent;
}

/**
 * Runs one ledger write and logs the moment it carries the day across the cap. The write sees the
 * day's recorded cost as read in its own transaction, so no other write can change it first.
 */
function writeAndWatch(core: ReportingCore, day: string, write: (spent: number) => void): void {
  inTransaction(core.db, () => {
    const before = spentOn(core, day);
    write(before);
    const after = spentOn(core, day);
    if (before < DAILY_CAP_MICRO_USD && after >= DAILY_CAP_MICRO_USD) {
      log.warn(
        { day, spentMicroUsd: after, capMicroUsd: DAILY_CAP_MICRO_USD },
        "Daily model spend cap reached; model processing is off until 00:00 UTC"
      );
    }
  });
}

/** A meter that writes each request to this reporting database before it is sent. */
export function modelMeter(core: ReportingCore): ModelMeter {
  return (request) => {
    const id = core.ids.id();
    const now = core.clock.now();
    const day = utcDay(now);
    const reserved = costMicroUsd(request.model, request.reserve);
    writeAndWatch(core, day, (spent) => {
      // Model processing is off for the rest of the day: refused before anything is recorded.
      if (spent >= DAILY_CAP_MICRO_USD) throw new InterpretationUnavailableError("disabled");
      core.db
        .query(
          `INSERT INTO model_calls
             (id, day, provider, model, purpose, outcome, input_tokens, output_tokens, cost_micro_usd, created_at)
           VALUES ($id, $day, $provider, $model, $purpose, 'unanswered', NULL, NULL, $cost, $now)`
        )
        .run({
          id,
          day,
          provider: request.provider,
          model: request.model,
          purpose: request.purpose,
          cost: reserved,
          now,
        });
    });
    return (settlement) => {
      const usage = settlement.outcome === "answered" ? settlement.usage : undefined;
      // A stated bill replaces the reservation; an error reply bills nothing; otherwise the
      // reservation stands, because a reply without usage or a timeout may still have been billed.
      const cost =
        settlement.outcome === "failed"
          ? null
          : usage
            ? costMicroUsd(request.model, usage)
            : reserved;
      writeAndWatch(core, day, () =>
        core.db
          .query(
            `UPDATE model_calls SET outcome = $outcome, input_tokens = $input, output_tokens = $output,
               cost_micro_usd = $cost WHERE id = $id`
          )
          .run({
            id,
            outcome: settlement.outcome,
            input: usage?.inputTokens ?? null,
            output: usage?.outputTokens ?? null,
            cost,
          })
      );
    };
  };
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
