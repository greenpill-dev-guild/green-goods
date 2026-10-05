import {
  challengeCreateRequestSchema,
  proofRequestSchema,
} from "@green-goods/shared/modules/agent-reporting";
import type { Context, Hono } from "hono";
import * as z from "zod";
import {
  type BrowserChallenge,
  challengeForBrowser,
  createBrowserChallenge,
  ownPairingCode,
  proofFields,
  verifyChallengeProof,
} from "../../../services/reporting/browser-access";
import {
  channelLabel,
  openRequestByLocator,
  requestById,
} from "../../../services/reporting/continuations";
import { inTransaction } from "../../../services/reporting/database";
import { activeAccount, participantEpoch } from "../../../services/reporting/participants";
import {
  forgetBrowser,
  issueRecognition,
  recognizedAccount,
  RECOGNITION_TTL_MS,
} from "../../../services/reporting/recognition";
import {
  issueSession,
  revokeSession,
  rotateSessionCsrf,
} from "../../../services/reporting/sessions";
import {
  BOOTSTRAP_HEADER,
  CSRF_HEADER,
  clearCookie,
  currentSession,
  failure,
  hasExactOrigin,
  limited,
  type MessagingRouteDeps,
  PREAUTH_COOKIE,
  preauthToken,
  readBody,
  recognitionToken,
  RECOGNITION_COOKIE,
  SESSION_COOKIE,
  writeCookie,
} from "./http";

function challengeView(deps: MessagingRouteDeps, challenge: BrowserChallenge, csrfToken?: string) {
  const core = deps.core();
  const request = requestById(core, challenge.requestId);
  if (!request) return null;
  const pairingCode = ownPairingCode(core, challenge);
  return {
    ok: true as const,
    challengeId: challenge.id,
    ...(csrfToken ? { csrfToken } : {}),
    state: challenge.state,
    purpose: request.purpose,
    channelLabel: channelLabel(request.providerRealm),
    proof: proofFields(core, request, challenge),
    ...(pairingCode ? { pairingCode } : {}),
    ...(challenge.verifiedAccount ? { account: challenge.verifiedAccount } : {}),
  };
}

/**
 * Pairing completes in chat; the next response to this browser is when it earns recognition.
 * Only a proof earns it: a challenge paired by recognition verified none, so it starts no new
 * 15 minutes.
 */
function rememberPaired(c: Context, deps: MessagingRouteDeps, challenge: BrowserChallenge): void {
  if (challenge.state !== "paired" && challenge.state !== "session_issued") return;
  if (challenge.proofVerifiedAt === null) return;
  const core = deps.core();
  const request = requestById(core, challenge.requestId);
  if (!request?.participantId || request.purpose === "recovery" || !challenge.verifiedAccount)
    return;
  if (participantEpoch(core, request.participantId) !== request.identityEpoch) return;
  const account = activeAccount(core, request.participantId, core.settings.chainId);
  if (!account || account.address !== challenge.verifiedAccount) return;
  const prior = recognitionToken(c);
  if (prior && recognizedAccount(core, prior, request)?.address === account.address) return;
  const token = issueRecognition(
    core,
    request.participantId,
    account.address,
    request.identityEpoch
  );
  writeCookie(c, deps, RECOGNITION_COOKIE, token, RECOGNITION_TTL_MS / 1000);
}

