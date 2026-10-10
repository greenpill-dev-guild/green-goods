#!/usr/bin/env bash
# PreToolUse gate for Linear issue writes.
#
# Reads a Claude Code hook payload on stdin and blocks `save_issue` calls whose
# title or description break the issue contract in
# `.claude/context/linear-routing-rules.md`. Exit 2 rejects the tool call and
# returns stderr to the model, which then rewrites and retries.
#
# Deliberately narrow. It checks shape — prefixes, heading count, length, lane
# metadata, empty scaffolding — never content quality, and it does not try to be
# a Markdown parser. Exotic syntax (Setext headings, nested or indented fences,
# keycap emoji) is out of scope on purpose: an agent writing an issue produces
# ordinary prose, and every rule added to catch a theoretical evasion is another
# rule that can misfire on a real body. A wrong block is the expensive failure
# here, because it leaves an agent in a retry loop it cannot reason its way out
# of. The contract is the standard; this is a backstop for the common cases.
#
# Skipped when the call carries no prose to judge — a state transition, a label
# change, or a property-only update.

set -uo pipefail

payload="$(cat)"

tool="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"
case "$tool" in
  *save_issue) ;;
  *) exit 0 ;;
esac

title="$(printf '%s' "$payload" | jq -r '.tool_input.title // empty')"
description="$(printf '%s' "$payload" | jq -r '.tool_input.description // empty')"
labels="$(printf '%s' "$payload" | jq -r '(.tool_input.labels // []) | join(",")')"
# Use a concrete fallback rather than `// empty`: on a missing key `empty`
# collapses the whole expression to no output, so the variable silently becomes
# "" and the check it guards never runs.
has_patch="$(printf '%s' "$payload" | jq -r 'if ((.tool_input.patch // []) | length) > 0 then "yes" else "no" end')"
# `id` distinguishes an update from a create. Only a create can be required to
# carry a body: an update may legitimately touch state, labels, or relations
# alone, and blocking those would wedge routine triage.
is_update="$(printf '%s' "$payload" | jq -r 'if (.tool_input.id // "") != "" then "yes" else "no" end')"
# An absent `description` key means "leave the body alone"; an explicitly empty
# one means "erase it". Only the second breaks the contract, and both render as
# "", so the key has to be probed separately.
sent_description="$(printf '%s' "$payload" | jq -r 'if (.tool_input | has("description")) then "yes" else "no" end')"

# Text a `patch` edit inserts. The ops carry a fragment, never the resulting
# document, so the cumulative caps cannot be evaluated against a replace
# fragment (it can shrink what it touches) — but the banned-token and
# metadata-stack rules run on every fragment, and an append-only fragment that
# alone breaches a cap proves the resulting body breaches it too.
patch_text="$(printf '%s' "$payload" | jq -r '[.tool_input.patch // [] | .[] | (.text // ""), (.new_string // "")] | join("\n")')"

# Just the append-family insertions, for the fragment-level cap checks below.
append_text="$(printf '%s' "$payload" | jq -r '[.tool_input.patch // [] | .[] | select((.op // "") | test("^(append|prepend)")) | (.text // ""), (.new_string // "")] | join("\n")')"

