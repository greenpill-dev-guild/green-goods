import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { liveGrant } from "../../services/reporting/grants-store";
import { operationById } from "../../services/reporting/operations";
import {
  grantInBrowser as activateGrant,
  confirmedKernelReport as confirmKernel,
} from "./support/activation";
import { TestBrowser } from "./support/browser";
import { reportUntilSummary } from "./support/flows";
import { AIYELOJA, planting, snapshot, TAS } from "./support/fixtures";
import { ADA, Harness, summaryToken } from "./support/harness";

/**
 * Delegated reporting with a Kernel permission, enabled only through test composition: a fixture
 * module entry, a fake signer and a fake chain that records installed permissions. It proves the
 * grant lifecycle and executor orchestration; module compatibility, custody and independent owner
 * revocation remain live gates, and production keeps delegation disabled.
 */
let harness: Harness;
const KERNEL = "0x00000000000000000000000000000000000000ca" as const;

beforeEach(() => {
  harness = new Harness();
  harness.chain.kernels.add(KERNEL);
  harness.chain.grantRole(TAS.address, KERNEL, { gardener: true });
  harness.delegationModules.push({
    moduleRef: "kernel-0.3.1-permission-v0.0.4",
    chainId: 42161,
    validatorAddress: "0x0000000000000000000000000000000000007a11",
    validatorCodeHash: `0x${"ab".repeat(32)}`,
  });
});

afterEach(() => {
  harness.close();
});

function one<T>(sql: string, params: Record<string, string> = {}): T {
  return harness.core.db.query(sql).get(params) as T;
}

/** Confirms a report, links the Kernel account and consents to publish. */
async function confirmedKernelReport(): Promise<string[]> {
  return confirmKernel(harness);
}

async function grantInBrowser(): Promise<TestBrowser> {
  return activateGrant(harness);
}

async function establishGrant() {
  await confirmedKernelReport();
  await harness.press(ADA, "Allow reporting in chat");
  await grantInBrowser();
}

async function nextReport() {
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
}

