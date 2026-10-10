import {
  type ActionDefinitionSnapshot,
  buildReportSummary,
  findInput,
  outstandingFieldQuestions,
  outstandingRequirements,
  reportQuestionPosition,
  pageChoices,
  type ReportRequirement,
} from "@green-goods/shared/modules/agent-reporting";
import type { Address, WorkInput } from "@green-goods/shared/types/domain";
import { type CatalogResult, orderActions } from "../catalog";
import type { DraftRecord } from "../drafts";
import { findGarden, type GardenDirectory, isUnlisted, type ReportingGarden } from "../gardens";
import { closeConversationPrompt, type PromptOption, promptsAsked } from "../prompts";
import { EDITABLE_STATES, lifecycleState } from "./draft-commit";
import { askGarden } from "./garden-step";
import type { ConversationWriter, TurnWriter } from "./writer";

export interface CatalogView {
  garden: ReportingGarden | null;
  result: CatalogResult | null;
}

export function gardenLabel(gardens: GardenDirectory, address: string | undefined): string {
  return findGarden(gardens, address)?.label ?? "your garden";
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

function formatDetail(input: WorkInput, value: unknown): string {
  const labels = input.type === "band" ? input.bandLabels : input.optionLabels;
  if (Array.isArray(value)) return value.map((key) => labels?.[key] ?? key).join(", ");
  if (typeof value === "number") return `${value}${input.unit ? ` ${input.unit}` : ""}`;
  return labels?.[String(value)] ?? String(value);
}

const option = (id: string, label: string, value: string): PromptOption => ({ id, label, value });

/** The field questions this report has already put to the gardener, from its own prompts. */
function askedQuestions(writer: ConversationWriter, draft: DraftRecord): ReportRequirement[] {
  return promptsAsked(writer.core, "draft", draft.id).flatMap(
    ({ kind, fieldKey }): ReportRequirement[] => {
      if (kind === "field") return fieldKey ? [{ kind: "detail", key: fieldKey }] : [];
      if (kind === "time" || kind === "time_unit") return [{ kind: "time" }];
      if (kind === "title" || kind === "feedback") return [{ kind }];
      return kind === "evidence" ? [{ kind: "evidence", minimum: 0, have: 0 }] : [];
    }
  );
}

/**
 * A field question with its place among the ones this report asks, "2 of 3 · ", so the count the
 * conversation opened with is the count it is numbered against. Garden, activity and contradiction
 * questions stay unnumbered, and so does a field asked again to change it.
 */
export function fieldQuestionText(
  writer: ConversationWriter,
  draft: DraftRecord,
  requirement: ReportRequirement,
  question: string
): string {
  const place = reportQuestionPosition(
    draft.content,
    draft.snapshot,
    requirement,
    askedQuestions(writer, draft)
  );
  if (!place) return question;
  // Questions are put one at a time, so this one follows those already answered, whatever its
  // place in the activity's own list.
  const waiting = outstandingFieldQuestions(draft.content, draft.snapshot).length;
  const position = place.total - waiting + 1;
  return `${writer.text("report.questionPosition", { position, total: place.total })}${question}`;
}

/** What the activity's own definition says about a field, when that adds to its title. */
export function fieldHint(input: WorkInput): string {
  const hint = (input.placeholder ?? "").trim().replace(/[.:…]+$/u, "");
  return hint && hint.toLowerCase() !== input.title.trim().toLowerCase() ? hint : "";
}

/** A field's name as its question opens: with the definition's hint when it has one. */
function fieldLead(writer: ConversationWriter, input: WorkInput): string {
  const hint = fieldHint(input);
  return hint
    ? writer.text("report.fieldLeadHint", { title: input.title, hint })
    : writer.text("report.fieldLead", { title: input.title });
}

export function askField(
  writer: ConversationWriter,
  draft: DraftRecord,
  input: WorkInput,
  pageIndex = 0
): void {
  const base = {
    subjectKind: "draft" as const,
    resourceId: draft.id,
    resourceRevision: draft.revision,
    kind: "field",
    fieldKey: input.key,
  };
  if (input.type === "number") {
    writer.ask(base, () =>
      fieldQuestionText(
        writer,
        draft,
        { kind: "detail", key: input.key },
        writer.text("report.askNumber", {
          title: fieldLead(writer, input),
          unit: input.unit ? ` (${input.unit})` : "",
        })
      )
    );
    return;
  }
  if (input.type === "text" || input.type === "textarea") {
    writer.ask(base, () =>
      fieldQuestionText(
        writer,
        draft,
        { kind: "detail", key: input.key },
        writer.text("report.askText", { title: fieldLead(writer, input) })
      )
    );
    return;
  }
  const page = pageChoices(input, pageIndex, writer.core.settings.choicePageSize);
  const options = page.keys.map((key, index) => option(`${index}`, page.labels[index] ?? key, key));
  if (page.hasMore)
    options.push(option("more", writer.text("report.moreChoices"), `page:${pageIndex + 1}`));
  writer.ask({ ...base, options, page: pageIndex }, () =>
    fieldQuestionText(
      writer,
      draft,
      { kind: "detail", key: input.key },
      writer.text(input.type === "multi-select" ? "report.askMulti" : "report.askChoice", {
        title: fieldLead(writer, input),
      })
    )
  );
}

export function askAction(
  writer: ConversationWriter,
  draft: DraftRecord,
  view: CatalogView,
  page = 0
): void {
  const garden = view.garden?.label ?? "your garden";
  if (!view.result || !view.result.ok) {
    // Asked as a question of its own: it replaces the garden question it follows, so the next
    // message reads the activities again and is never taken for another garden.
    writer.ask(
      {
        subjectKind: "draft",
        resourceId: draft.id,
        resourceRevision: draft.revision,
        kind: "retry_actions",
        options: [option("retry", writer.text("report.tryAgain"), "retry")],
      },
      () => writer.text("report.catalogUnavailable", { garden })
    );
    return;
  }
  const actions = orderActions(view.result.actions);
  if (actions.length === 0) {
    // Nothing to choose here; the garden question it follows is closed and EDIT reopens it.
    closeConversationPrompt(writer.core, writer.target.conversationId);
    writer.say("report.noActions", { garden });
    return;
  }
  const size = writer.core.settings.choicePageSize;
  const shown = actions.slice(page * size, page * size + size);
  const options = shown.map((action, index) =>
    option(`${index}`, action.definition.title, String(action.definition.actionUID))
  );
  if (actions.length > (page + 1) * size)
    options.push(option("more", writer.text("report.moreChoices"), `page:${page + 1}`));
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "select_action",
      options,
      page,
    },
    () => writer.text("report.askAction", { garden })
  );
}