# Words a patch op deletes outright. Erasing a body via patch is the same
# destructive act as sending `description: ""`, which is rejected below, and it
# must not be cheaper to do the second way. Counted in words so a short body is
# still protected, while dropping a stray word stays ordinary editing — and
# summed across operations, so splitting one erase into several small
# deletions costs the same as doing it in one.
patch_deleted_words="$(printf '%s' "$payload" | jq -r '
  [ .tool_input.patch // []
    | .[]
    | select((.op // "") | test("^replace"))
    | select(((.new_string // "") | gsub("\\s"; "")) == "")
    | ((.old_string // .from // "") | [splits("\\s+")] | map(select(length > 0)) | length)
  ] | add // 0')"

# Nothing to judge: a property-only write. An explicitly supplied `description`
# still counts even when empty (that is an erase), and so does a delete-only
# patch, which has no inserted text to inspect.
if [ -z "$title" ] && [ -z "$description" ] && [ -z "${patch_text//[$'\r\n\t ']/}" ] &&
  [ "$sent_description" = "no" ] && [ "${patch_deleted_words:-0}" -eq 0 ]; then
  exit 0
fi

violations=""
add() { violations="${violations}  - $1"$'\n'; }

# The status markers that actually show up in this repo's routine templates and
# digests. A literal alternation rather than codepoint ranges: it covers what
# writers here really emit, and it cannot misclassify a curly quote or an em
# dash as an emoji the way a lead-byte or range test can.
EMOJI_ALTERNATION='⚡|🔴|🟡|🟢|🟠|🔵|⚪|⚫|✅|❌|⚠|🚨|🔥|📊|📈|📉|💡|🎯|🚀|✨|⭐|🌱|🌍|♻'

starts_with_emoji() {
  printf '%s' "$1" | grep -qE "^[[:space:]]*($EMOJI_ALTERNATION)"
}

# Blank out fenced code blocks, keeping line numbering intact, so a shell
# example's `## step` comments are not counted as headings. A plain toggle:
# nested and indented fences are not handled, and do not need to be.
strip_fenced_code() {
  printf '%s\n' "$1" | awk '
    /^[[:space:]]*(```|~~~)/ { fenced = !fenced; print ""; next }
    fenced { print ""; next }
    { print }
  '
}

# The lane-metadata field labels. Shared by the body rules below and the
# patch-fragment stack check: the label is what makes a line metadata, not the
# formatting around its value.
meta_re='^[[:space:]]*(Source plan|Source|Status JSON|Lane|Owner/status|Owner|Handoff|Plan hub):[[:space:]]*[`.a-zA-Z0-9]'

# --- Title -----------------------------------------------------------------
# Trim first: every rule below is anchored, so an untrimmed title would slip all
# of them while reaching Linear looking exactly as prefixed.
title="${title#"${title%%[![:space:]]*}"}"
title="${title%"${title##*[![:space:]]}"}"

if [ -n "$title" ]; then
  # Retired 2026-08-27: prefixes are carried by labels and state, not the title.
  if printf '%s' "$title" | grep -qiE '^\[tracking\]'; then
    add "Title starts with [tracking]. That prefix is retired — the 'maintenance' label plus Backlog state already say this is uncommitted signal."
  fi
  # Lane names, record types, work types, package names, and team names — the
  # categories Linear's own fields already carry. Enumerated rather than matched
  # as a generic `Word:` shape, because a colon is legitimate inside a real
  # sentence ("Garden join fails at one step: the passkey prompt never resolves")
  # and blocking those would cost more than the prefixes do.
  if printf '%s' "$title" | grep -qiE '^(plan|backlog|idea|ui|ux|state/api|contracts|docs|documentation|community|editorial|release ops|release|qa pass [0-9]+|qa|chore|spike|recurring|epic|ethonline|bug|fix|hotfix|feature|task|improvement|refactor|incident|research|design|infra|ops|security|perf|performance|test|a11y|i18n|admin|client|shared|indexer|agent|network|growth|marketing)[[:space:]]*:'; then
    add "Title starts with a lane, record-type, or category prefix. Write what a person would say broke or should exist; labels and Linear's own fields carry the rest."
  fi
  # Bare (`P1 …`, `P0: …`) and bracketed (`[P1] …`) review-style forms alike.
  if printf '%s' "$title" | grep -qE '^\[?P[0-9]\]?[[:space:]:]'; then
    add "Title carries a priority prefix. Linear's priority field owns that."
  fi
  if starts_with_emoji "$title"; then
    add "Title starts with an emoji. Plain text only."
  fi
fi

# Roadmap trackers legitimately run long; they still obey the heading cap and
# the banned-token rules. `plans` alone is not the signal — plan-hub stamps it
# on every mirror including lane issues, so exempting on it would lift the
# ceiling for ordinary build and QA work. The roadmap parent is the only
# mirror also carrying the architecture label. `save_issue` accepts label IDs
# too, which the gate cannot resolve, so a roadmap title is the fallback.
# Computed here so both the body word cap and the append-fragment cap share it.
is_umbrella=no
case ",$labels," in
  *,plans,* | *,source:plans,*)
    case ",$labels," in
      *,architecture,* | *,activity:architecture,*) is_umbrella=yes ;;
    esac
    ;;
esac
if [ "$is_umbrella" = "no" ] && printf '%s' "$title" | grep -qiE '(^|[[:space:]])roadmap$'; then
  is_umbrella=yes
fi
# QA session reports (the call-report parent issue) legitimately run long too:
# coverage rollups, call decisions, and a slice index. Title-matched for the
# same reason as roadmap — label IDs are unresolvable here — and the required
# date keeps the pattern specific enough that ordinary defect titles cannot
# drift into it. Anchored: only the ` · N` same-day-call counter may follow
# the date — a free-form suffix would turn the exemption into an unbounded
# title prefix.
# Every exemption resolves from the payload alone (the gate cannot fetch the
# issue), so an update that rewrites an exempt body past the word backstop must
# resend the unchanged title — or labels, for the label-based umbrella. The
# templates document this; append fragments under the backstop pass regardless.
if [ "$is_umbrella" = "no" ] && printf '%s' "$title" | grep -qE '^QA session [0-9]{4}-[0-9]{2}-[0-9]{2}( · [0-9]+)?$'; then
  is_umbrella=yes
fi

# A create must carry the problem/outcome block; the contract calls it the one
# section that is never optional. An update may touch state, labels, or
# relations alone, so only creates are required to have a body.
if [ "$is_update" = "no" ] && [ -z "${description//[$'\r\n\t ']/}" ] && [ "$has_patch" = "no" ]; then
  add "New issue has no body. Say what breaks and for whom, or what should exist and why — that block is never optional."
elif [ "$is_update" = "yes" ] && [ "$sent_description" = "yes" ] && [ -z "${description//[$'\r\n\t ']/}" ]; then
  add "This update erases the body. The problem/outcome block is never optional — rewrite it rather than blanking it."
fi

if [ "${patch_deleted_words:-0}" -ge 5 ]; then
  add "This patch deletes $patch_deleted_words words of the body without replacing them. Send the full description instead, so the result can be checked against the contract."
fi

# Rules that hold for any prose the call carries, whether it replaces the body
# or patches into it. Every rule reads fence-stripped prose: quoting a banned
# token inside a code example is describing it, not adopting it, and blocking
# the description is the expensive failure the header warns about.
check_banned_tokens() {
  scope="$1"
  text="$2"
  [ -n "$text" ] || return 0
  prose="$(strip_fenced_code "$text")"

  if printf '%s' "$prose" | grep -qE 'status\.json|execution_sub_lanes|laneSyncMode|plan\.todo\.md'; then
    add "$scope cites plan-hub internals (status.json / execution_sub_lanes). Link the plan directory instead."
  fi
  if printf '%s' "$prose" | grep -qE '\bW[0-9]{1,2}\b'; then
    add "$scope uses screen codes (W12 and similar). Use the screen's human name."
  fi
  # The named shorthand from AGENTS.md. Deliberately NOT a bare `#\d+` ban — a
  # PR reference ("regressed in #778") is legitimate and useful.
  if printf '%s' "$prose" | grep -qE '§[0-9]'; then
    add "$scope carries a spec citation (§5.1). Drop it, or link the file if the reader truly needs it."
  fi
  if printf '%s' "$prose" | grep -qiE '\bregister #[0-9]+|\bdecision[ -]log #?[0-9]+'; then
    add "$scope cites internal shorthand (register #90, decision log 4). Those live in .plans — say what it means, or link the file."
  fi
  # Empty scaffolding — the failure that produced sections reading "—" and
  # paragraphs explaining that telemetry found nothing. Bare and list-form alike.
  if printf '%s' "$prose" | grep -qiE '^[[:space:]]*([-*+]|[0-9]+\.)?[[:space:]]*(—|-|N/A|TBD|None|needs repro|needs definition|needs investigation)[[:space:]]*$'; then
    add "$scope renders an empty section placeholder. Drop the section instead — a heading with nothing under it costs the reader a stop."
  fi
  # Same 0-3 space indent bound as the heading counter: four or more spaces is
  # indented code in Markdown, not a heading, and must not trip the emoji rule.
  if printf '%s\n' "$prose" | grep -E '^ {0,3}#{1,6}[[:space:]]' | grep -qE "($EMOJI_ALTERNATION)"; then
    add "$scope has an emoji heading. Plain headings only."
  fi
}

# --- Body ------------------------------------------------------------------
if [ -n "$description" ]; then
  # Counted on fence-stripped prose so a code example is not read as structure.
  # A tab delimits an ATX heading just as a space does.
  description_prose="$(strip_fenced_code "$description")"
  headings=$(printf '%s\n' "$description_prose" | grep -cE '^ {0,3}#{1,6}([[:space:]]|$)' || true)
  words=$(printf '%s' "$description" | wc -w | tr -d ' ')

  if [ "$headings" -gt 6 ]; then
    add "Body has $headings headings (backstop 6). Keep it clear and simple — most defects need none: problem, 'Done when', one source line."
  fi
  if [ "$is_umbrella" = "no" ] && [ "$words" -gt 600 ]; then
    add "Body is $words words (backstop 600). Keep it clear, simple, concise — move evidence dumps, repro transcripts, and file inventories into the first comment. (Umbrella trackers labeled plans + architecture, roadmap-titled parents, and 'QA session YYYY-MM-DD' reports are exempt.)"
  fi

  # Lane metadata: the tokens that made plan mirrors unreadable in the
  # 2026-08-27 board audit. One trailing link line ("Handoff: `path`") is fine;
  # what broke those issues was a body that OPENED with metadata, or stacked
  # several such lines where the problem statement should have been.
  first_line="$(printf '%s\n' "$description_prose" | grep -vE '^[[:space:]]*$' | head -1)"
  meta_count=$(printf '%s\n' "$description_prose" | grep -cE "$meta_re" || true)

  if printf '%s' "$first_line" | grep -qE "$meta_re"; then
    add "Body opens with lane metadata instead of the problem. Lead with what breaks or what should exist; put the link at the end."
  elif [ "$meta_count" -ge 2 ]; then
    add "Body stacks $meta_count metadata lines (Source / Lane / Owner / Handoff). Say what matters in a sentence and keep one link line at most."
  fi

  check_banned_tokens "Body" "$description"
fi

if [ -n "${patch_text//[$'\r\n\t ']/}" ]; then
  check_banned_tokens "Patched text" "$patch_text"
  # The metadata-STACK rule also holds on a fragment: two or more field lines in
  # the inserted text restore exactly the stacks the body rule rejects. The
  # opens-with rule stays description-only — position needs the whole body.
  patch_prose="$(strip_fenced_code "$patch_text")"
  patch_meta=$(printf '%s\n' "$patch_prose" | grep -cE "$meta_re" || true)
  if [ "${patch_meta:-0}" -ge 2 ]; then
    add "Patched text stacks $patch_meta metadata lines (Source / Lane / Owner / Handoff). Say what matters in a sentence and keep one link line at most."
  fi

  # Caps on append fragments. An append cannot remove existing content, so a
  # fragment that alone breaches a cumulative cap proves the resulting body
  # breaches it too — the one case where fragment-level cap checks are sound.
  # Replace fragments stay exempt: they can shrink what they touch.
  if [ -n "${append_text//[$'\r\n\t ']/}" ]; then
    append_prose="$(strip_fenced_code "$append_text")"
    append_headings=$(printf '%s\n' "$append_prose" | grep -cE '^ {0,3}#{1,6}([[:space:]]|$)' || true)
    append_words=$(printf '%s' "$append_text" | wc -w | tr -d ' ')
    if [ "${append_headings:-0}" -gt 6 ]; then
      add "Appended text alone carries $append_headings headings — the whole body's backstop is 6. Send the full description instead, so the result can be checked against the contract."
    fi
    if [ "$is_umbrella" = "no" ] && [ "${append_words:-0}" -gt 600 ]; then
      add "Appended text alone is $append_words words — the whole body's backstop is 600. Move the evidence to the first comment, or send the full description."
    fi
  fi
fi

if [ -n "$violations" ]; then
  {
    echo "BLOCKED: this Linear issue breaks the issue contract."
    echo
    printf '%s' "$violations"
    echo "Contract: .claude/context/linear-routing-rules.md § Issue structure"
    echo "Shape: problem or outcome in plain prose -> 'Done when' bullets -> one source line."
    echo "Rewrite and call save_issue again."
  } >&2
  exit 2
fi

exit 0
