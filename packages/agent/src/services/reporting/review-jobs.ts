import {
  buildEnvelope,
  isDelegationAvailable,
  type PermissionModuleEntry,
  type ReviewEnvelope,
  type ReportingDeployment,
  reviewContentDigest,
  toApprovalDraft,
} from "@green-goods/shared/modules/agent-reporting";
import type { PublishedWorkView, ReportingChain } from "./chain";
import { currentConfirmation } from "./confirmations";
import { issueContinuation } from "./continuations";
import { gardenLabel } from "./coordinator/prompting";
import { askReviewConfirmation, nextReviewStep } from "./coordinator/review-prompts";
import { inTransaction } from "./database";
import { grantUsability, liveGrant } from "./grants-store";
import type { ClaimedJob } from "./jobs";
import { conversationRealm, participantWriter } from "./notify";
import { freezeEnvelope, upsertOperation } from "./operations";
import { activeAccount, participantEpoch } from "./participants";
import { commitReview, loadReview, openReviewIntent, reviewState } from "./reviews";
import type { EnabledGarden, ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * Steward review work that needs the chain: listing pending work where the linked account is an
 * operator, opening one work for review, and establishing authority for a confirmed decision.
 * Roles are read fresh each time; a steward never reviews their own work, and a reporting grant is
 * never consulted for a review.
 */
export interface ReviewJobDeps {
  core: ReportingCore;
  chain: ReportingChain;
  deployment: ReportingDeployment;
  delegationModules: readonly PermissionModuleEntry[];
}

const done: JobOutcome = { status: "done" };
const unavailable: JobOutcome = {
  status: "retry",
  errorCode: "dependency_unavailable",
  delayMs: 30_000,
};

function writerFor(
  core: ReportingCore,
  participantId: string,
  conversationId: string,
  prefix: string
) {
  return participantWriter(core, { participantId, conversationId, dedupePrefix: prefix });
}

function shortTitle(title: string): string {
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

export async function listPendingReviews(
  deps: ReviewJobDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  const { core, chain } = deps;
  const conversationId = String(job.payload.conversationId ?? "");
  const account = activeAccount(core, job.subjectId, core.settings.chainId);
  if (!account) return done;
  const stewarded: Array<{ garden: EnabledGarden; works: PublishedWorkView[] }> = [];
  try {
    for (const garden of core.settings.gardens) {
      const roles = await chain.gardenRoles(garden.chainId, garden.address, account.address);
      if (!roles.operator) continue;
      const works = await chain.pendingWork(garden.chainId, garden.address);
      stewarded.push({
        garden,
        works: works.filter(
          (work) => work.gardenerAddress.toLowerCase() !== account.address.toLowerCase()
        ),
      });
    }
  } catch {
    return unavailable;
  }
  inTransaction(core.db, () => {
    const out = writerFor(core, job.subjectId, conversationId, `review-list:${job.id}`);
    if (!out) return;
    if (stewarded.length === 0) {
      out.say("review.notSteward", {
        garden: core.settings.gardens.map((garden) => garden.label).join(", "),
      });
      return;
    }
    const items = stewarded.flatMap(({ garden, works }) => works.map((work) => ({ garden, work })));
    if (items.length === 0) return out.say("review.none");
    out.ask(
      {
        subjectKind: "review",
        resourceId: null,
        resourceRevision: null,
        kind: "select_review_work",
        options: items.slice(0, core.settings.choicePageSize).map(({ garden, work }, index) => ({
          id: String(index),
          label: `${shortTitle(work.title)} (${garden.label})`,
          value: `${garden.key}:${work.workUID}`,
        })),
      },
      () =>
        out.text("review.pendingList", {
          garden: stewarded.map(({ garden }) => garden.label).join(", "),
        })
    );
  });
  return done;
}

export async function openReview(deps: ReviewJobDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core, chain } = deps;
  const conversationId = String(job.payload.conversationId ?? "");
  const [gardenKey, workUID] = String(job.payload.workKey ?? "").split(":");
  const garden = core.settings.gardens.find((candidate) => candidate.key === gardenKey);
  const account = activeAccount(core, job.subjectId, core.settings.chainId);
  if (!garden || !account || !workUID?.startsWith("0x")) return done;
  let work: PublishedWorkView | null;
  let operator: boolean;
  try {
    work = await chain.work(garden.chainId, workUID as `0x${string}`);
    operator = (await chain.gardenRoles(garden.chainId, garden.address, account.address)).operator;
  } catch {
    return unavailable;
  }
  inTransaction(core.db, () => {
    const out = writerFor(core, job.subjectId, conversationId, `review-open:${job.id}`);
    if (!out) return;
    if (!work || work.gardenAddress.toLowerCase() !== garden.address.toLowerCase())
      return out.say("review.none");
    if (!operator) return out.say("review.notSteward", { garden: garden.label });
    if (work.gardenerAddress.toLowerCase() === account.address.toLowerCase())
      return out.say("review.selfReview");
    const review = openReviewIntent(core, {
      participantId: job.subjectId,
      conversationId,
      stewardAccountId: account.id,
      chainId: garden.chainId,
      work,
    });
    nextReviewStep(out, review, account.address);
  });
  return done;
}

/**
 * Establishes authority for a confirmed decision and freezes its exact envelope. EOAs and Kernel
 * accounts without an active review grant sign this decision themselves; nothing here signs.
 */
export async function resolveReviewAuthority(
  deps: ReviewJobDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  const { core, chain } = deps;
  const review = loadReview(core, job.subjectId);
  if (!review || reviewState(review) !== "authority") return done;
  const confirmation = currentConfirmation(core, { reviewIntentId: review.id });
  const account = activeAccount(core, review.participantId, core.settings.chainId);
  const epoch = participantEpoch(core, review.participantId);
  if (
    !confirmation ||
    confirmation.revision !== review.revision ||
    !account ||
    account.id !== review.stewardAccountId ||
    confirmation.accountBindingId !== account.id ||
    confirmation.identityEpoch !== epoch
  ) {
    return done;
  }
  const { content } = review;
  let operator: boolean;
  let work: PublishedWorkView | null;
  try {
    operator = (await chain.gardenRoles(review.chainId, content.gardenAddress, account.address))
      .operator;
    work = await chain.work(review.chainId, content.workUID);
  } catch {
    return unavailable;
  }
  const writer = () =>
    writerFor(core, review.participantId, review.conversationId, `review-authority:${job.id}`);
  const refusal = !operator
    ? "review.notSteward"
    : content.gardenerAddress.toLowerCase() === account.address.toLowerCase() ||
        work?.gardenerAddress.toLowerCase() === account.address.toLowerCase()
      ? "review.selfReview"
      : !work
        ? "review.none"
        : null;
  if (refusal) {
    inTransaction(core.db, () =>
      writer()?.say(refusal, { garden: gardenLabel(core.settings.gardens, content.gardenAddress) })
    );
    return done;
  }

  const delegationReady = isDelegationAvailable(core.settings.chainId, deps.delegationModules);
  const grant =
    account.kind === "kernel" && delegationReady
      ? liveGrant(core, {
          accountBindingId: account.id,
          purpose: "review",
          chainId: review.chainId,
          gardenAddress: content.gardenAddress,
        })
      : null;
  const mode =
    grant && grantUsability(grant, { identityEpoch: epoch, now: core.clock.now() }) === null
      ? "delegated"
      : "owner";

  inTransaction(core.db, () => {
    const current = loadReview(core, review.id);
    if (!current || current.revision !== review.revision || reviewState(current) !== "authority")
      return;
    commitReview(core, current, [{ type: "AUTHORITY_ESTABLISHED", mode }]);
    const operation = upsertOperation(core, {
      subject: { reviewIntentId: review.id },
      authorAccountId: account.id,
      revision: review.revision,
      confirmationId: confirmation.id,
      chainId: review.chainId,
      gardenAddress: content.gardenAddress,
      mode,
    });
    if (typeof operation === "string") return;
    const approval = toApprovalDraft(content);
    const envelope = buildEnvelope<ReviewEnvelope>(deps.deployment, {
      kind: "review",
      operationId: operation.id,
      revision: review.revision,
      chainId: review.chainId,
      accountAddress: account.address as `0x${string}`,
      gardenAddress: content.gardenAddress as `0x${string}`,
      reviewContentDigest: reviewContentDigest(content),
      fields: {
        actionUID: String(approval.actionUID),
        workUID: content.workUID,
        approved: approval.approved,
        feedback: approval.feedback ?? "",
        confidence: approval.confidence,
        verificationMethod: approval.verificationMethod,
        reviewNotesCID: "",
      },
    });
    if (!freezeEnvelope(core, operation, envelope)) return;
    const out = writer();
    if (!out?.target.binding) return;
    const { url } = issueContinuation(core, {
      purpose: "review_decision",
      participantId: review.participantId,
      subjectId: out.target.subjectId,
      bindingId: out.target.binding.bindingId,
      conversationId: review.conversationId,
      providerRealm: conversationRealm(core, review.conversationId),
      resourceKind: "review",
      resourceId: review.id,
      resourceRevision: review.revision,
      resourceDigest: envelope.payloadDigest,
      expectedAccount: account.address,
      identityEpoch: epoch,
    });
    out.say(
      "review.signLink",
      { kind: out.text(account.kind === "eoa" ? "account.wallet" : "account.passkey") },
      { url, label: out.text("review.signLabel") }
    );
  });
  return done;
}

/** Shows the decision summary again after a proven rejection or definitive failure. */
export function reopenReview(
  core: ReportingCore,
  reviewId: string,
  prefix: string,
  reason: "review.rejectedBeforeSend" | "review.reverted"
): void {
  const review = loadReview(core, reviewId);
  if (!review) return;
  const account = activeAccount(core, review.participantId, core.settings.chainId);
  const out = writerFor(core, review.participantId, review.conversationId, prefix);
  const { review: refreshed } = commitReview(
    core,
    review,
    [{ type: "READY_FOR_REVIEW", revision: review.revision + 1 }],
    review.content
  );
  if (!out || !account) return;
  out.say(reason);
  askReviewConfirmation(out, refreshed, account.address);
}
