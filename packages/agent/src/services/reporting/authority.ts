import {
  isDelegationAvailable,
  type PermissionModuleEntry,
} from "@green-goods/shared/modules/agent-reporting";
import type { ReportingChain } from "./chain";
import { currentConfirmation } from "./confirmations";
import { issueContinuation } from "./continuations";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { gardenLabel } from "./coordinator/prompting";
import { inTransaction } from "./database";
import { loadDraft } from "./drafts";
import { grantUsability, liveGrant } from "./grants-store";
import { enqueueJob, type ClaimedJob } from "./jobs";
import { conversationRealm, participantWriter } from "./notify";
import { upsertOperation } from "./operations";
import { activeAccount, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * Chooses how a confirmed report will be authorized. It links an account when none is bound, asks
 * for publication consent naming that account when the confirmation predates the link, checks the
 * account's current garden role, then picks exact owner signing (EOAs and Kernel sign-once) or a
 * usable delegated grant. A missing role keeps the draft; nothing here signs or publishes.
 */
export interface AuthorityDeps {
  core: ReportingCore;
  chain: ReportingChain;
  delegationModules: readonly PermissionModuleEntry[];
}

const done: JobOutcome = { status: "done" };

export async function resolveAuthority(deps: AuthorityDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const draft = loadDraft(core, job.subjectId);
  if (!draft || lifecycleState(draft) !== "authority") return done;
  const confirmation = currentConfirmation(core, { draftId: draft.id });
  const garden = draft.content.garden;
  if (!confirmation || confirmation.revision !== draft.revision || !garden) return done;
  const writer = () =>
    participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `authority:${job.id}`,
    });
  const account = activeAccount(core, draft.participantId, core.settings.chainId);
  const epoch = participantEpoch(core, draft.participantId);

  if (
    !account ||
    confirmation.accountBindingId !== account.id ||
    !confirmation.publicationConsentId
  ) {
    inTransaction(core.db, () => {
      const out = writer();
      if (!out?.target.binding) return;
      if (!account) {
        const { url } = issueContinuation(core, {
          purpose: "link_account",
          participantId: draft.participantId,
          subjectId: out.target.subjectId,
          bindingId: out.target.binding.bindingId,
          conversationId: draft.conversationId,
          providerRealm: conversationRealm(core, draft.conversationId),
          resourceKind: "draft",
          resourceId: draft.id,
          resourceRevision: draft.revision,
          resourceDigest: confirmation.summaryDigest,
          expectedAccount: null,
          identityEpoch: epoch,
        });
        out.say("link.request", {}, { url, label: out.text("link.label") });
        out.say("link.pairHint");
        return;
      }
      out.ask(
        {
          subjectKind: "draft",
          resourceId: draft.id,
          resourceRevision: draft.revision,
          kind: "publication_consent",
          options: [{ id: "publish", label: out.text("publish.publish"), value: "publish" }],
        },
        (prompt) =>
          out.text("publish.consent", {
            garden: gardenLabel(core.settings.gardens, garden.address),
            account: account.address,
            token: prompt.token,
          })
      );
    });
    return done;
  }

  let roles;
  try {
    roles = await deps.chain.gardenRoles(garden.chainId, garden.address, account.address);
  } catch {
    return { status: "retry", errorCode: "dependency_unavailable", delayMs: 30_000 };
  }
  if (!roles.gardener && !roles.operator) {
    inTransaction(core.db, () =>
      writer()?.say("publish.roleMissing", {
        garden: gardenLabel(core.settings.gardens, garden.address),
      })
    );
    return done;
  }

  const delegationReady = isDelegationAvailable(core.settings.chainId, deps.delegationModules);
  const grant =
    account.kind === "kernel" && delegationReady
      ? liveGrant(core, {
          accountBindingId: account.id,
          purpose: "reporting",
          chainId: garden.chainId,
          gardenAddress: garden.address,
        })
      : null;
  const usable =
    grant && grantUsability(grant, { identityEpoch: epoch, now: core.clock.now() }) === null;
  const mode =
    account.kind === "eoa" || !delegationReady ? "owner" : usable ? "delegated" : "grant_choice";

  inTransaction(core.db, () => {
    const current = loadDraft(core, draft.id);
    if (!current || current.revision !== draft.revision || lifecycleState(current) !== "authority")
      return;
    commitLifecycle(core, current, [{ type: "AUTHORITY_ESTABLISHED", mode }], {
      participantAction: false,
    });
    if (mode === "grant_choice") {
      const out = writer();
      out?.ask(
        {
          subjectKind: "draft",
          resourceId: draft.id,
          resourceRevision: draft.revision,
          kind: "grant_choice",
          options: [
            { id: "grant", label: out.text("publish.allowReporting"), value: "grant" },
            { id: "once", label: out.text("publish.thisReportOnly"), value: "once" },
          ],
        },
        () =>
          out.text("publish.grantOffer", {
            garden: gardenLabel(core.settings.gardens, garden.address),
            count: 5,
          })
      );
      return;
    }
    const operation = upsertOperation(core, {
      subject: { draftId: draft.id },
      authorAccountId: account.id,
      revision: draft.revision,
      confirmationId: confirmation.id,
      chainId: garden.chainId,
      gardenAddress: garden.address,
      mode,
    });
    if (typeof operation === "string") return;
    enqueueJob(core, {
      kind: "prepare_operation",
      subjectId: draft.id,
      dedupeKey: `prepare:${operation.id}:${operation.version}`,
    });
  });
  return done;
}
