import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import type { JobKind } from "../../services/reporting/jobs";
import type { PrivateMediaStore } from "../../services/reporting/media-store";
import { operationById } from "../../services/reporting/operations";
import { purgePrivateContent } from "../../services/reporting/retention";
import { drain, type ReportingWorkerDeps } from "../../services/reporting/worker";
import { TestBrowser } from "./support/browser";
import { adaAccount, latestLink } from "./support/flows";
import { TAS } from "./support/fixtures";
import { ADA, Harness, summaryToken } from "./support/harness";
import { scriptedOpenAI } from "./support/media";

/**
 * What a job may repeat when the process dies part way through it. The worker reruns any job whose
 * lease expired, so every kind has to survive a crash at any point; this table says how, and the
 * compiler requires an entry for every new kind.
 *
 * - `reads`: only reads and writes guarded by current state or a dedupe key; a rerun repeats nothing
 *   outside the Agent.
 * - `checkpointed`: each external effect is recorded before the next one starts; a rerun repeats at
 *   most the effect a crash cut off before its record, which must be harmless to repeat.
 * - `exact_bytes`: signed bytes are recorded before anything is sent; a rerun resends those same
 *   bytes and never signs again (delegated.sqlite.test.ts: a lost bundler response and a restart
 *   between signing and sending).
 * - `cleanup`: deletes, which a rerun repeats harmlessly before recording what is gone.
 *
 * The crash cases below let an effect happen, then freeze the process before it records the
 * result, restart on the same database and let the leases expire, as a deploy or an out-of-memory
 * kill would. Replies are not a job, but their send gets the same treatment.
 */
const RERUN = {
  process_media: "checkpointed",
  resolve_authority: "reads",
  prepare_operation: "checkpointed",
  execute_delegated: "exact_bytes",
  watch_owner_attempt: "reads",
  review_list: "reads",
  review_open: "reads",
  review_authority: "reads",
  reconcile_operation: "reads",
  reconcile_grant: "reads",
  purge_private_content: "cleanup",
  retention_sweep: "cleanup",
} as const satisfies Record<JobKind, "reads" | "checkpointed" | "exact_bytes" | "cleanup">;

let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

function one<T>(sql: string, params: Record<string, string> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

/**
 * Makes the `nth` call of `method` perform its real effect and then never settle: the process dies
 * right after the effect, before it can record the result. Resolves at that moment; the method is
 * restored for the process that runs next.
 */
function dieAfter<T extends object>(port: T, method: keyof T & string, nth = 1): Promise<void> {
  const target = port as Record<string, unknown>;
  const real = (target[method] as (...args: unknown[]) => Promise<unknown>).bind(port);
  let calls = 0;
  return new Promise((died) => {
    target[method] = async (...args: unknown[]) => {
      const result = await real(...args);
      calls += 1;
      if (calls !== nth) return result;
      target[method] = real;
      died();
      return new Promise(() => undefined);
    };
  });
}

/** Runs the queues into the frozen effect, then restarts and lets every lease and stall expire. */
async function crash(died: Promise<void>, deps: ReportingWorkerDeps = harness.deps()) {
  void drain(deps);
  await died;
  harness.restart();
  harness.clock.advance(5 * 60 * 1000 + 1);
}

async function photo(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2d6a4f" } })
      .jpeg()
      .toBuffer()
  );
}

/** A planting report with one photo, up to the open seedlings question. */
async function plantingWithPhoto(): Promise<void> {
  await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
  await harness.press(ADA, "I agree");
  await harness.say(ADA, "1");
  await harness.press(ADA, "Tree planting");
  harness.mediaFiles.set("photo-1", await photo());
  await harness.say(ADA, "", {
    text: undefined,
    media: [{ providerMediaId: "photo-1", declaredMime: "image/jpeg" }],
  });
}

function draft() {
  const { id } = one<{ id: string }>("SELECT id FROM work_drafts");
  return loadDraft(harness.core, id);
}

