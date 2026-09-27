import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AIYELOJA, TAS } from "./support/fixtures";
import { ADA, Harness, summaryToken } from "./support/harness";

/**
 * Story-first reporting through the real coordinator, Shared rules and a temporary SQLite file,
 * driven over Hono. Fixture catalog and transport prove orchestration, not provider behavior.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

async function consented(): Promise<string[]> {
  const notice = await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
  expect(notice).toHaveLength(1);
  expect(notice[0]).toContain("Do you agree?");
  return harness.press(ADA, "I agree");
}

describe("story-first reporting", () => {
  it("quarantines a first message until consent, then resumes it as the story", async () => {
    const notice = await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    expect(notice[0]).toContain("Do you agree?");
    const db = harness.core.db;
    expect(db.query("SELECT state FROM inbox_events WHERE kind = 'message'").all()).toEqual([
      { state: "quarantined" },
    ]);
    expect(db.query("SELECT count(*) AS n FROM source_entries").get()).toEqual({ n: 0 });
    expect(db.query("SELECT count(*) AS n FROM participants").get()).toEqual({ n: 0 });

    const afterConsent = await harness.press(ADA, "I agree");
    expect(afterConsent[0]).toContain("Thank you!");
    expect(afterConsent[1]).toBe(
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden"
    );
    expect(db.query("SELECT revision, lifecycle FROM work_drafts").get()).toEqual({
      revision: 1,
      lifecycle: "open",
    });
  });

  it("pages the garden question when more gardens accept reports than fit in one message", async () => {
    harness.close();
    const others = Array.from({ length: 10 }, (_, index) => ({
      key: `garden-${index + 1}`,
      chainId: 42161,
      address: `0x${(index + 16).toString(16).padStart(40, "0")}` as const,
      label: `Garden ${index + 1}`,
    }));
    harness = new Harness({ gardens: [...others, TAS, AIYELOJA] });
    const first = (await consented())[1];
    expect(first).toContain("10. Garden 10");
    expect(first).not.toContain("TAS");
    const next = await harness.press(ADA, "More options");
    expect(next[0]).toBe("Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden");
    expect((await harness.press(ADA, "TAS"))[0]).toContain("Which activity in TAS");
  });

  it("collects every required field, validates answers against the Action and confirms a bound revision", async () => {
    await consented();
    expect(await harness.say(ADA, "1")).toEqual([
      "Which activity in TAS best matches your work?\n1. Tree planting\n2. Weeding",
    ]);
    expect((await harness.press(ADA, "Tree planting"))[0]).toBe(
      "Seedlings planted? Please reply with a number (seedlings)."
    );
    expect(await harness.say(ADA, "twelve")).toEqual([
      "Please reply with a number, for example 12.",
    ]);
    expect(await harness.say(ADA, "10 bags")).toEqual([
      "This is counted in seedlings, but you wrote bags. Could you give it in seedlings?",
    ]);
    expect((await harness.say(ADA, "12 seedlings"))[0]).toContain("Main species?");
    expect(await harness.say(ADA, "2")).toEqual([
      "How much time did you spend on this work? For example: 2 hours or 45 minutes.",
    ]);
    expect((await harness.say(ADA, "3"))[0]).toBe(
      "Was that 3 hours or 3 minutes?\n1. Hours\n2. Minutes"
    );
    const summary = await harness.press(ADA, "Hours");
    expect(summary[0]).toContain("• Activity: Tree planting");
    expect(summary[0]).toContain("• Time spent: 3 h");
    expect(summary[0]).toContain("• Seedlings planted: 12 seedlings");
    expect(summary[0]).toContain("• Main species: Baobab");
    expect(summary[0]).toContain("cannot be deleted");

    expect(await harness.say(ADA, "CONFIRM 9999")).toEqual([
      `To publish, reply CONFIRM ${summaryToken(summary)} exactly as shown in the summary.`,
    ]);
    const linking = await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(linking).toEqual([
      "To publish, verify your existing Green Goods account (wallet or passkey) here. The link expires in 10 minutes and never moves funds.",
      "When the page shows a code, send it here as: PAIR 123456",
    ]);

    const draft = harness.core.db
      .query("SELECT id, revision, machine_snapshot FROM work_drafts")
      .get() as { id: string; revision: number; machine_snapshot: string };
    expect(JSON.parse(draft.machine_snapshot).value).toBe("authority");
    const confirmation = harness.core.db
      .query(
        "SELECT revision, account_binding_id, publication_consent_id, invalidated_at FROM confirmations"
      )
      .get();
    // Unlinked gardeners confirm content first; publication consent waits for account pairing.
    expect(confirmation).toEqual({
      revision: draft.revision,
      account_binding_id: null,
      publication_consent_id: null,
      invalidated_at: null,
    });
    expect(harness.core.db.query("SELECT kind, state FROM processing_jobs").all()).toEqual([
      { kind: "resolve_authority", state: "succeeded" },
    ]);
  });

  it("keeps each answer's provenance tied to the exact source message", async () => {
    await consented();
    await harness.say(ADA, "1");
    await harness.press(ADA, "Tree planting");
    await harness.say(ADA, "12");
    const revision = harness.core.db
      .query(
        "SELECT r.content_ciphertext, r.draft_id, r.revision FROM draft_revisions r ORDER BY revision DESC LIMIT 1"
      )
      .get() as { content_ciphertext: string; draft_id: string; revision: number };
    const content = JSON.parse(
      harness.core.keyring.open(
        revision.content_ciphertext,
        `draft_revisions.content:${revision.draft_id}:${revision.revision}`
      )
    );
    const source = harness.core.db
      .query(
        "SELECT s.id FROM source_entries s JOIN inbox_events e ON e.id = s.inbox_event_id WHERE e.event_id = 'evt-5'"
      )
      .get() as { id: string };
    expect(content.provenance["details.seedlings"]).toEqual({
      kind: "reported",
      origin: "gardener",
      sources: [{ sourceEntryId: source.id }],
      original: "12",
      originalUnit: "seedlings",
      gardenerStated: true,
    });
    expect(content.feedback).toBe("Today I planted twelve baobab seedlings by the fence");
  });

  it("delivers a repeated provider event once and never duplicates its source entry", async () => {
    await consented();
    const event = harness.message(ADA, { text: "1" });
    expect((await harness.post(event)).status).toBe(202);
    const duplicate = await harness.post(event);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ status: "duplicate" });
    await harness.drain();
    const count = harness.core.db
      .query(
        "SELECT count(*) AS n FROM source_entries s JOIN inbox_events e ON e.id = s.inbox_event_id WHERE e.event_id = $id"
      )
      .get({ id: event.eventId }) as { n: number };
    expect(count.n).toBe(1);
  });
});
