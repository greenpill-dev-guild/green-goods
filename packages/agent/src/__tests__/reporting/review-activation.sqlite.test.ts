import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TestBrowser } from "./support/browser";
import {
  confirmLinkAndPublish,
  latestLink,
  openSigningPage,
  reportOutcome,
  reserve,
} from "./support/flows";
import { TAS } from "./support/fixtures";
import { BOLA, Harness, summaryToken } from "./support/harness";
import { KERNEL, KERNEL_PROOF, prepareActivation } from "./support/activation";

let harness: Harness;
beforeEach(() => {
  harness = new Harness();
});
afterEach(() => harness.close());

async function confirmedKernelReview() {
  await confirmLinkAndPublish(harness);
  const { browser, view, envelope } = await openSigningPage(harness);
  const attempt = await reserve(browser, view, envelope);
  const transactionHash = harness.chain.submit({
    attester: envelope.accountAddress,
    to: envelope.call.to,
    data: envelope.call.data,
  });
  await reportOutcome(browser, view, envelope, attempt.body.attemptId, {
    kind: "broadcast",
    transactionHash,
  });
  await harness.drain();
  harness.chain.kernels.add(KERNEL);
  harness.chain.grantRole(TAS.address, KERNEL, { operator: true });
  harness.delegationModules.push({
    moduleRef: "kernel-0.3.1-permission-v0.0.4",
    chainId: 42161,
    validatorAddress: "0x0000000000000000000000000000000000007a11",
    validatorCodeHash: `0x${"ab".repeat(32)}`,
  });
  await harness.say(BOLA, "REVIEW");
  await harness.press(BOLA, "I agree");
  const linking = new TestBrowser(harness.app);
  await linking.open(latestLink(harness));
  const proof = await linking.proveAs(KERNEL, KERNEL_PROOF);
  await harness.say(BOLA, `PAIR ${proof.body.pairingCode}`);
  await confirmNextReview();
  return envelope;
}

async function confirmNextReview() {
  await harness.say(BOLA, "REVIEW");
  await harness.say(BOLA, "1");
  await harness.press(BOLA, "Approve");
  await harness.press(BOLA, "High");
  const summary = await harness.say(BOLA, "Visible work independently verified");
  return harness.say(BOLA, `CONFIRM ${summaryToken(summary)}`);
}

async function sendFirstReview() {
  const p = await prepareActivation(harness);
  expect(p.grant.policy.purpose).toBe("review");
  expect(p.operation.envelope?.kind).toBe("review");
  expect(
    (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
  ).toBe(200);
  const hash = [...harness.sender.activationOperations.keys()][0]!;
  harness.chain.permissions.add(`${KERNEL}:${harness.permissionId}`);
  await harness.sender.submit(harness.sender.activationOperations.get(hash)!);
  await harness.drain();
  harness.clock.advance(30_000);
  await harness.drain();
  return p;
}

const row = (sql: string) => harness.core.db.query(sql).get();

describe("separate steward review activation", () => {
  it("offers both owner-only signing and a separately scoped review grant for the first confirmed decision", async () => {
    await confirmedKernelReview();
    const links = harness.transport.sent.filter((sent) => sent.message.link);
    expect(links.at(-2)?.message.text).toContain("sign your decision with your passkey");
    expect(links.at(-1)?.message.text).toContain("including this one");
    const p = await sendFirstReview();
    expect(row("SELECT purpose, state, submissions_consumed FROM execution_grants")).toEqual({
      purpose: "review",
      state: "active",
      submissions_consumed: 1,
    });
    expect(row("SELECT lifecycle FROM review_intents")).toEqual({ lifecycle: "recorded" });
    expect(
      (await p.browser.request("GET", `/messaging/execution-grants/${p.grant.grantId}`)).status
    ).toBe(200);
    expect(harness.sender.signed).toBe(1);
    expect(harness.sender.submitted).toBe(1);
  });

  it("refuses a grant proposal when fresh published work now belongs to the steward", async () => {
    await confirmedKernelReview();
    const work = [...harness.chain.works.values()][0]!;
    work.gardenerAddress = KERNEL;
    const browser = new TestBrowser(harness.app);
    await browser.open(latestLink(harness));
    await browser.proveAs(KERNEL, KERNEL_PROOF);
    await browser.access();
    expect((await browser.request("POST", "/messaging/execution-grants")).status).toBe(403);
    expect(row("SELECT count(*) AS count FROM execution_grants")).toEqual({ count: 0 });
  });

  it("refuses the activation signature when the live gardener changes to the steward after reservation", async () => {
    await confirmedKernelReview();
    const p = await prepareActivation(harness);
    [...harness.chain.works.values()][0]!.gardenerAddress = KERNEL;
    expect(
      (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(403);
    expect(harness.sender.signed).toBe(0);
    expect(row("SELECT state FROM execution_grants")).toEqual({
      state: "owner_authorization_pending",
    });
  });

  it("rechecks the steward role after awaited signing before exposing the delegate signature", async () => {
    await confirmedKernelReview();
    const p = await prepareActivation(harness);
    const sign = harness.sender.signActivation.bind(harness.sender);
    harness.sender.signActivation = async (input) => {
      const signed = await sign(input);
      harness.chain.grantRole(TAS.address, KERNEL, { gardener: true });
      return signed;
    };
    expect(
      (await p.browser.request("POST", `${p.path}/signature`, { body: p.signatureBody })).status
    ).toBe(403);
    expect(
      row(
        "SELECT state, user_operation_hash FROM execution_attempts WHERE authorization_mode = 'activation'"
      )
    ).toEqual({ state: "wallet_pending", user_operation_hash: null });
  });

  it("uses only the review grant for the next independently confirmed decision", async () => {
    const workEnvelope = await confirmedKernelReview();
    await sendFirstReview();
    // A second real resolver-shaped work attestation is published by the fixture chain.
    harness.chain.submit({
      attester: workEnvelope.accountAddress,
      to: workEnvelope.call.to,
      data: workEnvelope.call.data,
    });
    const before = harness.transport.sent.length;
    await confirmNextReview();
    expect(harness.transport.sent.slice(before).some((sent) => sent.message.link)).toBe(false);
    expect(row("SELECT submissions_consumed FROM execution_grants")).toEqual({
      submissions_consumed: 2,
    });
    expect(harness.sender.signed).toBe(2);
    expect(harness.sender.submitted).toBe(2);
  });
});
