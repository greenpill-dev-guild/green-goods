import { Confidence } from "@green-goods/shared/types/domain";

/**
 * Reads a steward's decision, confidence and feedback out of one answer, with no model. A decision
 * is taken only from the word itself opening a sentence ("Approve.", "I reject this work",
 * "Actually reject"); a
 * confidence only from its own words ("high confidence", "confianza alta"); what is left is the
 * feedback. Praise, thanks and "looks good" decide nothing, and a sentence that says both approve
 * and reject, or asks a question, decides nothing either.
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
const DECISION = new RegExp(
  `^${LEAD_IN}(?:i |yo |eu )?(?:(${APPROVE})|(${REJECT}))${OBJECT}(?= |$)`,
  "u"
);
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
const CONFIDENCE = new RegExp(
  `^(?:(${LEVEL}) (?:${NOUN})|(?:${NOUN})(?: is| es| e)? (${LEVEL}))(?= |$)`,
  "u"
);
const BARE_LEVEL = new RegExp(`^(${LEVEL})$`, "u");

const levelOf = (word: string): Confidence | undefined =>
  LEVELS.find(([, words]) => words.split("|").includes(word))?.[0];

export function readReviewAnswer(text: string, asked: Asked): ReviewReading {
  const decisions = new Set<"approve" | "reject">();
  let confidence: Confidence | undefined;
  const kept: string[] = [];
  // Sentences and their parts, each read from its first words on.
  for (const match of text.matchAll(/[^.;!?\n,]+/gu)) {
    const asksSomething = text[match.index + match[0].length] === "?";
    let rest = match[0].trim();
    for (let reading = true; reading && rest; ) {
      const plain = fold(rest).replace(/[:]/gu, "").replace(/\s+/gu, " ");
      const decided = asksSomething ? null : DECISION.exec(plain);
      const level = CONFIDENCE.exec(plain);
      const taken = decided ?? level;
      if (decided) decisions.add(decided[1] ? "approve" : "reject");
      else if (level) confidence = levelOf((level[1] ?? level[2]) as string);
      // The words read are as long in the answer as in their folded form, colons aside.
      const words = taken ? taken[0].split(" ").length : 0;
      reading = taken !== null;
      if (reading)
        rest = rest
          .split(/\s+/u)
          .slice(words)
          .join(" ")
          .replace(/^[:\s]+/u, "");
    }
    if (rest) kept.push(rest);
  }
  const reading: ReviewReading = {};
  if (decisions.size === 1) reading.decision = [...decisions][0] as "approve" | "reject";
  // A level on its own ("High.") is a confidence when that was asked, or beside a decision.
  const bare = kept.findIndex((part) => BARE_LEVEL.test(fold(part)));
  if (confidence === undefined && bare >= 0 && (asked === "confidence" || reading.decision)) {
    confidence = levelOf(fold(kept[bare] as string));
    kept.splice(bare, 1);
  }
  if (confidence !== undefined) reading.confidence = confidence;
  const feedback = kept.join(", ").trim();
  // What is left is feedback when feedback was asked, or when it comes with a decision.
  if (feedback && (asked === "feedback" || reading.decision || reading.confidence !== undefined))
    reading.feedback = feedback;
  // An answer that names both decisions anywhere, as "Approve. Actually reject." does, settles
  // neither: the question is asked again.
  const plain = fold(text);
  return SAYS_APPROVE.test(plain) && SAYS_REJECT.test(plain) ? {} : reading;
}
