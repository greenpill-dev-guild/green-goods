import {
  type ActionDefinitionSnapshot,
  buildReportSummary,
  findInput,
  outstandingRequirements,
  pageChoices,
  type ReportRequirement,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { type CatalogResult, orderActions } from "../catalog";
import type { DraftRecord } from "../drafts";
import { findGarden, type GardenDirectory, gardenByKey, type ReportingGarden } from "../gardens";
import type { PromptOption, PromptRecord } from "../prompts";
import type { ConversationWriter, TurnWriter } from "./writer";

export interface CatalogView {
  garden: ReportingGarden | null;
  result: CatalogResult | null;
}

export function gardenLabel(gardens: GardenDirectory, address: string | undefined): string {
  return findGarden(gardens, address)?.label ?? "your garden";
}

/**
 * The garden a garden question's answer names: the chosen option, its number, or a name that
 * matches exactly one garden. Names are steward-editable and need not be unique.
 */
export function answeredGarden(
  gardens: GardenDirectory,
  prompt: PromptRecord,
  chosen: PromptOption | null | undefined,
  text: string | null | undefined
): ReportingGarden | null {
  const presented = prompt.options.filter((choice) => !choice.value.startsWith("page:"));
  const key = chosen?.value ?? presented[Number(text) - 1]?.value;
  if (key) return gardenByKey(gardens, key);
  const name = text?.trim().toLowerCase();
  const named = name ? gardens.list().filter((garden) => garden.label.toLowerCase() === name) : [];
  return named.length === 1 ? (named[0] as ReportingGarden) : null;
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
      writer.text("report.askNumber", {
        title: input.title,
        unit: input.unit ? ` (${input.unit})` : "",
      })
    );
    return;
  }
  if (input.type === "text" || input.type === "textarea") {
    writer.ask(base, () => writer.text("report.askText", { title: input.title }));
    return;
  }
  const page = pageChoices(input, pageIndex, writer.core.settings.choicePageSize);
  const options = page.keys.map((key, index) => option(`${index}`, page.labels[index] ?? key, key));
  if (page.hasMore)
    options.push(option("more", writer.text("report.moreChoices"), `page:${pageIndex + 1}`));
  writer.ask({ ...base, options, page: pageIndex }, () =>
    writer.text(input.type === "multi-select" ? "report.askMulti" : "report.askChoice", {
      title: input.title,
    })
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
    writer.say("report.catalogUnavailable", { garden });
    return;
  }
  const actions = orderActions(view.result.actions);
  if (actions.length === 0) {
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

/** Every garden accepts reports, so the list is paged like Actions. */
export function askGarden(writer: ConversationWriter, draft: DraftRecord, page = 0): void {
  const gardens = writer.core.gardens.list();
  if (gardens.length === 0) {
    // The list only comes back empty when the indexer could not be read.
    writer.say("report.gardensUnavailable");
    return;
  }
  const size = writer.core.settings.choicePageSize;
  const options = gardens
    .slice(page * size, page * size + size)
    .map((garden, index) => option(`${index}`, garden.label, garden.key));
  if (gardens.length > (page + 1) * size)
    options.push(option("more", writer.text("report.moreChoices"), `page:${page + 1}`));
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "select_garden",
      options,
      page,
    },
    () => writer.text("report.askGarden")
  );
}

function askRequirement(
  writer: ConversationWriter,
  draft: DraftRecord,
  requirement: ReportRequirement,
  view: CatalogView
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
      return askGarden(writer, draft);
    case "action":
      return askAction(writer, draft, view);
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
      writer.ask({ ...base, kind: "time" }, () => writer.text("report.askTime"));
      return;
    case "title":
      writer.ask({ ...base, kind: "title" }, () => writer.text("report.askTitle"));
      return;
    case "feedback":
      writer.ask({ ...base, kind: "feedback" }, () => writer.text("report.askFeedback"));
      return;
    case "evidence":
      writer.ask({ ...base, kind: "evidence" }, () =>
        writer.text("report.askEvidence", { count: requirement.minimum - requirement.have })
      );
      return;
    case "evidence_limit":
      writer.say("report.evidenceLimit", { maximum: requirement.maximum });
      return;
  }
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
      })
  );
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
  account: string | null
): void {
  const requirements = outstandingRequirements(draft.content, draft.snapshot);
  if (requirements.length === 0) {
    askConfirmation(writer, draft, account);
    return;
  }
  askRequirement(writer, draft, requirements[0] as ReportRequirement, view);
}