function askRequirement(
  writer: ConversationWriter,
  draft: DraftRecord,
  requirement: ReportRequirement,
  view: CatalogView,
  account: Address | null
): void {
  const base = {
    subjectKind: "draft" as const,
    resourceId: draft.id,
    resourceRevision: draft.revision,
  };
  const snapshot = draft.snapshot;
  switch (requirement.kind) {
    case "conflict": {
      const conflict = draft.content.conflicts.find((entry) => entry.field === requirement.field);
      const current = String(conflictValue(draft, requirement.field) ?? "-");
      const proposed = String(conflict?.proposed ?? "-");
      writer.ask(
        {
          ...base,
          kind: "conflict",
          fieldKey: requirement.field,
          options: [
            option("keep", writer.text("report.keepCurrent", { current }), "keep"),
            option("use", writer.text("report.useProposed", { proposed }), "use"),
          ],
        },
        () =>
          writer.text("report.conflict", {
            current,
            proposed,
            field: requirement.field.replace(/^details\./, ""),
            source: conflict?.provenance.sources.some((source) => source.assetId)
              ? "a file"
              : "your message",
          })
      );
      return;
    }
    case "garden":
      return askGarden(writer, draft, account);
    case "action":
      return askAction(writer, draft, activitiesOf(writer, draft, view));
    case "unsupported_input":
      writer.say("report.unsupportedInput", {
        action: snapshot?.definition.title ?? "",
        field: findInput(snapshot, requirement.key)?.title ?? requirement.key,
      });
      return;
    case "detail": {
      const input = findInput(snapshot, requirement.key);
      if (input) askField(writer, draft, input);
      return;
    }
    case "time":
      writer.ask({ ...base, kind: "time" }, () =>
        fieldQuestionText(writer, draft, requirement, writer.text("report.askTime"))
      );
      return;
    case "title":
      writer.ask({ ...base, kind: "title" }, () =>
        fieldQuestionText(writer, draft, requirement, writer.text("report.askTitle"))
      );
      return;
    case "feedback":
      writer.ask({ ...base, kind: "feedback" }, () =>
        fieldQuestionText(writer, draft, requirement, writer.text("report.askFeedback"))
      );
      return;
    case "evidence":
      writer.ask({ ...base, kind: "evidence" }, () =>
        fieldQuestionText(
          writer,
          draft,
          requirement,
          writer.text("report.askEvidence", { count: requirement.minimum - requirement.have })
        )
      );
      return;
    case "evidence_limit":
      writer.say("report.evidenceLimit", { maximum: requirement.maximum });
      return;
  }
}

