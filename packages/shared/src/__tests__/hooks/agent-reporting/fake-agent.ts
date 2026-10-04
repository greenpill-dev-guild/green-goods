import type {
  ChallengeResponse,
  GrantView,
  OperationView,
  RecoveryStep,
  ResourceView,
} from "../../../modules/agent-reporting/api-contract";
import { CeremonyClient } from "../../../modules/agent-reporting/ceremony-client";
import {
  buildEnvelope,
  type PublicationEnvelope,
  resolveReportingDeployment,
} from "../../../modules/agent-reporting/envelope";

/**
 * An in-memory stand-in for the Agent's ceremony API, answering with the shapes the shared
 * contract validates. It records every request so tests can assert what the page asked for and,
 * just as importantly, what it never asked for.
 */
export const ACCOUNT = "0x00000000000000000000000000000000000000a1" as const;
export const OTHER_ACCOUNT = "0x00000000000000000000000000000000000000b2" as const;
export const TX_HASH = `0x${"cd".repeat(32)}` as const;

export function workEnvelope(account: `0x${string}` = ACCOUNT): PublicationEnvelope {
  return buildEnvelope(resolveReportingDeployment(42161), {
    kind: "work",
    operationId: "op-1",
    revision: 3,
    chainId: 42161,
    accountAddress: account,
    gardenAddress: "0x00000000000000000000000000000000000000c2",
    clientWorkId: "cw-1",
    actionDefinitionDigest: `0x${"12".repeat(32)}`,
    fields: {
      actionUID: "7",
      title: "Planted seedlings",
      feedback: "Planted 12 seedlings by the fence.",
      metadata: "bafkreimetadata",
      media: ["bafkreiphoto1"],
    },
    media: [],
    metadataDigest: `0x${"34".repeat(32)}`,
  });
}

interface Recorded {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
}

export class FakeAgent {
  readonly calls: Recorded[] = [];
  purpose: ChallengeResponse["purpose"] = "publish_work";
  challengeState: ChallengeResponse["state"] = "issued";
  /** The account already linked to the chat; a proof from another account is refused. */
  boundAccount: string | null = ACCOUNT;
  /** The account this browser's challenge has proven, or was recognized for when it opened. */
  verifiedAccount: `0x${string}` | null = null;
  pairingCode = "481516";
  recovery: RecoveryStep["state"] = "started";
  recoveryCode = "271828";
  /** Outcome POSTs to lose before they reach the Agent, as a dropped connection would. */
  dropOutcomes = 0;
  grant: GrantView | null = null;
  dropGrantApprovals = 0;
  activationStarted = false;
  activationEmpty = false;
  activationSignatureFailure = false;
  operation: OperationView = {
    operationId: "op-1",
    kind: "work",
    state: "prepared",
    authorizationMode: "owner",
    attemptVersion: 0,
    envelope: workEnvelope(),
    attempt: null,
    transactionHash: null,
    attestationUid: null,
    failureCode: null,
  };

  client(): CeremonyClient {
    return new CeremonyClient({ fetch: (input, init) => this.handle(input, init) });
  }

  requests(method: string, pathPrefix: string): Recorded[] {
    return this.calls.filter((call) => call.method === method && call.path.startsWith(pathPrefix));
  }

  private challenge(): ChallengeResponse {
    return {
      ok: true,
      challengeId: "ch-1",
      csrfToken: "csrf-1",
      state: this.challengeState,
      purpose: this.purpose,
      channelLabel: "WhatsApp",
      proof: {
        purpose: this.purpose,
        challengeId: "ch-1",
        browserNonce: "nonce",
        origin: "https://greengoods.test",
        chainId: 42161,
        providerRealm: "whatsapp-fixture:1",
        source: "binding-1",
        resourceDigest: `0x${"56".repeat(32)}`,
        identityEpoch: 1,
        issuedAt: "2026-09-27T09:00:00.000Z",
        expiresAt: "2026-09-27T09:10:00.000Z",
      },
      ...(this.challengeState === "proof_verified" ? { pairingCode: this.pairingCode } : {}),
      ...(this.verifiedAccount ? { account: this.verifiedAccount } : {}),
    };
  }

  private access() {
    return {
      ok: true,
      accessId: "acc-1",
      csrfToken: "csrf-2",
      expiresAt: Date.parse("2026-09-27T09:15:00.000Z"),
      account: ACCOUNT,
      accountKind: "eoa",
      scope: {
        purpose: this.purpose,
        resourceKind: "draft",
        resourceId: "d-1",
        resourceRevision: 3,
      },
    };
  }

