import {
  type FieldChange,
  findInput,
  parseDurationAnswer,
  parseFieldAnswer,
} from "@green-goods/shared/modules/agent-reporting";
import type { CopyValues } from "../copy";
import { gardenScope } from "../gardens";
import { type PromptRecord, resolvePrompt, typedChoice } from "../prompts";
import { requestConnection } from "./account-steps";
import { isGreeting } from "./commands";
import type { TurnContext, TurnPlan } from "./context";
import { acceptsAmount, profiledInput, profiledWords } from "../questions";
import { EDITABLE_STATES, lifecycleState, questionProfileOf } from "./draft-commit";
import { askEditField, askEditMenu } from "./edit-menu";
import {
  AGAIN_CHOICE,
  answeredGarden,
  askGarden,
  askJoin,
  JOIN_CHOICE,
  offeredGardens,
} from "./garden-step";
import { askField, fieldHint, fieldQuestionText } from "./field-questions";
import { askAction, askAnotherGarden, gardenLabel, promptNextStep } from "./prompting";
import { frozenReply } from "./report-commands";
import { handleReportMessage } from "./report-message";
import { namesTheCount } from "./story-words";
import {
  adoptAction,
  apply,
  applyStory,
  finish,
  gardenerFact,
  gardenRef,
  type TurnExternal,
  type Working,
} from "./report-work";
import type { TurnWriter } from "./writer";

function invalid(writer: TurnWriter, reason: string, values: CopyValues = {}): void {
  writer.say(`report.invalid.${reason}` as Parameters<TurnWriter["say"]>[0], values);
}

function presentedKeys(prompt: PromptRecord): string[] {
  return prompt.options
    .filter((option) => !option.value.startsWith("page:"))
    .map((option) => option.value);
}

/** What the open question is asking for, in a sentence, before its choices are shown again. */
function explainQuestion(writer: TurnWriter, prompt: PromptRecord): void {
  const { ctx, core } = writer;
  const draft = ctx.draft;
  switch (prompt.kind) {
    case "select_garden":
      // With no gardens on offer the question says what is wrong itself, and is put again.
      if (!offeredGardens(prompt)) return;
      return writer.say(ctx.account ? "report.explainGarden" : "report.explainGardenUnlinked");
    case "select_action":
      return writer.say("report.explainAction", {
        garden: gardenLabel(core.gardens, draft?.content.garden?.address),
      });
    case "field": {
      const input = findInput(draft?.snapshot ?? null, prompt.fieldKey ?? "");
      const hint = input ? fieldHint(input) : "";
      if (input && hint) return writer.say("report.explainField", { title: input.title, hint });
      return writer.say("report.choiceHelp");
    }
    default:
      return writer.say("report.choiceHelp");
  }
}

/**
 * Typed words that pick none of the choices on offer. What the model could read in them (a status
 * or cancel request, a request to link an account, a correction, new facts) is handled as a
 * message is. A hello, a question, or words nothing could read get a sentence on what the question
 * is asking for and the choices again, so the conversation never stops at an error.
 */
function offChoice(
  writer: TurnWriter,
  plan: Extract<TurnPlan, { kind: "answer" }>,
  external: TurnExternal,
  askAgain: () => void
): void {
  const read = external.interpretation;
  if (read?.intent === "connect") return requestConnection(writer, null);
  const hello = isGreeting(plan.text) || read?.intent === "greeting";
  const usable =
    !hello &&
    read !== null &&
    (read.intent === "status" ||
      read.intent === "cancel" ||
      read.intent === "disconnect" ||
      read.gardenKey !== null ||
      read.actionUID !== null ||
      read.facts.length > 0);
  if (usable) {
    return handleReportMessage(writer, { kind: "message", text: plan.text, media: [] }, external);
  }
  if (hello) writer.say("chat.hello");
  else explainQuestion(writer, plan.prompt);
  askAgain();
}

/**
 * A reply to a Community Garden join question whose report is no longer the chat's open one, as
 * the turn reads it; null for any other turn. A report that ends closes its question now, but an
 * earlier release left this one open, and every story sent to it was told that no report was in
 * progress. The question no longer stands, so its reply is read as it would be with no question
 * open (typed words as a message, a tap as one on an earlier question's button), and
 * `handleReportAnswer` closes it.
 */
export function lapsedJoinReply(ctx: TurnContext, plan: TurnPlan): TurnPlan | null {
  if (plan.kind !== "answer" || plan.prompt.kind !== "join_community") return null;
  if (plan.prompt.subjectId === ctx.draft?.id) return null;
  return plan.text ? { kind: "message", text: plan.text, media: [] } : { kind: "stale_reply" };
}

