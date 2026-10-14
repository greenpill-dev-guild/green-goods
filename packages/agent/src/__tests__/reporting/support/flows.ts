import type {
  PublicationEnvelope,
  ResourceView,
} from "@green-goods/shared/modules/agent-reporting";
import { privateKeyToAccount } from "viem/accounts";
import { TestBrowser } from "./browser";
import { ADA, type Harness, type Person, summaryToken } from "./harness";
import { TAS } from "./fixtures";

/** Fixed test keys; they hold nothing and exist only in this suite. */
export const adaAccount = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);
export const bolaAccount = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
);
export const stewardAccount = privateKeyToAccount(
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
);

export function latestLink(harness: Harness): string {
  const request = [...harness.transport.sent].reverse().find((sent) => sent.message.link);
  if (!request?.message.link) throw new Error("No link was sent");
  return request.message.link.url;
}

/** Consent, then answer every question for the fixture planting Action up to the summary. */
export async function reportUntilSummary(
  harness: Harness,
  person: Person = ADA
): Promise<string[]> {
  await harness.say(person, "Today I planted twelve baobab seedlings by the fence");
  await harness.press(person, "I agree");
  await harness.say(person, "1");
  await harness.press(person, "Tree planting");
  await harness.say(person, "12");
  await harness.say(person, "2");
  return harness.say(person, "3 hours");
}

/** Confirms the summary, links the account through the browser and chat, and consents to publish. */
export async function confirmLinkAndPublish(
  harness: Harness,
  person: Person = ADA,
  account = adaAccount
): Promise<TestBrowser> {
  harness.chain.grantRole(TAS.address, account.address, { gardener: true });
  const summary = await reportUntilSummary(harness, person);
  await harness.say(person, `CONFIRM ${summaryToken(summary)}`);
  const linking = new TestBrowser(harness.app);
  await linking.open(latestLink(harness));
  const proof = await linking.prove(account);
  const consent = await harness.say(person, `PAIR ${proof.body.pairingCode}`);
  const token = /PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1];
  if (!token) throw new Error("No publication consent was requested");
  await harness.say(person, `PUBLISH ${token}`);
  return linking;
}

/** Opens the publish link in a fresh browser, proves the bound account and loads the draft. */
export async function openSigningPage(
  harness: Harness,
  account = adaAccount
): Promise<{ browser: TestBrowser; view: ResourceView; envelope: PublicationEnvelope }> {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  await browser.prove(account);
  const access = await browser.access();
  const scope = access.body.scope as { resourceId: string };
  const view = (await browser.request<ResourceView>("GET", `/messaging/drafts/${scope.resourceId}`))
    .body;
  const envelope = view.operation?.envelope;
  if (!envelope) throw new Error("No frozen envelope");
  return { browser, view, envelope };
}

export async function reserve(
  browser: TestBrowser,
  view: ResourceView,
  envelope: PublicationEnvelope,
  key = "attempt-key-1"
) {
  return browser.request<{ attemptId: string }>(
    "POST",
    `/messaging/operations/${view.operation?.operationId}/attempts`,
    {
      body: {
        expectedAttemptVersion: view.operation?.attemptVersion ?? 0,
        payloadDigest: envelope.payloadDigest,
        idempotencyKey: key,
      },
    }
  );
}

export async function reportOutcome(
  browser: TestBrowser,
  view: ResourceView,
  envelope: PublicationEnvelope,
  attemptId: string,
  outcome: Record<string, unknown>,
  key = "outcome-key-1"
) {
  return browser.request("POST", `/messaging/operations/${view.operation?.operationId}/outcome`, {
    body: { attemptId, idempotencyKey: key, payloadDigest: envelope.payloadDigest, outcome },
  });
}
