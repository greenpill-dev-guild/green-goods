# AI-Native Developer Workflow Spec

## Summary

Create a repo-native operating layer for AI-era development in Green Goods. This hub improves the existing `.plans` workflow instead of replacing it. Runtime code, product behavior, and package contracts remain untouched until a lane explicitly scopes them.

## Users

- Primary: humans and agents coordinating active feature work.
- Secondary: reviewers who need fast proof of intent, scope, validation, and residual risk.

## Functional Requirements

1. Add an Agent Run Ledger template that records goal, agent role, context packet, files touched, commands run, failures, verification cost, and follow-up rule updates.
2. Add a Workflow Scorecard template that tracks cycle time, review findings, tests added, verification commands, regressions caught, and human rework.
3. Add an Adversarial Review surface for read-only privacy, security, public-contract leakage, UX/accessibility, and scope-drift review.
4. Define a Closeout Gate: no lane can be marked complete unless spec, implementation notes, eval evidence, and QA notes agree.
5. Define a Rule Feedback Loop: repeated agent failures become targeted updates to the repo's existing guidance, skills, or validators.

## Research Evidence

- Existing `.plans` workflow remains the repo truth.
- Current plan validator: `node scripts/harness/plan-hub.mjs validate`.
- This pass is planning/process infrastructure only; no runtime code is changed.

## Human Judgment Points

- Which active feature becomes the first ledger/scorecard baseline.
- Which failure patterns deserve durable guidance updates versus one-off notes.
- Whether an adversarial review finding is a blocker or a recorded follow-up.

## Non-Functional Constraints

- Preserve the existing repo plan schema and validator.
- Do not create a cross-repo mega-plan or a separate memory truth surface.
- Keep process additions small enough that agents actually use them.
- Keep adversarial review read-only until the user explicitly approves fixes.

## Repo Focus

Green Goods should prove that agentic work is measurable without weakening `.plans` as the source of truth or adding a second repo-memory layer.

## Acceptance Criteria

- This hub validates with the repo's plan validator.
- Agent ledger, scorecard, adversarial review, closeout gate, and rule feedback artifacts exist.
- One selected active feature is identified before week-two adoption starts.
- Proof limits are explicit when no runtime behavior has been changed.