/**
 * The activities to offer for the report's garden. A turn reads one garden's activities before it
 * knows how it will end, so a report that ends up naming another garden has none read yet and
 * asks to try again, never offering the first garden's activities under the second's name.
 */
function activitiesOf(
  writer: ConversationWriter,
  draft: DraftRecord,
  view: CatalogView
): CatalogView {
  const address = draft.content.garden?.address;
  return view.garden?.address === address
    ? view
    : { garden: findGarden(writer.core.gardens, address), result: null };
}

function conflictValue(draft: DraftRecord, field: string): unknown {
  if (field.startsWith("details.")) return draft.content.details[field.slice(8)];
  return (draft.content as unknown as Record<string, unknown>)[
    field === "action" ? "actionUID" : field
  ];
}

/** Renders the confirmation summary from validated state and issues the token-bound prompt. */
export function askConfirmation(
  writer: ConversationWriter,
  draft: DraftRecord,
  account: string | null
): void {
  const snapshot = draft.snapshot as ActionDefinitionSnapshot;
  const summary = buildReportSummary({
    draftId: draft.id,
    revision: draft.revision,
    content: draft.content,
    snapshot,
    account: account as `0x${string}` | null,
  });
  const details = snapshot.definition.inputs
    .filter((input) => summary.details[input.key] !== undefined)
    .map((input) => `\n• ${input.title}: ${formatDetail(input, summary.details[input.key])}`)
    .join("");
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "confirm_report",
      options: [
        option("confirm", writer.text("report.confirm"), "confirm"),
        option("edit", writer.text("report.edit"), "edit"),
        option("cancel", writer.text("report.cancel"), "cancel"),
      ],
    },
    (prompt) =>
      writer.text("report.summary", {
        garden: gardenLabel(writer.core.gardens, summary.garden.address),
        action: snapshot.definition.title,
        title: summary.title,
        time: formatMinutes(summary.timeSpentMinutes),
        feedback: summary.feedback,
        details,
        photos: summary.evidence.length,
        account: account ? writer.text("report.summaryAccount", { account }) : "",
        token: prompt.token,
        instruction: writer.text(
          writer.usesButtons()
            ? "report.summaryButtonInstruction"
            : "report.summaryCodeInstruction",
          { token: prompt.token }
        ),
      })
  );
}

/**
 * A report whose garden has left the list can go nowhere until it names another, so it is told
 * why and asked which garden it is for. The garden stays on the report until another is picked:
 * nothing is lost if it is listed again, and choosing it again then carries the report on.
 * Publishing refuses such a garden either way. Returns whether the question was put.
 */
export function askAnotherGarden(
  writer: ConversationWriter,
  draft: DraftRecord,
  account: Address | null
): boolean {
  if (!EDITABLE_STATES.has(lifecycleState(draft))) return false;
  if (!isUnlisted(writer.core.gardens, draft.content.garden?.address)) return false;
  writer.say("report.gardenUnlisted");
  askGarden(writer, draft, account);
  return true;
}

/** Asks for whatever the draft needs next, or shows the summary when nothing is missing. */
export function promptNextStep(writer: TurnWriter, draft: DraftRecord, view: CatalogView): void {
  promptNextStepFor(writer, draft, view, writer.ctx.account?.address ?? null);
}

/** The same next step from background work, which names the linked account explicitly. */
export function promptNextStepFor(
  writer: ConversationWriter,
  draft: DraftRecord,
  view: CatalogView,
  account: Address | null
): void {
  if (askAnotherGarden(writer, draft, account)) return;
  const requirements = outstandingRequirements(draft.content, draft.snapshot);
  if (requirements.length === 0) {
    askConfirmation(writer, draft, account);
    return;
  }
  askRequirement(writer, draft, nextRequirement(requirements, draft), view, account);
}

const CHOICE_INPUTS = new Set<WorkInput["type"]>(["select", "multi-select", "band"]);

/**
 * The requirement to ask next. An amount with no unit ("Milestone Value") only means something
 * once the gardener has picked what it measures ("Solar kW installed"), so such a number waits
 * for the first of the activity's choices still to be made. A number that names its unit, and
 * everything else, keeps the place the activity gives it.
 */
function nextRequirement(
  requirements: readonly ReportRequirement[],
  draft: DraftRecord
): ReportRequirement {
  const first = requirements[0] as ReportRequirement;
  if (first.kind !== "detail") return first;
  const amount = findInput(draft.snapshot, first.key);
  if (amount?.type !== "number" || amount.unit) return first;
  for (const requirement of requirements) {
    if (requirement.kind !== "detail") break;
    const input = findInput(draft.snapshot, requirement.key);
    if (input && CHOICE_INPUTS.has(input.type)) return requirement;
  }
  return first;
}