describe("rerun after a crash", () => {
  it("rereads a file with the model but downloads it once and applies what it read once", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "1");
    await harness.press(ADA, "Tree planting");
    const read = {
      observations: ["Seedlings in a row along a fence"],
      uncertain: [],
      facts: [
        {
          field: "details.seedlings",
          value: 12,
          page: null,
          cell: null,
          sumRange: null,
          original: null,
          unit: "seedlings",
        },
      ],
    };
    const openai = scriptedOpenAI([read, read]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "rerun" });
    harness.mediaFiles.set("photo-1", await photo());
    let downloads = 0;
    const files = harness.mediaFiles;
    const get = files.get.bind(files);
    files.get = (key) => {
      downloads += 1;
      return get(key);
    };
    await harness.post(
      harness.message(ADA, {
        text: undefined,
        media: [{ providerMediaId: "photo-1", declaredMime: "image/jpeg" }],
      })
    );

    await crash(dieAfter(openai.config, "fetch"));
    await harness.drain();

    // The model call a crash cut off is asked again; the download and the photo are reused.
    expect(openai.requests).toHaveLength(2);
    expect(downloads).toBe(1);
    expect(one("SELECT state FROM media_assets")).toEqual({ state: "ready" });
    const content = draft()?.content;
    expect(content?.details.seedlings).toBe(12);
    expect(content?.provenance["details.seedlings"]?.sources).toHaveLength(1);
    expect(content?.evidence).toHaveLength(1);
  });

  it("uploads each piece of public evidence once, repeating only the upload a crash cut off", async () => {
    harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
    await plantingWithPhoto();
    await harness.say(ADA, "12");
    await harness.say(ADA, "2");
    const summary = await harness.say(ADA, "3 hours");
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    const linking = new TestBrowser(harness.app);
    await linking.open(latestLink(harness));
    const proof = await linking.prove(adaAccount);
    const consent = await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
    const token = /PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1];
    await harness.post(harness.message(ADA, { text: `PUBLISH ${token}` }));

    // The photo's upload is recorded; the process dies after uploading the metadata.
    await crash(dieAfter(harness.uploader, "upload", 2));
    await harness.drain();

    const names = harness.uploader.uploads.map((upload) => upload.name);
    expect(names.filter((name) => name !== "metadata.json")).toHaveLength(1);
    const metadata = harness.uploader.uploads.filter((upload) => upload.name === "metadata.json");
    expect(metadata).toHaveLength(2);
    // The envelope names the rerun's document. Today the first copy differs by its submittedAt
    // (the preparation clock), so it stays pinned with nothing referencing it.
    const { id } = one<{ id: string }>("SELECT id FROM execution_operations");
    const operation = operationById(harness.core, id);
    const envelope = operation?.envelope;
    expect(operation?.state).toBe("prepared");
    expect(envelope?.kind === "work" ? envelope.fields.metadata : null).toBe(metadata.at(-1)?.cid);
  });

  it("finishes a purge that a crash cut off between deleting a file and recording it", async () => {
    await plantingWithPhoto();
    const before = one<{ private_object_ciphertext: string | null }>(
      "SELECT private_object_ciphertext FROM media_assets"
    );
    expect(before.private_object_ciphertext).not.toBeNull();
    const media = harness.media();
    const died = dieAfter(media, "delete");
    await harness.post(harness.message(ADA, { text: "DELETE" }));
    await crash(died, {
      ...harness.deps(),
      jobs: {
        ...harness.deps().jobs,
        purge_private_content: (job) =>
          purgePrivateContent({ core: harness.core, media: media as PrivateMediaStore }, job),
      },
    });
    await harness.drain();

    expect(
      one("SELECT state, private_object_ciphertext, sanitized_object_ciphertext FROM media_assets")
    ).toEqual({
      state: "deleted",
      private_object_ciphertext: null,
      sanitized_object_ciphertext: null,
    });
    expect(one("SELECT count(*) AS n FROM work_drafts WHERE content_deleted_at IS NULL")).toEqual({
      n: 0,
    });
    expect(one("SELECT state FROM processing_jobs WHERE kind = 'purge_private_content'")).toEqual({
      state: "succeeded",
    });
  });

  it("sends a reply a crash cut off again under the same idempotency key, from one outbox row", async () => {
    await harness.post(harness.message(ADA, { text: "Hello" }));
    await crash(dieAfter(harness.transport, "send"));
    await harness.drain();

    const [first, second] = harness.transport.sent;
    expect(harness.transport.sent).toHaveLength(2);
    expect(second?.message.text).toBe(first?.message.text);
    expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
    expect(one("SELECT count(*) AS n, state FROM delivery_outbox")).toEqual({
      n: 1,
      state: "accepted",
    });
  });

  it("declares a rerun contract for every job the worker runs", () => {
    // Agent CI typechecks source only, so this is what holds a new job kind to the table.
    expect(Object.keys(RERUN).sort()).toEqual(Object.keys(harness.deps().jobs).sort());
  });
});