describe("Kernel reporting grant", () => {
  it("keeps signed bytes reserved across a paused restart and submits them only after resuming", async () => {
    await establishGrant();
    const sign = harness.sender.sign.bind(harness.sender);
    harness.sender.sign = async (...args) => {
      const signed = await sign(...args);
      setControl(harness.core, "publication", false, {
        actor: "operator",
        reason: "pause after signing",
      });
      return signed;
    };
    await nextReport();
    await harness.drain();
    expect(harness.sender.signed).toBe(2);
    expect(harness.sender.submitted).toBe(1);
    expect(one("SELECT state FROM execution_attempts ORDER BY rowid DESC LIMIT 1")).toEqual({
      state: "signed",
    });
    harness.restart();
    harness.clock.advance(5 * 60_000);
    await harness.drain();
    expect(harness.sender.submitted).toBe(1);
    setControl(harness.core, "publication", true, {
      actor: "operator",
      reason: "resume signed attempt",
    });
    harness.clock.advance(5 * 60_000);
    await harness.drain();
    expect(harness.sender.signed).toBe(2);
    expect(harness.sender.submitted).toBe(2);
  });

  it("rechecks publication after awaited role reads immediately before submitting signed bytes", async () => {
    await establishGrant();
    const roles = harness.chain.gardenRoles.bind(harness.chain);
    harness.chain.gardenRoles = async (...args) => {
      const value = await roles(...args);
      if (harness.sender.signed > 1)
        setControl(harness.core, "publication", false, {
          actor: "operator",
          reason: "pause during send preflight",
        });
      return value;
    };
    await nextReport();
    await harness.drain();
    expect(harness.sender.signed).toBe(2);
    expect(harness.sender.submitted).toBe(1);
    expect(one("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 1,
      submissions_consumed: 1,
    });
  });
  it("blocks a signed operation when account recovery advances identity during awaited preflight", async () => {
    await establishGrant();
    const roles = harness.chain.gardenRoles.bind(harness.chain);
    harness.chain.gardenRoles = async (...args) => {
      const value = await roles(...args);
      if (harness.sender.signed > 1)
        harness.core.db.query("UPDATE participants SET identity_epoch = identity_epoch + 1").run();
      return value;
    };
    await nextReport();
    await harness.drain();
    expect(harness.sender.signed).toBe(2);
    expect(harness.sender.submitted).toBe(1);
    expect(one("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 1,
      submissions_consumed: 1,
    });
  });
  it("expires setup during a permission read instead of announcing an active grant", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    const permission = harness.chain.permissionInstalled.bind(harness.chain);
    harness.chain.permissionInstalled = async (...args) => {
      const installed = await permission(...args);
      harness.clock.advance(24 * 60 * 60_000);
      return installed;
    };
    const browser = await grantInBrowser();
    await harness.drain();
    const grant = one<{ id: string; state: string }>("SELECT id, state FROM execution_grants");
    expect(grant.state).toBe("expired");
    // Session lifetime has also elapsed; the persisted lifecycle remains inspectable independently.
    expect((await browser.request("GET", `/messaging/execution-grants/${grant.id}`)).status).toBe(
      401
    );
    expect(harness.sender.signed).toBe(1);
    expect(
      harness.transport.sent.some((sent) => sent.message.text.startsWith("Reporting in chat is on"))
    ).toBe(false);
  });

  it("publishes the first owner-approved report and activates its bounded grant without resubmitting it", async () => {
    const offer = await confirmedKernelReport();
    expect(offer[0]).toContain("up to 5 reports in 24 hours, reports only, revocable any time");
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();

    const texts = harness.transport.sent.map((sent) => sent.message.text);
    expect(texts.some((text) => text.startsWith("Reporting in chat is on for TAS"))).toBe(true);
    expect(texts.some((text) => /^Your report is published ✅/.test(text))).toBe(true);
    expect(one("SELECT authorization_mode, state FROM execution_operations")).toEqual({
      authorization_mode: "owner",
      state: "published",
    });
    expect(one("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 0,
      submissions_consumed: 1,
    });
    expect(one("SELECT attester FROM work_records")).toEqual({ attester: KERNEL });
  });

  it("publishes the next confirmed report from chat alone while the grant is usable", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();
    const sentBefore = harness.transport.sent.length;

    const summary = await reportUntilSummary(harness);
    const replies = await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(replies.some((text) => text.includes("Open this page"))).toBe(false);
    expect(harness.transport.sent.slice(sentBefore).at(-1)?.message.text).toMatch(
      /^Your report is published ✅/
    );
    expect(one("SELECT submissions_consumed FROM execution_grants")).toEqual({
      submissions_consumed: 2,
    });
  });

  it("stops delegated execution once the owner pauses the grant", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    const browser = await grantInBrowser();
    await harness.drain();
    const grant = one<{ id: string }>("SELECT id FROM execution_grants");
    expect(
      (await browser.request("POST", `/messaging/execution-grants/${grant.id}/pause`)).status
    ).toBe(200);

    const summary = await reportUntilSummary(harness);
    const replies = await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    // Paused grants are not used; the choice is offered again and nothing is signed for the owner.
    expect(replies.join("\n")).toContain("Publish this report only");
    expect(harness.sender.signed).toBe(1);
  });

  it("releases the reservation and returns the report when signing fails before anything is sent", async () => {
    await establishGrant();
    harness.sender.failSigning = true;
    await nextReport();
    await harness.drain();
    expect(one("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 0,
      submissions_consumed: 1,
    });
    expect(harness.transport.sent.at(-1)?.message.text).toContain("CONFIRM");
  });

  it("reconciles a lost bundler response without signing again", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    harness.sender.loseSubmitResponse = true;
    await grantInBrowser();
    await harness.drain();
    expect(harness.sender.signed).toBe(1);
    expect(one("SELECT state FROM execution_operations")).toEqual({ state: "published" });
  });

  it("never lets a reporting grant stand in for a review or another garden", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();
    const { account_binding_id: accountBindingId } = one<{ account_binding_id: string }>(
      "SELECT account_binding_id FROM execution_grants"
    );
    const scope = { accountBindingId, chainId: 42161 };
    expect(
      liveGrant(harness.core, { ...scope, purpose: "reporting", gardenAddress: TAS.address })
    ).not.toBeNull();
    expect(
      liveGrant(harness.core, { ...scope, purpose: "review", gardenAddress: TAS.address })
    ).toBeNull();
    expect(
      liveGrant(harness.core, { ...scope, purpose: "reporting", gardenAddress: AIYELOJA.address })
    ).toBeNull();
  });

  /** Runs `between` when the executor checks roles, after preparation and before any signature. */
  function betweenPreparationAndSending(between: () => void): void {
    const roles = harness.chain.gardenRoles.bind(harness.chain);
    harness.chain.gardenRoles = async (...args: Parameters<typeof roles>) => {
      const latest = one<{ state: string }>(
        "SELECT state FROM execution_operations ORDER BY rowid DESC LIMIT 1"
      );
      if (latest.state === "prepared") {
        harness.chain.gardenRoles = roles;
        between();
      }
      return roles(...args);
    };
  }

  it("holds a prepared delegated report while publishing is paused, then sends it", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();
    const signedBefore = harness.sender.signed;

    const summary = await reportUntilSummary(harness);
    betweenPreparationAndSending(() =>
      setControl(harness.core, "publication", false, { actor: "operator", reason: "test pause" })
    );
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(harness.sender.signed).toBe(signedBefore);
    expect(one("SELECT state FROM execution_operations ORDER BY rowid DESC LIMIT 1")).toEqual({
      state: "prepared",
    });
    expect(
      one(
        "SELECT state, last_error_code FROM processing_jobs WHERE kind = 'execute_delegated' ORDER BY rowid DESC LIMIT 1"
      )
    ).toEqual({ state: "pending", last_error_code: "publication_paused" });

    setControl(harness.core, "publication", true, { actor: "operator", reason: "resume" });
    harness.clock.advance(5 * 60_000);
    await harness.drain();
    expect(harness.sender.signed).toBe(signedBefore + 1);
    expect(harness.transport.sent.at(-1)?.message.text).toMatch(/^Your report is published ✅/);
  });

  it("sends the confirmed Action snapshot when instructions change before sending", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();

    const summary = await reportUntilSummary(harness);
    let confirmed: string | undefined;
    // The registry publishes new instructions after preparation, before the executor signs.
    betweenPreparationAndSending(() => {
      const { draft_id: draftId } = one<{ draft_id: string }>(
        "SELECT draft_id FROM execution_operations ORDER BY rowid DESC LIMIT 1"
      );
      confirmed = loadDraft(harness.core, draftId)?.snapshot?.digest;
      harness.catalog.actions.set(TAS.key, [
        snapshot(planting({ title: "Tree planting v2" }), "bafy-v2", 200n),
      ]);
    });
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    const operation = one<{ id: string; state: string }>(
      "SELECT id, state FROM execution_operations ORDER BY rowid DESC LIMIT 1"
    );
    expect(operation.state).toBe("published");
    expect(confirmed).toBeDefined();
    const envelope = operationById(harness.core, operation.id)?.envelope;
    expect(envelope?.kind === "work" ? envelope.actionDefinitionDigest : null).toBe(confirmed);
    expect(
      one("SELECT count(*) AS n FROM execution_attempts WHERE operation_id = $id", {
        id: operation.id,
      })
    ).toEqual({ n: 1 });
  });

  it("returns the report to its owner when the grant expires before it is sent", async () => {
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();
    const signedBefore = harness.sender.signed;

    const summary = await reportUntilSummary(harness);
    betweenPreparationAndSending(() => harness.clock.advance(25 * 60 * 60 * 1000));
    const replies = await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    expect(harness.sender.signed).toBe(signedBefore);
    expect(
      one("SELECT state, failure_code FROM execution_operations ORDER BY rowid DESC LIMIT 1")
    ).toEqual({ state: "failed", failure_code: "delegated_expired" });
    const text = replies.join("\n");
    expect(text).toContain("I can't publish this one from chat");
    expect(text).toMatch(/CONFIRM \d{4}/);
  });

  it("refuses grant proposals when no verified module is configured", async () => {
    harness.delegationModules.length = 0;
    const offer = await confirmedKernelReport();
    // Without delegation the Kernel owner signs this report once, as an EOA would.
    expect(offer[0]).toContain(
      "Open this page to review and sign the exact publication with your passkey."
    );
  });
});