  private route(
    method: string,
    path: string,
    body: Record<string, unknown> | null
  ): { status: number; value: unknown } {
    const ok = (value: unknown, status = 200) => ({ status, value });
    const refuse = (errorCode: string, status: number) => ({
      status,
      value: { ok: false, errorCode },
    });
    if (method === "POST" && path === "/challenges") return ok(this.challenge(), 201);
    if (method === "GET" && path === "/challenges/ch-1") return ok(this.challenge());
    if (method === "POST" && path === "/challenges/ch-1/proof") {
      if (this.boundAccount && body?.account !== this.boundAccount) return refuse("forbidden", 403);
      this.verifiedAccount = body?.account as `0x${string}`;
      if (this.purpose === "recovery") {
        this.recovery = "account_verified";
        this.challengeState = "proof_verified";
        return ok({ ...this.challenge(), pairingCode: undefined });
      }
      this.challengeState = this.boundAccount ? "paired" : "proof_verified";
      return ok(this.challenge());
    }
    if (method === "POST" && path === "/access") return ok(this.access());
    if (method === "GET" && path === "/access/current") return ok(this.access());
    if (path.endsWith("/activation") && this.grant) {
      if (method === "POST") this.activationStarted = true;
      return this.activationStarted
        ? ok({
            ok: true,
            resource: {
              ...(this.route("GET", "/drafts/d-1", null).value as ResourceView),
              operation: this.activationEmpty ? null : this.operation,
            },
          })
        : refuse("unavailable", 404);
    }
    if (path.endsWith("/activation/attempts"))
      return this.route(method, "/operations/op-1/attempts", body);
    if (path.endsWith("/activation/signature")) {
      if (this.activationSignatureFailure) return refuse("dependency_unavailable", 503);
      this.operation = {
        ...this.operation,
        attempt: { attemptId: "at-1", attemptNumber: 1, state: "signed" },
      };
      return ok({ ok: true, delegateSignature: "0xff1234" });
    }
    if (path.endsWith("/activation/outcome") && this.grant) {
      const outcome = body?.outcome as { kind: string };
      if (outcome.kind === "broadcast") this.grant = { ...this.grant, state: "enabling" };
      if (["preparation_failed", "rejected_before_send"].includes(outcome.kind))
        this.grant = { ...this.grant, state: "failed" };
      return this.route(method, "/operations/op-1/outcome", body);
    }
    if (path.startsWith("/execution-grants") && this.grant) {
      if (path.endsWith("/approval"))
        this.grant = { ...this.grant, state: "enabling", version: this.grant.version + 1 };
      return ok({ ok: true, grant: this.grant });
    }
    if (method === "GET" && path === "/drafts/d-1") {
      return ok({
        ok: true,
        kind: "draft",
        resourceId: "d-1",
        revision: 3,
        state: "publishing",
        gardenLabel: "TAS",
        title: "Planted seedlings",
        lines: [{ label: "Activity", value: "Tree planting" }],
        evidence: [],
        summaryDigest: `0x${"78".repeat(32)}`,
        operation: this.operation,
      });
    }
    if (method === "GET" && path === "/operations/op-1")
      return ok({ ok: true, operation: this.operation });
    if (method === "POST" && path === "/operations/op-1/attempts") {
      this.operation = {
        ...this.operation,
        attemptVersion: 1,
        attempt: { attemptId: "at-1", attemptNumber: 1, state: "wallet_pending" },
      };
      return ok(
        {
          ok: true,
          attemptId: "at-1",
          attemptNumber: 1,
          permitVersion: 1,
          payloadDigest: this.operation.envelope?.payloadDigest,
        },
        201
      );
    }
    if (method === "POST" && path === "/operations/op-1/outcome") {
      const outcome = body?.outcome as { kind: string };
      const failed =
        outcome.kind === "rejected_before_send" || outcome.kind === "preparation_failed";
      this.operation = {
        ...this.operation,
        state: failed ? "failed" : "reconciling",
        failureCode: failed ? outcome.kind : null,
      };
      return ok({ ok: true, operationState: this.operation.state, attemptState: outcome.kind });
    }
    if (path.startsWith("/recovery/ch-1")) {
      if (path.endsWith("/channel")) {
        if (body?.code !== this.recoveryCode) return refuse("forbidden", 403);
        this.recovery = "channel_verified";
      }
      if (path.endsWith("/confirm")) this.recovery = "applied";
      return ok({
        ok: true,
        state: this.recovery,
        account: this.recovery === "started" ? null : ACCOUNT,
      });
    }
    return refuse("unavailable", 404);
  }

  private async handle(input: string, init: RequestInit): Promise<Response> {
    const path = input.replace(/^\/api\/messaging/, "");
    const body =
      typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    this.calls.push({
      method: init.method ?? "GET",
      path,
      body,
      headers: { ...(init.headers as Record<string, string>) },
    });
    if (path.endsWith("/outcome") && this.dropOutcomes > 0) {
      this.dropOutcomes -= 1;
      throw new TypeError("Failed to fetch");
    }
    if (path.endsWith("/approval") && this.dropGrantApprovals > 0) {
      this.dropGrantApprovals -= 1;
      throw new TypeError("Failed to fetch");
    }
    const { status, value } = this.route(init.method ?? "GET", path, body);
    return new Response(JSON.stringify(value), { status });
  }
}
