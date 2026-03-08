# Acceptance Test Cases (QA Bridge)

Product-level acceptance criteria imported from CharmVerse QA. These complement the agent eval framework by providing **user story validation** — not just "can the agent write correct code?" but "does the feature work for users?"

## Source

**CharmVerse > Product > QA (Quality Analysis) > QA Test Cases**
Last synced: 2026-02-28

## How agents should use these

Before implementing or modifying a feature, agents should:

1. **Read the relevant test cases** from `test-cases.json` for the feature group
2. **Check preconditions** — understand what state the system must be in
3. **Validate against expected results** — ensure the implementation satisfies all listed expectations
4. **Respect UX notes** — these capture real user feedback and should inform UI decisions

## Maturity levels

| Level | Count | Meaning |
|-------|-------|---------|
| **Passed** | 8 | Fully specified: preconditions, steps, expected results, UX notes. Feature has been manually tested and verified. |
| **In Progress** | 6 | Full or near-full content, being actively tested. Treat as authoritative acceptance criteria. |
| **Ready** (stub) | 16 | Properties set (name, priority, roles, platform) but content is placeholder. Use as feature area guidance — the test case name and properties indicate what needs to work. |

## Feature group → package mapping

| Group | Packages | Cases |
|-------|----------|-------|
| Passkey Login | `client`, `shared` | 3 |
| Wallet Login | `client`, `shared` | 4 |
| App Logout | `client`, `shared` | 3 |
| Admin Wallet Login | `admin`, `shared` | 0 (empty) |
| Admin Logout | `admin`, `shared` | 0 (empty) |
| Submit Work | `client`, `shared`, `contracts` | 4 |
| Work Approval/Reject | `admin`, `shared`, `contracts` | 5 |
| Create Garden | `admin`, `shared`, `contracts` | 0 (empty) |
| View Gardens | `client`, `shared` | 4 |
| View Garden Work | `admin`, `shared` | 4 |
| View Garden Details | `client`, `admin`, `shared` | 3 |
| View Garden Assessment | `admin`, `shared` | 0 (empty) |
| View Garden Operators | `admin`, `shared` | 0 (empty) |
| View Work Dashboard | `client`, `shared` | 0 (empty) |
| Create Garden Assessment | `admin`, `shared`, `contracts` | 0 (empty) |
| Update Garden Operator | `admin`, `shared`, `contracts` | 0 (empty) |
| Create Action | `admin`, `shared`, `contracts` | 0 (empty) |

## Relationship to agent evals

```
Agent Evals (.claude/evals/)          Acceptance Criteria (.claude/evals/acceptance/)
├── Can the agent write correct code? ├── Does the feature work for users?
├── Tests agent capabilities          ├── Tests product behavior
├── Scored by rubric                  ├── Verified against user stories
└── Run after agent/model changes     └── Referenced during implementation
```

Agent evals verify that agents produce correct outputs. Acceptance criteria verify that those outputs satisfy real user needs. Together they form a complete validation loop.

## Maintenance

- Sync with CharmVerse quarterly (next: 2026-05-28)
- When new QA test cases are added in CharmVerse, append them here
- When stub cases get full content, update the `preconditions`, `steps`, `expected`, and `notes` fields
- Update `maturity` counts in `test-cases.json` header when cases change status
