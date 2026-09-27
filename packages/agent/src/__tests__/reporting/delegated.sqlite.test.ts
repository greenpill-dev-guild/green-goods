import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { liveGrant } from "../../services/reporting/grants-store";
import { TestBrowser } from "./support/browser";
import { latestLink, reportUntilSummary } from "./support/flows";
import { AIYELOJA, TAS } from "./support/fixtures";
import { ADA, Harness, summaryToken } from "./support/harness";

/**
 * Delegated reporting with a Kernel permission, enabled only through test composition: a fixture
 * module entry, a fake signer and a fake chain that records installed permissions. It proves the
 * grant lifecycle and executor orchestration; module compatibility, custody and independent owner
 * revocation remain live gates, and production keeps delegation disabled.
 */
let harness: Harness;
const KERNEL = "0x00000000000000000000000000000000000000ca" as const;
const KERNEL_PROOF = "0x6b65726e656c" as const;

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

function one<T>(sql: string): T {
  return harness.core.db.query(sql).get() as T;
}

/** Confirms a report, links the Kernel account and consents to publish. */
async function confirmedKernelReport(): Promise<string[]> {
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
  const linking = new TestBrowser(harness.app);
  await linking.open(latestLink(harness));
  const proof = await linking.proveAs(KERNEL, KERNEL_PROOF);
  const consent = await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
  const token = /PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1];
  return harness.say(ADA, `PUBLISH ${token}`);
}

async function grantInBrowser(): Promise<TestBrowser> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  await browser.proveAs(KERNEL, KERNEL_PROOF);
  expect((await browser.access()).body.scope).toMatchObject({ purpose: "grant_reporting" });
  const proposed = await browser.request<{
    grant: {
      grantId: string;
      version: number;
      policyDigest: string;
      policy: Record<string, unknown>;
    };
  }>("POST", "/messaging/execution-grants");
  expect(proposed.status).toBe(201);
  expect(proposed.body.grant.policy).toMatchObject({ purpose: "reporting", maxSubmissions: 5 });
  // The owner installs the permission with their passkey; the chain now reports it installed.
  harness.chain.permissions.add(`${KERNEL}:${harness.permissionId}`);
  const approved = await browser.request(
    "POST",
    `/messaging/execution-grants/${proposed.body.grant.grantId}/approval`,
    {
      body: {
        expectedVersion: proposed.body.grant.version,
        policyDigest: proposed.body.grant.policyDigest,
        enableReference: `0x${"cd".repeat(32)}`,
      },
    }
  );
  expect(approved.status).toBe(200);
  return browser;
}

describe("Kernel reporting grant", () => {
  it("offers a bounded grant, verifies installation, then publishes the waiting report without another signature", async () => {
    const offer = await confirmedKernelReport();
    expect(offer[0]).toContain("up to 5 reports in 24 hours, reports only, revocable any time");
    await harness.press(ADA, "Allow reporting in chat");
    await grantInBrowser();
    await harness.drain();

    const texts = harness.transport.sent.map((sent) => sent.message.text);
    expect(texts.some((text) => text.startsWith("Reporting in chat is on for TAS"))).toBe(true);
    expect(texts.at(-1)).toMatch(/^Your report is published ✅/);
    expect(one("SELECT authorization_mode, state FROM execution_operations")).toEqual({
      authorization_mode: "delegated",
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
    await confirmedKernelReport();
    await harness.press(ADA, "Allow reporting in chat");
    harness.sender.failSigning = true;
    await grantInBrowser();
    await harness.drain();
    expect(one("SELECT submissions_reserved, submissions_consumed FROM execution_grants")).toEqual({
      submissions_reserved: 0,
      submissions_consumed: 0,
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
    expect(offer).toEqual([
      "Open this page to review and sign the exact publication with your passkey.",
    ]);
  });
});
