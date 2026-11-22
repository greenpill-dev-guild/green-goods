import { Confidence } from "@green-goods/shared/types/domain";

/**
 * Reads a steward's decision, confidence and feedback out of one answer, with no model. A decision
 * or a confidence is taken only from a phrase that says nothing else ("Approve.", "I reject this
 * work", "Actually reject", "high confidence", "confianza alta"), and never from a sentence that
 * asks, doubts, or goes on with a condition or a "no" ("Approve, if the photos are fixed",
 * "Aprobar no, faltan fotos"). Praise, thanks and "looks good" decide nothing, an answer that says
 * both approve and reject decides nothing, and two different levels settle neither. What is left,
 * in the steward's own words, is the feedback.
 */
export interface ReviewReading {
  decision?: "approve" | "reject";
  confidence?: Confidence;
  feedback?: string;
}

type Asked = "decision" | "confidence" | "feedback" | null;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

const APPROVE = "approve|approved|aprobar|apruebo|aprobado|aprovar|aprovo|aprovado";
const REJECT = "reject|rejected|rechazar|rechazo|rechazado|rejeitar|rejeito|rejeitado";
const OBJECT = "(?: (?:this work|the work|it|this|el trabajo|esto|o trabalho|isto))?";
/** Words that open a change of mind. "No" is not one: "no apruebo" refuses, it does not approve. */
const LEAD_IN =
  "(?:(?:actually|sorry|correction|en realidad|perdon|mejor|na verdade|desculpe|melhor) )?";
const SAYS_APPROVE = new RegExp(`(?<![\\p{L}])(?:${APPROVE})(?![\\p{L}])`, "u");
const SAYS_REJECT = new RegExp(`(?<![\\p{L}])(?:${REJECT})(?![\\p{L}])`, "u");

const LEVELS: ReadonlyArray<readonly [Confidence, string]> = [
  [Confidence.LOW, "low|baja|baixa"],
  [Confidence.MEDIUM, "medium|media"],
  [Confidence.HIGH, "high|alta"],
];
const LEVEL = LEVELS.map(([, words]) => words).join("|");
const NOUN = "confidence|confianza|confianca";
/** "high confidence", "confidence: high", "confianza alta". */
const PHRASE = `(?:(?:${LEVEL}) (?:${NOUN})|(?:${NOUN})(?: is| es| e)? (?:${LEVEL}))`;
/** A phrase that states a decision, a confidence, or both, and nothing else. */
const STATED = new RegExp(
  `^(?:${LEAD_IN}(?:i |yo |eu )?(?:(${APPROVE})|(${REJECT}))${OBJECT}(?: (${PHRASE}))?|(${PHRASE}))$`,
  "u"
);
const BARE_LEVEL = new RegExp(`^(?:${LEVEL})$`, "u");
const LEVEL_WORD = new RegExp(`(?:^| )(${LEVEL})(?: |$)`, "u");
/** Words that, opening a later part of the sentence, make what it stated conditional or refused. */
const HEDGE =
  /^(?:no|not|nao|never|nunca|yet|todavia|ainda|if|unless|once|when|until|after|except|only|si|se|cuando|quando|hasta|ate|salvo|excepto|exceto|solo|a menos|or|o|ou)(?= |$)/u;
const DOUBT =
  /(?:^| )(?:not sure|unsure|no estoy segur[oa]|no se|nao sei|nao tenho certeza)(?: |$)/u;

const levelOf = (words: string): Confidence | undefined =>
  LEVELS.find(([, names]) => names.split("|").includes(words))?.[0];

const plainOf = (text: string) => fold(text).replace(/[:¡¿]/gu, "").replace(/\s+/gu, " ").trim();

type Span = readonly [number, number];

/** The answer with what was read taken out, with the punctuation that closed it. */
function without(text: string, spans: Span[]): string {
  let kept = "";
  let at = 0;
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    kept += text.slice(at, Math.max(at, start));
    at = end + (/^[\s,.;:!]*/u.exec(text.slice(end))?.[0].length ?? 0);
  }
  kept += text.slice(at);
  return kept.replace(/^[\s,.;:!]+|[\s,;:]+$/gu, "");
}

export function readReviewAnswer(text: string, asked: Asked): ReviewReading {
  const decisions = new Set<"approve" | "reject">();
  const levels = new Set<Confidence>();
  const read: Span[] = [];
  const bare: Array<{ level: Confidence; span: Span }> = [];
  for (const sentence of text.matchAll(/[^.;!?\n]+/gu)) {
    const from = sentence.index;
    const parts = [...sentence[0].matchAll(/[^,]+/gu)].map((part) => ({
      words: plainOf(part[0]),
      span: [from + part.index, from + part.index + part[0].length] as Span,
    }));
    const stated = parts.map((part) => STATED.exec(part.words));
    const first = stated.findIndex(Boolean);
    // A sentence that asks or doubts, or goes on after what it stated with a condition or a "no",
    // states nothing: its words are all feedback.
    const hedged =
      text[from + sentence[0].length] === "?" ||
      DOUBT.test(plainOf(sentence[0])) ||
      (first >= 0 && parts.slice(first + 1).some((part) => HEDGE.test(part.words)));
    if (hedged) continue;
    parts.forEach((part, index) => {
      const match = stated[index];
      if (!match) {
        const level = BARE_LEVEL.test(part.words) ? levelOf(part.words) : undefined;
        if (level !== undefined) bare.push({ level, span: part.span });
        return;
      }
      if (match[1]) decisions.add("approve");
      else if (match[2]) decisions.add("reject");
      const phrase = match[3] ?? match[4];
      const level = phrase ? levelOf(LEVEL_WORD.exec(phrase)?.[1] ?? "") : undefined;
      if (level !== undefined) levels.add(level);
      read.push(part.span);
    });
  }
  const reading: ReviewReading = {};
  if (decisions.size === 1) reading.decision = [...decisions][0] as "approve" | "reject";
  // A level on its own ("High.") is a confidence when that was asked, or beside a decision.
  if (levels.size === 0 && bare.length === 1 && (asked === "confidence" || reading.decision)) {
    const [only] = bare as [{ level: Confidence; span: Span }];
    levels.add(only.level);
    read.push(only.span);
  }
  if (levels.size === 1) reading.confidence = [...levels][0] as Confidence;
  const feedback = without(text, read);
  // What is left is feedback when feedback was asked, or when it comes with a decision.
  if (feedback && (asked === "feedback" || reading.decision)) reading.feedback = feedback;
  // An answer that names both decisions anywhere, as "Approve. Actually reject." does, settles
  // neither: the question is asked again.
  const plain = fold(text);
  return SAYS_APPROVE.test(plain) && SAYS_REJECT.test(plain) ? {} : reading;
}
