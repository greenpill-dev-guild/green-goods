import {
  buildReportingProofMessage,
  CeremonyClient,
  envelopeIssues,
  resolveReportingDeployment,
} from "@green-goods/shared/modules/agent-reporting";
import type { PrivateKeyAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adaAccount, latestLink, reportUntilSummary } from "./support/flows";
import { TAS } from "./support/fixtures";
import { ADA, Harness, type Person, summaryToken } from "./support/harness";

/**
 * The browser pages' own client against the real ceremony routes, stores and schemas: the same
 * code the client ships, with a cookie jar and Origin header standing in for the browser. It proves
 * the wire contract end to end; wallet prompts and the Vercel proxy stay outside this lane.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
  harness.chain.grantRole(TAS.address, adaAccount.address, { gardener: true });
});

afterEach(() => {
  harness.close();
});

function browserClient(): CeremonyClient {
  const cookies = new Map<string, string>();
  return new CeremonyClient({
    basePath: "/messaging",
    fetch: async (input, init) => {
      const headers = new Headers(init.headers);
      headers.set("origin", "https://greengoods.test");
      if (cookies.size) {
        headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
      }
      const response = await harness.app.request(input, { ...init, headers });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair = ""] = cookie.split(";");
        const [name = "", value = ""] = pair.split("=");
        if (value) cookies.set(name.trim(), value);
        else cookies.delete(name.trim());
      }
      return response;
    },
  });
}

function requestIdOf(link: string): string {
  return link.split("/").at(-1) ?? "";
}

async function prove(client: CeremonyClient, challengeId: string, account: PrivateKeyAccount) {
  const { proof } = await client.challenge(challengeId);
  const signature = await account.signMessage({
    message: buildReportingProofMessage(proof, account.address),
  });
  // viem's Address widens to string in this workspace; the wire type wants hex.
  return client.submitProof(challengeId, { account: account.address as `0x${string}`, signature });
}

describe("browser ceremony client against the Agent API", () => {
  it("links an account, then publishes the exact frozen report from a fresh browser", async () => {
    const summary = await reportUntilSummary(harness);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    const linking = browserClient();
    const linkChallenge = await linking.openChallenge(requestIdOf(latestLink(harness)));
    expect(linkChallenge).toMatchObject({ state: "issued", purpose: "link_account" });
    const proven = await prove(linking, linkChallenge.challengeId, adaAccount);
    expect(proven.state).toBe("proof_verified");
    const consent = await harness.say(ADA, `PAIR ${proven.pairingCode}`);
    await harness.say(ADA, `PUBLISH ${/PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1]}`);

    const page = browserClient();
    const challenge = await page.openChallenge(requestIdOf(latestLink(harness)));
    expect((await prove(page, challenge.challengeId, adaAccount)).state).toBe("paired");
    const access = await page.access(challenge.challengeId);
    expect(access.scope).toMatchObject({ purpose: "publish_work", resourceKind: "draft" });
    const view = await page.draft(access.scope.resourceId ?? "");
    const operation = view.operation;
    const envelope = operation?.envelope;
    if (!operation || !envelope) throw new Error("No frozen envelope");
    expect(
      envelopeIssues(envelope, {
        deployment: resolveReportingDeployment(envelope.chainId),
        account: adaAccount.address,
      })
    ).toEqual([]);

    const attempt = await page.reserveAttempt(operation.operationId, {
      expectedAttemptVersion: operation.attemptVersion,
      payloadDigest: envelope.payloadDigest,
      idempotencyKey: "attempt-key-browser",
    });
    const hash = harness.chain.submit({
      attester: adaAccount.address,
      to: envelope.call.to,
      data: envelope.call.data,
    });
    const report = {
      attemptId: attempt.attemptId,
      idempotencyKey: `${attempt.attemptId}:broadcast`,
      payloadDigest: envelope.payloadDigest,
      outcome: { kind: "broadcast" as const, transactionHash: hash },
    };
    expect(await page.reportOutcome(operation.operationId, report)).toMatchObject({
      attemptState: "broadcast",
    });
    // A lost response is retried with the same key and body; the Agent replays its answer.
    expect(await page.reportOutcome(operation.operationId, report)).toMatchObject({
      attemptState: "broadcast",
    });
    await harness.drain();
    expect(await page.operation(operation.operationId)).toMatchObject({
      state: "published",
      transactionHash: hash,
    });

    // A refreshed page resumes the same session and can end it.
    expect((await page.currentAccess()).accessId).toBe(access.accessId);
    await page.endAccess(access.accessId);
    await expect(page.currentAccess()).rejects.toMatchObject({ code: "access_required" });
  });

  it("moves an account to a new chat through the recovery steps", async () => {
    const summary = await reportUntilSummary(harness);
    await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
    const linking = browserClient();
    const linkChallenge = await linking.openChallenge(requestIdOf(latestLink(harness)));
    const proven = await prove(linking, linkChallenge.challengeId, adaAccount);
    await harness.say(ADA, `PAIR ${proven.pairingCode}`);

    const newPhone: Person = {
      realm: "synthetic:wefa",
      chatId: "chat-ada-new",
      subjectId: "+2340000000077",
    };
    await harness.say(newPhone, "RECOVER");
    await harness.press(newPhone, "I agree");
    const page = browserClient();
    const challenge = await page.openChallenge(requestIdOf(latestLink(harness)));
    expect(challenge.purpose).toBe("recovery");
    expect(await page.recovery(challenge.challengeId)).toMatchObject({ state: "started" });

    const sentBefore = harness.transport.sent.length;
    await prove(page, challenge.challengeId, adaAccount);
    await harness.drain();
    const code = harness.transport.sent
      .slice(sentBefore)
      .map((sent) => /recovery page: (\d{6})/.exec(sent.message.text)?.[1])
      .find(Boolean);
    expect(await page.recovery(challenge.challengeId)).toMatchObject({
      state: "account_verified",
      account: adaAccount.address.toLowerCase(),
    });
    await expect(page.confirmRecoveryCode(challenge.challengeId, "000000")).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(await page.confirmRecoveryCode(challenge.challengeId, code ?? "")).toMatchObject({
      state: "channel_verified",
    });
    expect(await page.applyRecovery(challenge.challengeId)).toMatchObject({ state: "applied" });
  });
});
// TEST-QUALITY: allow-small-test-file - These two browser-client journeys own the SQLite HTTP wire contract for publication and recovery; pure client tests cannot exercise cookies, stores or route composition.
