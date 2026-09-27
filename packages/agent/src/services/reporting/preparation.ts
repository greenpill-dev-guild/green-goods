import {
  actionEligibilityIssues,
  buildEnvelope,
  type ReportingDeployment,
  type WorkEnvelope,
} from "@green-goods/shared/modules/agent-reporting";
import { buildWorkMetadataPayload } from "@green-goods/shared/utils/eas/work-metadata";
import type { ReportingCatalog } from "./catalog";
import type { ReportingChain } from "./chain";
import { activeConsentId, hasPublicationConsent } from "./consent";
import { confirmationById } from "./confirmations";
import { issueContinuation } from "./continuations";
import { readControl } from "./controls";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { gardenLabel } from "./coordinator/prompting";
import { inTransaction } from "./database";
import { type DraftRecord, loadDraft } from "./drafts";
import { enqueueJob, type ClaimedJob } from "./jobs";
import { type PrivateMediaStore, sha256Hex } from "./media-store";
import { conversationRealm, participantWriter } from "./notify";
import {
  freezeEnvelope,
  type OperationRecord,
  operationForSubject,
  setOperationState,
} from "./operations";
import { accountById, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { EvidenceUploader } from "./uploader";
import type { JobOutcome } from "./worker";

/**
 * Turns a confirmed, consented revision into a frozen publication envelope. Public upload is
 * irreversible, so the publication switch, both consents and the confirmed revision are rechecked
 * before every upload, and each completed upload is checkpointed so a retry never uploads a
 * different revision's evidence. Live eligibility is rechecked here and again before signing.
 */
export interface PreparationDeps {
  core: ReportingCore;
  chain: ReportingChain;
  catalog: ReportingCatalog;
  uploader: EvidenceUploader;
  media: PrivateMediaStore;
  deployment: ReportingDeployment;
}

type Blocker =
  | "paused"
  | "consent_withdrawn"
  | "stale"
  | "role_missing"
  | "action_ineligible"
  | "dependency_exhausted";

function stillPublishable(
  core: ReportingCore,
  draft: DraftRecord,
  operation: OperationRecord,
  subjectId: string
): Blocker | null {
  const current = loadDraft(core, draft.id);
  const confirmation = confirmationById(core, operation.confirmationId);
  if (
    !current ||
    current.revision !== operation.resourceRevision ||
    lifecycleState(current) !== "preparing"
  )
    return "stale";
  if (
    !confirmation ||
    !hasPublicationConsent(core, draft.id, current.revision, confirmation.summaryDigest)
  )
    return "consent_withdrawn";
  if (!activeConsentId(core, subjectId, "processing")) return "consent_withdrawn";
  if (!readControl(core, "publication").enabled) return "paused";
  return null;
}

function fail(
  core: ReportingCore,
  draft: DraftRecord,
  operation: OperationRecord,
  jobId: string,
  blocker: Blocker
): void {
  inTransaction(core.db, () => {
    const current = loadDraft(core, draft.id);
    if (!current || lifecycleState(current) !== "preparing") return;
    commitLifecycle(core, current, [{ type: "PREPARATION_FAILED" }], { participantAction: false });
    setOperationState(core, operation.id, "preparation_failed", { failureCode: blocker });
    const writer = participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `prepare:${jobId}`,
    });
    if (blocker === "role_missing") {
      writer?.say("publish.roleMissing", {
        garden: gardenLabel(core.settings.gardens, draft.content.garden?.address),
      });
    } else if (blocker !== "consent_withdrawn") writer?.say("publish.preparationFailed");
  });
}