/** An answer to the open question, from a button or typed text. */
export function handleReportAnswer(
  writer: TurnWriter,
  plan: Extract<TurnPlan, { kind: "answer" }>,
  external: TurnExternal
): void {
  const { ctx, core } = writer;
  const draft = ctx.draft;
  const { prompt, option, text } = plan;
  if (!draft || prompt.subjectId !== draft.id) {
    // The question is about a report that has ended, or about another subject, so it no longer
    // stands. Typed words are a message of their own, which may start a new report. A tap on one
    // of its buttons puts the open report's question again, as a tap on an earlier question does.
    resolvePrompt(core, prompt.id);
    if (text || draft) handleReportMessage(writer, { kind: "message", text, media: [] }, external);
    return;
  }
  if (!EDITABLE_STATES.has(lifecycleState(draft))) {
    writer.say(frozenReply(core, draft));
    return;
  }
  const sourceEntryId = writer.sourceEntryId();
  const work: Working = { content: draft.content, snapshot: draft.snapshot, changed: false };
  const stated = (value: unknown, original?: string, unit?: string): FieldChange[] => [
    {
      field: prompt.fieldKey as FieldChange["field"],
      value,
      provenance: gardenerFact(sourceEntryId, original, unit),
    },
  ];
  // An entry that is not an answer, such as the one that opens another page of choices, can be
  // picked like any other: by its number, or by its own words typed out.
  const picked = option ?? typedChoice(prompt, text);
  const page = picked?.value.startsWith("page:") ? Number(picked.value.slice(5)) : null;

  switch (prompt.kind) {
    case "select_garden": {
      const account = ctx.account?.address ?? null;
      if (page !== null) return askGarden(writer, draft, account, page);
      if (picked?.value === JOIN_CHOICE && account) return askJoin(writer, draft, account);
      if (picked?.value === AGAIN_CHOICE) {
        // A report that has its garden is shown the gardens to change to. One still without it
        // carries on below, where it takes the account's only garden or is asked again.
        if (draft.content.garden) return askGarden(writer, draft, account);
        break;
      }
      const garden = answeredGarden(gardenScope(core.gardens, account), prompt, option, text);
      if (!garden) {
        // Words sent where no garden was on offer look at the account's gardens again, as the
        // question's one choice does.
        return offChoice(writer, plan, external, () =>
          offeredGardens(prompt)
            ? askGarden(writer, draft, account, prompt.page)
            : void finish(writer, draft, work, external, "answer")
        );
      }
      // Naming a garden asks for its activity again. Choosing the one the report already has
      // changes nothing, so the report keeps its activity and carries on.
      if (garden.address !== draft.content.garden?.address)
        apply(work, [
          { field: "garden", value: gardenRef(garden), provenance: gardenerFact(sourceEntryId) },
        ]);
      break;
    }
    case "select_action": {
      // The activities belonged to a garden that has since left the list.
      if (askAnotherGarden(writer, draft, ctx.account?.address ?? null)) return;
      if (page !== null) return askAction(writer, draft, external.catalog, page);
      const actions = external.catalog.result?.ok ? external.catalog.result.actions : [];
      const uid =
        option?.value ??
        presentedKeys(prompt)[Number(text) - 1] ??
        actions
          .find((a) => a.definition.title.toLowerCase() === text?.trim().toLowerCase())
          ?.definition.actionUID.toString();
      const action = actions.find((candidate) => candidate.definition.actionUID.toString() === uid);
      if (!action) {
        return offChoice(writer, plan, external, () =>
          askAction(writer, draft, external.catalog, prompt.page)
        );
      }
      adoptAction(work, action, gardenerFact(sourceEntryId));
      break;
    }
    case "fields": {
      // Two fields asked together: whatever the answer names is taken, and what is still missing
      // is asked next, on its own. An answer that names neither puts the question again.
      const asked = (prompt.fieldKey ?? "").split(",").map((key) => `details.${key}` as const);
      if (text && applyStory(writer, draft, work, text, asked)) break;
      const counted = asked
        .map((field) => findInput(work.snapshot, field.slice("details.".length)))
        .find((input) => input?.type === "number");
      if (isGreeting(text)) writer.say("chat.hello");
      else if (counted) writer.say("report.explainNumberPlain", { title: counted.title, unit: "" });
      return promptNextStep(writer, draft, external.catalog);
    }
    case "field": {
      const definition = findInput(work.snapshot, prompt.fieldKey ?? "");
      if (!definition) {
        promptNextStep(writer, draft, external.catalog);
        return;
      }
      if (page !== null) return askField(writer, draft, definition, page);
      // Read with the unit the report's profile gives the field, if it gives one.
      const profile = questionProfileOf(core, draft);
      const input = profiledInput(profile, definition, work.content.details);
      const answer = option
        ? {
            ok: true as const,
            value: input.type === "multi-select" ? [option.value] : option.value,
            original: option.label,
          }
        : parseFieldAnswer(input, text ?? "", presentedKeys(prompt));
      // An answer with more words than the value is read for every fact it names: "12 trees" at
      // the participants question counts trees. Words the reader cannot account for are not an
      // answer, so the first number in them is never taken on its own.
      const saysMore = !answer.ok || Boolean(answer.statedUnit);
      if (saysMore && text && applyStory(writer, draft, work, text, `details.${input.key}`)) break;
      // A value the report already holds, said again from the edit menu, changes nothing.
      if (
        answer.ok &&
        JSON.stringify(work.content.details[input.key]) === JSON.stringify(answer.value)
      ) {
        work.answered = `details.${input.key}`;
        break;
      }
      // "12 bags" for "Amount Removed (kg or bags)": a number and a plain word for what is counted.
      const unread =
        answer.ok &&
        Boolean(answer.statedUnit) &&
        input.type === "number" &&
        (work.recognised ||
          !namesTheCount(answer.statedUnit ?? "", [
            input.title,
            input.placeholder ?? "",
            input.unit ?? "",
            ...profiledWords(profile, input.key, ctx.locale, work.content.details),
          ]));
      if (!answer.ok && answer.reason === "unknown_option") {
        return offChoice(writer, plan, external, () => askField(writer, draft, input, prompt.page));
      }
      if (unread || (!answer.ok && answer.reason === "not_a_number")) {
        // A hello is answered, and the question put again.
        if (isGreeting(text)) {
          writer.say("chat.hello");
          return askField(writer, draft, definition);
        }
        // Words where a number was asked for are usually a question about the field itself.
        const hint = fieldHint(input);
        return writer.say(hint ? "report.explainNumber" : "report.explainNumberPlain", {
          title: input.title,
          hint,
          unit: input.unit ? ` (${input.unit})` : "",
        });
      }
      if (!answer.ok)
        return invalid(writer, answer.reason, {
          unit: input.unit ?? "",
          stated: answer.statedUnit ?? "",
        });
      // A count is a whole number of one or more: half a retrofit is asked again, not rounded.
      if (!acceptsAmount(profile, input.key, work.content.details, answer.value))
        return invalid(writer, "whole_number");
      apply(work, [
        {
          field: `details.${input.key}`,
          value: answer.value,
          provenance: gardenerFact(sourceEntryId, answer.original, input.unit),
        },
      ]);
      // A number with a word after it is said back, so the gardener sees how it was taken.
      if (input.type !== "number" || !answer.statedUnit) work.answered = `details.${input.key}`;
      break;
    }
    case "time": {
      const duration = parseDurationAnswer(text ?? "");
      if (duration.ok) {
        work.answered = "timeSpentMinutes";
        apply(work, [
          {
            field: "timeSpentMinutes",
            value: duration.minutes,
            provenance: gardenerFact(sourceEntryId, duration.original, duration.unit),
          },
        ]);
        break;
      }
      if (text && applyStory(writer, draft, work, text, "timeSpentMinutes")) break;
      if (duration.reason === "unit_required") {
        const value = (text ?? "").trim();
        writer.ask(
          {
            subjectKind: "draft",
            resourceId: draft.id,
            resourceRevision: draft.revision,
            kind: "time_unit",
            options: [
              { id: "h", label: writer.text("report.hours"), value: `hours:${value}` },
              { id: "m", label: writer.text("report.minutes"), value: `minutes:${value}` },
            ],
          },
          () =>
            fieldQuestionText(
              writer,
              draft,
              { kind: "time" },
              writer.text("report.askTimeUnit", { value })
            )
        );
        return;
      }
      return invalid(writer, duration.reason, { unit: "hours", stated: duration.statedUnit ?? "" });
    }
    case "time_unit": {
      const typed = text?.trim().toLowerCase() ?? "";
      const chosen =
        option ??
        (typed === "1" || typed.startsWith("h")
          ? prompt.options[0]
          : typed === "2" || typed.startsWith("m")
            ? prompt.options[1]
            : undefined);
      const [unit, value] = (chosen?.value ?? "").split(":");
      const duration = parseDurationAnswer(`${value ?? ""} ${unit ?? ""}`);
      if (!duration.ok) {
        return offChoice(writer, plan, external, () =>
          promptNextStep(writer, draft, external.catalog)
        );
      }
      apply(work, [
        {
          field: "timeSpentMinutes",
          value: duration.minutes,
          provenance: gardenerFact(sourceEntryId, duration.original, duration.unit),
        },
      ]);
      break;
    }
    case "title":
    case "feedback":
      apply(work, stated((text ?? "").trim(), text ?? undefined));
      if (!work.changed) return invalid(writer, "too_long");
      break;
    case "conflict": {
      const conflict = work.content.conflicts.find((entry) => entry.field === prompt.fieldKey);
      const choice =
        option?.value ?? (text?.trim() === "2" ? "use" : text?.trim() === "1" ? "keep" : null);
      if (!conflict || !choice) {
        return offChoice(writer, plan, external, () =>
          promptNextStep(writer, draft, external.catalog)
        );
      }
      work.content = {
        ...work.content,
        conflicts: work.content.conflicts.filter((entry) => entry !== conflict),
      };
      work.changed = true;
      if (choice === "use")
        apply(work, [
          {
            field: conflict.field,
            value: conflict.proposed,
            provenance: gardenerFact(sourceEntryId),
          },
        ]);
      break;
    }
    case "edit_field": {
      const field = picked?.value;
      if (!field) return offChoice(writer, plan, external, () => askEditMenu(writer, draft));
      return askEditField(writer, draft, field, external.catalog);
    }
    default:
      return handleReportMessage(writer, { kind: "message", text, media: [] }, external);
  }
  finish(writer, draft, work, external, "answer");
}
