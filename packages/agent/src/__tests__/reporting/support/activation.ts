import { expect } from "vitest";
import type {
  GrantActivationOperation,
  GrantView,
  ResourceView,
} from "@green-goods/shared/modules/agent-reporting";
import type { Hex } from "viem";
import { TestBrowser } from "./browser";
import { latestLink, reportUntilSummary } from "./flows";
import { ADA, summaryToken, type Harness } from "./harness";

export const KERNEL = "0x00000000000000000000000000000000000000ca" as const;
export const KERNEL_PROOF = "0x6b65726e656c" as const;

/** Confirms, links the Kernel account, and records the separate publication consent. */
export async function confirmedKernelReport(harness: Harness) {
  const summary = await reportUntilSummary(harness);
  await harness.say(ADA, `CONFIRM ${summaryToken(summary)}`);
  const linking = new TestBrowser(harness.app);
  await linking.open(latestLink(harness));
  const proof = await linking.proveAs(KERNEL, KERNEL_PROOF);
  const consent = await harness.say(ADA, `PAIR ${proof.body.pairingCode}`);
  return harness.say(ADA, `PUBLISH ${/PUBLISH (\d{4})/.exec(consent.join("\n"))?.[1]}`);
}

/** Lifecycle fixture only: the Shared suite separately proves the real Kernel encoder/signature. */
export async function prepareActivation(
  harness: Harness,
  options: { beforeReserve?: () => void; expectedReservationStatus?: number } = {}
) {
  const browser = new TestBrowser(harness.app);
  await browser.open(latestLink(harness));
  await browser.proveAs(KERNEL, KERNEL_PROOF);
  await browser.access();
  const proposed = await browser.request<{ grant: GrantView }>(
    "POST",
    "/messaging/execution-grants"
  );
  expect(proposed.status).toBe(201);
  const grant = proposed.body.grant;
  const path = `/messaging/execution-grants/${grant.grantId}/activation`;
  const started = await browser.request("POST", path, {
    body: { expectedVersion: grant.version, policyDigest: grant.policyDigest },
  });
  expect(started.status).toBe(200);
  await harness.drain();
  const read = await browser.request<{ resource: ResourceView }>("GET", path);
  expect(read.status).toBe(200);
  const operation = read.body.resource.operation!;
  expect(operation.envelope).not.toBeNull();
  options.beforeReserve?.();
  const attempt = await browser.request<{ attemptId: string; permitVersion: number }>(
    "POST",
    `${path}/attempts`,
    {
      body: {
        expectedAttemptVersion: operation.attemptVersion,
        payloadDigest: operation.envelope!.payloadDigest,
        idempotencyKey: "activation-reservation",
      },
    }
  );
  expect(attempt.status).toBe(options.expectedReservationStatus ?? 201);
  const userOperation: GrantActivationOperation = {
    sender: KERNEL,
    nonce: "0x1",
    callData: operation.envelope!.call.data,
    callGasLimit: "0x1",
    verificationGasLimit: "0x1",
    preVerificationGas: "0x1",
    maxFeePerGas: "0x1",
    maxPriorityFeePerGas: "0x1",
    paymaster: "0x0000000000000000000000000000000000000abc",
    paymasterVerificationGasLimit: "0x1",
    paymasterPostOpGasLimit: "0x1",
    paymasterData: "0x01",
  };
  const signatureBody = {
    attemptId: attempt.body.attemptId,
    permitVersion: attempt.body.permitVersion,
    payloadDigest: operation.envelope!.payloadDigest,
    userOperation,
  };
  return { browser, grant, path, operation, signatureBody };
}

export async function grantInBrowser(harness: Harness): Promise<TestBrowser> {
  const prepared = await prepareActivation(harness);
  const signed = await prepared.browser.request("POST", `${prepared.path}/signature`, {
    body: prepared.signatureBody,
  });
  expect(signed.status).toBe(200);
  const hash = [...harness.sender.activationOperations.keys()].at(-1)!;
  harness.chain.permissions.add(`${KERNEL}:${harness.permissionId}`);
  await harness.sender
    .submit(harness.sender.activationOperations.get(hash)!)
    .catch(() => undefined);
  const outcome = await prepared.browser.request("POST", `${prepared.path}/outcome`, {
    body: {
      attemptId: prepared.signatureBody.attemptId,
      idempotencyKey: "activation-broadcast",
      payloadDigest: prepared.operation.envelope!.payloadDigest,
      outcome: { kind: "broadcast", userOperationHash: hash as Hex },
    },
  });
  expect(outcome.status).toBe(200);
  await harness.drain();
  harness.clock.advance(30_000);
  await harness.drain();
  return prepared.browser;
}
