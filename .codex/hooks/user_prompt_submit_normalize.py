#!/usr/bin/env python3
"""Normalize free-form user prompts into a compact task contract for Codex.

This hook is intentionally conservative:
- It never rewrites or blocks the user prompt.
- It adds structured developer context only when the prompt is not already
  written in a task-contract style.
- It preserves explicit technical anchors from the original prompt.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Iterable


PACKAGE_HINTS = (
    "packages/shared",
    "packages/client",
    "packages/admin",
    "packages/contracts",
    "packages/indexer",
    "packages/agent",
    "shared",
    "client",
    "admin",
    "contracts",
    "indexer",
    "agent",
    ".codex",
    ".claude",
)

ACTION_HINTS = (
    "add",
    "clean",
    "create",
    "enable",
    "fix",
    "format",
    "implement",
    "make",
    "normalize",
    "refactor",
    "remove",
    "rewrite",
    "support",
    "update",
    "wire",
)

SPEECHY_PREFIX = re.compile(
    r"^(?:please\s+)?(?:can|could|would|will)\s+you\s+|^how\s+can\s+we\s+|"
    r"^(?:i\s+think|ideally|basically|just|okay|ok|well|so)\b[\s,:-]*",
    re.IGNORECASE,
)

STRUCTURED_PROMPT = re.compile(
    r"(?im)^(goal|where|why|must keep|done when|if unclear)\s*:"
)

FILE_PATH = re.compile(
    r"(?:\./)?(?:packages|docs|scripts|tests|\.codex|\.claude)/[A-Za-z0-9_./-]+"
    r"|(?:[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|sol|toml|yml|yaml|graphql))"
)


def read_payload() -> dict:
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def strip_leading_discourse(text: str) -> str:
    cleaned = text.strip()
    for _ in range(4):
        updated = SPEECHY_PREFIX.sub("", cleaned).strip()
        if updated == cleaned:
            break
        cleaned = updated
    return cleaned


def split_sentences(text: str) -> list[str]:
    compact = normalize_ws(text)
    if not compact:
        return []
    parts = re.split(r"(?<=[.!?])\s+|(?:\s*;\s*)", compact)
    return [part.strip(" -") for part in parts if part.strip(" -")]


def first_non_empty(values: Iterable[str]) -> str | None:
    for value in values:
        normalized = normalize_ws(value)
        if normalized:
            return normalized
    return None


def infer_goal(prompt: str, sentences: list[str]) -> str:
    lowered_prompt = prompt.lower()
    candidate = first_non_empty(sentences) or prompt
    clauses = [
        strip_leading_discourse(part)
        for part in re.split(r"\s*,\s*", normalize_ws(candidate))
        if normalize_ws(part)
    ]

    preferred = first_non_empty(
        clause
        for clause in clauses
        if any(hint in clause.lower() for hint in ACTION_HINTS)
    )

    if preferred:
        candidate = preferred

    candidate = strip_leading_discourse(candidate)
    candidate = re.sub(r"^(?:but\s+)?it\s+gets\s+", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"^[\"'`]+|[\"'`]+$", "", candidate).strip()

    if "clean" in lowered_prompt and "format" in lowered_prompt and "sent" in lowered_prompt:
        candidate = "Clean up and format the prompt before it is sent"
    elif "automatic" in lowered_prompt and not candidate.lower().startswith(("make ", "enable ")):
        candidate = f"Make {candidate} automatic"

    if len(candidate) > 220:
        candidate = candidate[:217].rstrip() + "..."
    return candidate or "Infer the smallest concrete task from the user prompt."


def infer_where(prompt: str) -> str:
    found: list[str] = []
    seen: set[str] = set()

    for match in FILE_PATH.findall(prompt):
        value = match.strip().rstrip(".,:;")
        if value and value not in seen:
            seen.add(value)
            found.append(value)

    lowered = prompt.lower()
    for hint in PACKAGE_HINTS:
        if hint.lower() in lowered and hint not in seen:
            seen.add(hint)
            found.append(hint)

    if not found:
        return "Infer from repo context and keep the change inside the smallest sensible package boundary."
    return ", ".join(found[:6])


def infer_why(prompt: str, sentences: list[str]) -> str:
    patterns = (
        r"\bbecause\b\s+([^.!?]+)",
        r"\bso that\b\s+([^.!?]+)",
        r"\bto fix\b\s+([^.!?]+)",
        r"\bto make\b\s+([^.!?]+)",
        r"\bsince\b\s+([^.!?]+)",
    )

    for pattern in patterns:
        match = re.search(pattern, prompt, flags=re.IGNORECASE)
        if match:
            return normalize_ws(match.group(1))

    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in ("bug", "issue", "broken", "regression", "user", "so that")):
            return strip_leading_discourse(sentence)

    return "Not explicit in the prompt; infer the user-facing or engineering reason from local context."


def infer_constraints(prompt: str, sentences: list[str]) -> list[str]:
    clauses = re.split(r"(?<=[.!?])\s+|(?:\s*,\s*)|(?:\s*;\s*)", normalize_ws(prompt))
    results: list[str] = []
    seen: set[str] = set()
    markers = ("must", "keep", "without", "do not", "don't", "never", "preserve", "avoid", "leave", "only")

    for clause in clauses + sentences:
        cleaned = strip_leading_discourse(clause).strip()
        lowered = cleaned.lower()
        if len(cleaned) < 8:
            continue
        if any(marker in lowered for marker in markers):
            entry = cleaned[0].upper() + cleaned[1:]
            if entry not in seen:
                seen.add(entry)
                results.append(entry.rstrip("."))

    if not results:
        return ["Respect repo invariants from AGENTS.md and CLAUDE.md while inferring missing detail conservatively."]
    return results[:4]


def infer_done_when(prompt: str, sentences: list[str]) -> str:
    patterns = (
        r"\bdone when\b\s+([^.!?]+)",
        r"\bshould\b\s+([^.!?]+)",
        r"\bneeds to\b\s+([^.!?]+)",
        r"\bwant(?: it)? to\b\s+([^.!?]+)",
    )

    for pattern in patterns:
        match = re.search(pattern, prompt, flags=re.IGNORECASE)
        if match:
            return normalize_ws(match.group(1))

    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in ("test", "tests", "pass", "render", "works", "working", "verify", "validation")):
            return strip_leading_discourse(sentence)

    return "Confirm the requested behavior and run the lightest relevant validation for the touched scope."


def build_additional_context(prompt: str) -> str | None:
    normalized_prompt = normalize_ws(prompt)
    if not normalized_prompt:
        return None

    if STRUCTURED_PROMPT.search(prompt):
        return None

    sentences = split_sentences(prompt)
    goal = infer_goal(normalized_prompt, sentences)
    where = infer_where(normalized_prompt)
    why = infer_why(normalized_prompt, sentences)
    constraints = infer_constraints(normalized_prompt, sentences)
    done_when = infer_done_when(normalized_prompt, sentences)

    goal_key = normalize_ws(goal).rstrip(".?!").lower()
    filtered_constraints = [
        item
        for item in constraints
        if normalize_ws(item).rstrip(".?!").lower() != goal_key
    ]
    constraints = filtered_constraints or [
        "Respect repo invariants from AGENTS.md and CLAUDE.md while inferring missing detail conservatively."
    ]

    lines = [
        "Prompt normalization note:",
        "The user prompt may be conversational or speech-transcribed. Preserve exact technical nouns, file paths, commands, package names, APIs, and quoted constraints from the original prompt.",
        "",
        "Normalized task contract",
        f"Goal: {goal}",
        f"Where: {where}",
        f"Why: {why}",
        "Must keep:",
    ]
    lines.extend(f"- {constraint}" for constraint in constraints)
    lines.extend(
        [
            f"Done when: {done_when}",
            "",
            "If the goal or acceptance criteria are still ambiguous after repo inspection, ask a short clarifying question before editing files.",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    payload = read_payload()
    prompt = str(payload.get("prompt", "") or "")
    additional_context = build_additional_context(prompt)

    if not additional_context:
        return 0

    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": additional_context,
        }
    }
    json.dump(output, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