export function registerAccessRoutes(app: Hono, deps: MessagingRouteDeps): void {
  // Opening a link creates this browser's own challenge. The page GET never reaches here, so link
  // previews and crawlers consume nothing.
  app.post("/messaging/challenges", async (c) => {
    if (!hasExactOrigin(c, deps) || c.req.header(BOOTSTRAP_HEADER) !== "1")
      return failure(c, "forbidden");
    if (limited(c, deps, "messaging_bootstrap")) return failure(c, "rate_limited");
    const body = await readBody(c, challengeCreateRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const core = deps.core();
    const created = inTransaction(core.db, () => {
      const request = openRequestByLocator(core, body.requestId);
      const remembered =
        request && recognitionToken(c)
          ? recognizedAccount(core, recognitionToken(c) as string, request)
          : null;
      return request ? createBrowserChallenge(core, request, remembered) : null;
    });
    if (!created) return failure(c, "unavailable");
    writeCookie(
      c,
      deps,
      PREAUTH_COOKIE,
      created.preauthToken,
      (created.challenge.expiresAt - core.clock.now()) / 1000
    );
    return c.json(challengeView(deps, created.challenge, created.csrfToken), 201);
  });

  app.get("/messaging/challenges/:id", (c) => {
    const token = preauthToken(c);
    const challenge = token ? challengeForBrowser(deps.core(), c.req.param("id"), token) : null;
    const view = challenge ? challengeView(deps, challenge) : null;
    if (challenge && view) rememberPaired(c, deps, challenge);
    return view ? c.json(view) : failure(c, "access_required");
  });

  app.post("/messaging/challenges/:id/proof", async (c) => {
    if (!hasExactOrigin(c, deps)) return failure(c, "forbidden");
    if (limited(c, deps, "messaging_proof")) return failure(c, "rate_limited");
    const token = preauthToken(c);
    const core = deps.core();
    const challenge = token
      ? challengeForBrowser(core, c.req.param("id"), token, c.req.header(CSRF_HEADER) ?? "")
      : null;
    if (!challenge) return failure(c, "access_required");
    const body = await readBody(c, proofRequestSchema);
    if (!body) return failure(c, "invalid_request");
    const result = await verifyChallengeProof(core, deps, challenge, {
      account: body.account as `0x${string}`,
      signature: body.signature as `0x${string}`,
      ...(body.factory ? { factory: body.factory as `0x${string}` } : {}),
      ...(body.factoryData ? { factoryData: body.factoryData as `0x${string}` } : {}),
    });
    if (!result.ok) return failure(c, result.errorCode);
    const refreshed = challengeForBrowser(core, challenge.id, token as string);
    if (refreshed) rememberPaired(c, deps, refreshed);
    return c.json(refreshed ? challengeView(deps, refreshed) : { ok: true, state: result.state });
  });

  // Session issuance needs this browser's verified, paired challenge; a lost response is retried
  // by rotating the session under the same challenge, never by replaying a wallet signature.
  app.post("/messaging/access", async (c) => {
    if (!hasExactOrigin(c, deps)) return failure(c, "forbidden");
    if (limited(c, deps, "messaging_mutation")) return failure(c, "rate_limited");
    const token = preauthToken(c);
    const body = await readBody(c, z.object({ challengeId: z.string() }));
    const core = deps.core();
    const challenge =
      token && body
        ? challengeForBrowser(core, body.challengeId, token, c.req.header(CSRF_HEADER) ?? "")
        : null;
    if (!challenge) return failure(c, "access_required");
    const issued = issueSession(core, challenge.id);
    if (!issued) return failure(c, "access_required");
    const { session } = issued;
    const paired = challengeForBrowser(core, challenge.id, token as string);
    if (paired) rememberPaired(c, deps, paired);
    writeCookie(
      c,
      deps,
      SESSION_COOKIE,
      issued.sessionToken,
      (session.expiresAt - core.clock.now()) / 1000
    );
    return c.json({
      ok: true,
      accessId: session.accessId,
      csrfToken: issued.csrfToken,
      expiresAt: session.expiresAt,
      account: session.account,
      accountKind: session.accountKind,
      scope: {
        purpose: session.request.purpose,
        resourceKind: session.request.resourceKind,
        resourceId: session.request.resourceId,
        resourceRevision: session.request.resourceRevision,
      },
    });
  });

  // Restores a session after a refresh; the CSRF token is rotated because the page kept none.
  app.get("/messaging/access/current", (c) => {
    const session = currentSession(c, deps, false);
    if (!session) return failure(c, "access_required");
    return c.json({
      ok: true,
      accessId: session.accessId,
      csrfToken: rotateSessionCsrf(deps.core(), session.accessId),
      expiresAt: session.expiresAt,
      account: session.account,
      accountKind: session.accountKind,
      scope: {
        purpose: session.request.purpose,
        resourceKind: session.request.resourceKind,
        resourceId: session.request.resourceId,
        resourceRevision: session.request.resourceRevision,
      },
    });
  });

  app.delete("/messaging/access/:id", (c) => {
    const session = currentSession(c, deps, true);
    if (!session || session.accessId !== c.req.param("id")) return failure(c, "access_required");
    revokeSession(deps.core(), session.accessId, session.participantId);
    clearCookie(c, deps, SESSION_COOKIE);
    // Signing out also ends this browser's recognition, or the next link would skip the proof.
    const recognized = recognitionToken(c);
    if (recognized) forgetBrowser(deps.core(), recognized);
    clearCookie(c, deps, RECOGNITION_COOKIE);
    return c.json({ ok: true });
  });
}