export async function prepareOperation(
  deps: PreparationDeps,
  job: ClaimedJob
): Promise<JobOutcome> {
  const { core } = deps;
  const draft = loadDraft(core, job.subjectId);
  const operation = draft ? operationForSubject(core, { draftId: draft.id }) : null;
  if (
    !draft ||
    !operation ||
    operation.state !== "preparing" ||
    lifecycleState(draft) !== "preparing"
  ) {
    return { status: "done" };
  }
  const account = accountById(core, operation.authorAccountId);
  const garden = draft.content.garden;
  const snapshot = draft.snapshot;
  const writer = () =>
    participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `prepare:${job.id}`,
    });
  const subjectId = writer()?.target.subjectId;
  if (!account || !garden || !snapshot || !subjectId) return { status: "done" };

  const check = () => stillPublishable(core, draft, operation, subjectId);
  const blocked = check();
  if (blocked === "paused") {
    inTransaction(core.db, () => {
      const out = writer();
      out?.reply({ text: out.text("publish.paused") }, "publish.paused");
    });
    return { status: "retry", errorCode: "publication_paused", delayMs: 5 * 60_000 };
  }
  if (blocked === "stale") return { status: "done" };
  if (blocked) {
    fail(core, draft, operation, job.id, blocked);
    return { status: "done" };
  }

  const enabledGarden = core.settings.gardens.find(
    (candidate) => candidate.address.toLowerCase() === garden.address.toLowerCase()
  );
  if (!enabledGarden) {
    fail(core, draft, operation, job.id, "action_ineligible");
    return { status: "done" };
  }

  try {
    const [roles, mask, catalog] = await Promise.all([
      deps.chain.gardenRoles(garden.chainId, garden.address, account.address),
      deps.chain.gardenDomainMask(garden.chainId, garden.address),
      deps.catalog.eligibleActions(enabledGarden, core.clock.now()),
    ]);
    if (!roles.gardener && !roles.operator) {
      fail(core, draft, operation, job.id, "role_missing");
      return { status: "done" };
    }
    // The confirmed snapshot governs fields; live existence, dates and domain govern eligibility.
    const live =
      catalog.ok &&
      catalog.actions.some(
        (action) => action.definition.actionUID === snapshot.definition.actionUID
      );
    if (!catalog.ok) return { status: "retry", errorCode: "catalog_unavailable", delayMs: 60_000 };
    if (!live || actionEligibilityIssues(snapshot.definition, mask, core.clock.now()).length > 0) {
      fail(core, draft, operation, job.id, "action_ineligible");
      return { status: "done" };
    }

    const media: Array<{ assetId: string; digest: string; cid: string; mime: string }> = [];
    for (const [index, item] of draft.content.evidence.entries()) {
      const row = core.db
        .query(
          "SELECT sanitized_object_ciphertext, public_cid, public_revision FROM media_assets WHERE id = $id"
        )
        .get({ id: item.assetId }) as {
        sanitized_object_ciphertext: string | null;
        public_cid: string | null;
        public_revision: number | null;
      } | null;
      if (!row?.sanitized_object_ciphertext) throw new Error("Evidence object is missing");
      let cid = row.public_revision === draft.revision ? row.public_cid : null;
      if (!cid) {
        if (check()) return { status: "retry", errorCode: "publication_blocked", delayMs: 60_000 };
        const key = core.keyring.open(
          row.sanitized_object_ciphertext,
          `media_assets.sanitized:${item.assetId}`
        );
        const bytes = await deps.media.get(key, `sanitized:${item.assetId}`);
        if (sha256Hex(bytes) !== item.sanitizedDigest)
          throw new Error("Evidence bytes do not match the confirmed digest");
        cid = (
          await deps.uploader.upload({
            bytes,
            name: `evidence-${index + 1}.${item.mime.split("/")[1]}`,
            mime: item.mime,
          })
        ).cid;
        inTransaction(core.db, () =>
          core.db
            .query(
              "UPDATE media_assets SET public_cid = $cid, public_revision = $revision, updated_at = $now WHERE id = $id"
            )
            .run({ id: item.assetId, cid, revision: draft.revision, now: core.clock.now() })
        );
      }
      media.push({ assetId: item.assetId, digest: item.sanitizedDigest, cid, mime: item.mime });
    }

    const confirmation = confirmationById(core, operation.confirmationId);
    const { payload } = buildWorkMetadataPayload({
      title: draft.content.title ?? "",
      feedback: draft.content.feedback ?? "",
      actionUID: snapshot.definition.actionUID,
      timeSpentMinutes: draft.content.timeSpentMinutes ?? 0,
      details: draft.content.details,
      audioNoteCids: [],
      submittedAt: new Date(core.clock.now()).toISOString(),
      attachments: media.map((item) => ({ cid: item.cid, type: item.mime })),
      clientWorkId: operation.id,
    });
    const metadataBytes = new TextEncoder().encode(JSON.stringify(payload));
    if (check() || !confirmation)
      return { status: "retry", errorCode: "publication_blocked", delayMs: 60_000 };
    const metadata = await deps.uploader.upload({
      bytes: metadataBytes,
      name: "metadata.json",
      mime: "application/json",
    });
    const envelope = buildEnvelope<WorkEnvelope>(deps.deployment, {
      kind: "work",
      operationId: operation.id,
      revision: draft.revision,
      chainId: garden.chainId,
      accountAddress: account.address as `0x${string}`,
      gardenAddress: garden.address as `0x${string}`,
      clientWorkId: operation.id,
      actionDefinitionDigest: snapshot.digest,
      fields: {
        actionUID: String(snapshot.definition.actionUID),
        title: draft.content.title ?? "",
        feedback: draft.content.feedback ?? "",
        metadata: metadata.cid,
        media: media.map((item) => item.cid),
      },
      media,
      metadataDigest: `0x${sha256Hex(metadataBytes)}`,
    });

    inTransaction(core.db, () => {
      if (check() || !freezeEnvelope(core, operation, envelope)) return;
      const current = loadDraft(core, draft.id) as DraftRecord;
      commitLifecycle(core, current, [{ type: "PREPARED" }], { participantAction: false });
      if (operation.authorizationMode === "delegated") {
        enqueueJob(core, {
          kind: "execute_delegated",
          subjectId: operation.id,
          dedupeKey: `execute:${operation.id}:${envelope.payloadDigest}`,
        });
        return;
      }
      const out = writer();
      if (!out?.target.binding) return;
      const { url } = issueContinuation(core, {
        purpose: "publish_work",
        participantId: draft.participantId,
        subjectId: out.target.subjectId,
        bindingId: out.target.binding.bindingId,
        conversationId: draft.conversationId,
        providerRealm: conversationRealm(core, draft.conversationId),
        resourceKind: "draft",
        resourceId: draft.id,
        resourceRevision: draft.revision,
        resourceDigest: envelope.payloadDigest,
        expectedAccount: account.address,
        identityEpoch: participantEpoch(core, draft.participantId),
      });
      out.say(
        "publish.signLink",
        { kind: out.text(account.kind === "eoa" ? "account.wallet" : "account.passkey") },
        { url, label: out.text("publish.signLabel") }
      );
    });
    return { status: "done" };
  } catch (error) {
    if (job.attempts >= job.maxAttempts)
      fail(core, draft, operation, job.id, "dependency_exhausted");
    return {
      status: "retry",
      errorCode: error instanceof Error ? error.name : "preparation_error",
      delayMs: 30_000,
    };
  }
}

/** Explicit owner or gardener retry of a failed preparation for the same confirmed revision. */
export function retryPreparation(core: ReportingCore, draftId: string): boolean {
  const draft = loadDraft(core, draftId);
  const operation = draft ? operationForSubject(core, { draftId }) : null;
  if (
    !draft ||
    !operation ||
    lifecycleState(draft) !== "preparationFailed" ||
    operation.state !== "preparation_failed"
  ) {
    return false;
  }
  commitLifecycle(core, draft, [{ type: "RETRY_PREPARATION" }], { participantAction: true });
  setOperationState(core, operation.id, "preparing", { failureCode: null });
  enqueueJob(core, {
    kind: "prepare_operation",
    subjectId: draft.id,
    dedupeKey: `prepare:${operation.id}:retry:${operation.version}`,
  });
  return true;
}
