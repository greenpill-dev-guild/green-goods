# verify-green-goods

Proof that a feature works, gathered by driving the app the way a person does. It starts the Green Goods App or Hub in test mode on its own ports, signs in with a mock role, walks a mapped feature in Chromium with fixed fixture data, and keeps the screenshots and page snapshots after it shuts down.

**When to use it:** To show a UI change or a feature working before review, or to check a flow without live services or a wallet.

**What you get:** A transcript, page snapshots and screenshots at phone and desktop width, labeled as mock-auth localhost proof.

**How to invoke:** Type `/verify-green-goods <feature>` or ask to verify a flow in the app.

[`SKILL.md`](./SKILL.md) in this folder is the executable contract; this README is the human
summary the [Skills Catalog](https://docs.greengoods.app/builders/agentic/skills) projects.
