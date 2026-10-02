/**
 * Scripted walkthrough against the loopback driver: a gardener tells a story with a photo,
 * corrects it, links a wallet, publishes, and a steward reviews the published work. Every step is
 * a real HTTP request to the driver, and every chat reply is printed. The chain, wallets, catalog
 * and transport are fixtures, so the transcript shows orchestration, never live compatibility.
 *
 *   bun run --cwd packages/agent reporting:walkthrough
 *   bun --env-file=.env packages/agent/src/__tests__/reporting/driver/walkthrough.ts --models
 * The second command sends only six synthetic text cases to the pinned providers and prints
 * metrics. It never starts this HTTP driver or sends anything to a chat or a chain.
 */

interface Message {
  index: number;
  text: string;
  choices: Array<{ id: string; label: string }>;
  link: { url: string; label: string } | null;
}

type Log = (line: string) => void;

class Browser {
  private readonly cookies = new Map<string, string>();
  csrf: string | null = null;
  challengeId: string | null = null;

  constructor(
    private readonly base: string,
    private readonly origin: string
  ) {}

  async call<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
    bootstrap = false
  ) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      origin: this.origin,
    };
    if (this.csrf) headers["x-gg-csrf"] = this.csrf;
    if (bootstrap) headers["x-gg-bootstrap"] = "1";
    if (this.cookies.size)
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, value = ""] = (pair ?? "").split("=");
      if (name) this.cookies.set(name.trim(), value);
    }
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
  }

  async open(link: string) {
    const requestId = link.split("/").at(-1);
    const opened = await this.call("POST", "/api/messaging/challenges", { requestId }, true);
    this.csrf = String(opened.body.csrfToken ?? "");
    this.challengeId = String(opened.body.challengeId ?? "");
    return opened;
  }

  async prove(wallet: "ada" | "steward") {
    const signed = await fetch(`${this.base}/__driver/wallets/${wallet}/prove`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: this.challengeId }),
    }).then((response) => response.json() as Promise<{ account: string; signature: string }>);
    return this.call("POST", `/api/messaging/challenges/${this.challengeId}/proof`, signed);
  }

  async access() {
    const access = await this.call("POST", "/api/messaging/access", {
      challengeId: this.challengeId,
    });
    this.csrf = String(access.body.csrfToken ?? this.csrf);
    return access;
  }
}

export async function runWalkthrough(base: string, log: Log = console.log): Promise<Message[]> {
  const { DRIVER_API_TOKEN } = await import("./server");
  let seen = 0;
  let counter = 0;
  const transcript: Message[] = [];

  async function settle(): Promise<Message[]> {
    for (let pass = 0; pass < 20; pass += 1) {
      const summary = (await fetch(`${base}/__driver/tick`, { method: "POST" }).then((r) =>
        r.json()
      )) as Record<string, number>;
      if (Object.values(summary).every((count) => count === 0)) break;
    }
    const fresh = (await fetch(`${base}/__driver/outbox?since=${seen}`).then((r) =>
      r.json()
    )) as Message[];
    seen += fresh.length;
    for (const message of fresh) log(`  agent: ${message.text.replaceAll("\n", "\n         ")}`);
    transcript.push(...fresh);
    return fresh;
  }

  async function say(
    chat: string,
    subject: string,
    text: string,
    extra: Record<string, unknown> = {}
  ) {
    counter += 1;
    log(`${chat}: ${text || "(attachment)"}`);
    await fetch(`${base}/__synthetic/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "message",
        providerRealm: "whatsapp-fixture:wefa",
        eventId: `walk-${counter}`,
        providerMessageId: `walk-in-${counter}`,
        chat: { externalChatId: chat, kind: "direct" },
        sender: { externalSubjectId: subject },
        sentAt: Date.now(),
        ...(text ? { text } : {}),
        ...extra,
      }),
    });
    return settle();
  }

  const press = (chat: string, subject: string, label: string) => {
    const offer = [...transcript]
      .reverse()
      .find((message) => message.choices.some((choice) => choice.label === label));
    const choice = offer?.choices.find((candidate) => candidate.label === label);
    if (!choice) throw new Error(`No button labelled ${label}`);
    return say(chat, subject, label, { replyId: choice.id });
  };
  const token = (messages: Message[], word: string) => {
    const match = [...messages]
      .reverse()
      .map((message) => new RegExp(`${word} (\\d{4,6})`).exec(message.text)?.[1])
      .find(Boolean);
    if (!match) throw new Error(`No ${word} token in the latest replies`);
    return match;
  };
  const link = () => {
    const message = [...transcript].reverse().find((candidate) => candidate.link);
    if (!message?.link) throw new Error("No link was sent");
    return message.link.url;
  };

  async function signAndSend(
    wallet: "ada" | "steward",
    resource: "drafts" | "reviews"
  ): Promise<void> {
    const browser = new Browser(base, new URL(link()).origin);
    await browser.open(link());
    await browser.prove(wallet);
    const access = await browser.access();
    const scope = access.body.scope as { resourceId: string };
    const view = await browser.call<{
      operation: {
        operationId: string;
        attemptVersion: number;
        envelope: { payloadDigest: string; call: { to: string; data: string } };
      };
    }>("GET", `/api/messaging/${resource}/${scope.resourceId}`);
    const { operation } = view.body;
    log(
      `  browser: signs ${resource === "drafts" ? "work" : "review"} envelope ${operation.envelope.payloadDigest.slice(0, 18)}…`
    );
    const attempt = await browser.call<{ attemptId: string }>(
      "POST",
      `/api/messaging/operations/${operation.operationId}/attempts`,
      {
        expectedAttemptVersion: operation.attemptVersion,
        payloadDigest: operation.envelope.payloadDigest,
        idempotencyKey: `walk-attempt-${wallet}`,
      }
    );
    const sent = (await fetch(`${base}/__driver/chain/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet,
        to: operation.envelope.call.to,
        data: operation.envelope.call.data,
      }),
    }).then((response) => response.json())) as { transactionHash: string };
    await browser.call("POST", `/api/messaging/operations/${operation.operationId}/outcome`, {
      attemptId: attempt.body.attemptId,
      idempotencyKey: `walk-outcome-${wallet}`,
      payloadDigest: operation.envelope.payloadDigest,
      outcome: { kind: "broadcast", transactionHash: sent.transactionHash },
    });
    await settle();
  }

  const ADA = ["chat-ada", "+2340000000001"] as const;
  const STEWARD = ["chat-steward", "+2340000000002"] as const;

  log("\n— Story, photo and questions —");
  await say(...ADA, "Today I planted twelve baobab seedlings by the fence");
  await press(...ADA, "I agree");
  await say(...ADA, "1");
  await press(...ADA, "Tree planting");
  await fetch(`${base}/__driver/media/photo-1/sample-photo`, { method: "POST" });
  await say(...ADA, "", { media: [{ providerMediaId: "photo-1", declaredMime: "image/jpeg" }] });
  await say(...ADA, "12");
  await say(...ADA, "2");
  await say(...ADA, "3 hours");

  log("\n— Correction and confirmation —");
  await press(...ADA, "Edit");
  await press(...ADA, "Seedlings planted");
  const summary = await say(...ADA, "14");
  await say(...ADA, `CONFIRM ${token(summary, "CONFIRM")}`);

  log("\n— Link the wallet in the browser, then pair in chat —");
  const linking = new Browser(base, new URL(link()).origin);
  await linking.open(link());
  const proof = await linking.prove("ada");
  log(`  browser: shows pairing code ${String(proof.body.pairingCode)}`);
  const consent = await say(...ADA, `PAIR ${String(proof.body.pairingCode)}`);
  await say(...ADA, `PUBLISH ${token(consent, "PUBLISH")}`);

  log("\n— Owner signs the exact publication —");
  await signAndSend("ada", "drafts");

  log("\n— Steward review —");
  await say(...STEWARD, "REVIEW");
  await press(...STEWARD, "I agree");
  const stewardLink = new Browser(base, new URL(link()).origin);
  await stewardLink.open(link());
  const stewardProof = await stewardLink.prove("steward");
  await say(...STEWARD, `PAIR ${String(stewardProof.body.pairingCode)}`);
  await say(...STEWARD, "REVIEW");
  await say(...STEWARD, "1");
  await press(...STEWARD, "Approve");
  await press(...STEWARD, "High");
  const review = await say(...STEWARD, "Clear photos and counts, thank you");
  await say(...STEWARD, `CONFIRM ${token(review, "CONFIRM")}`);
  await signAndSend("steward", "reviews");

  log("\n— Operator view —");
  const health = await fetch(`${base}/reporting/ops/health`, {
    headers: { authorization: `Bearer ${DRIVER_API_TOKEN}` },
  }).then((response) => response.json());
  log(`  operations: ${JSON.stringify((health as { operations: unknown }).operations)}`);
  return transcript;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--models") {
    const { runModelEvaluation } = await import("./model-evaluation");
    try {
      const report = await runModelEvaluation(process.env);
      console.log(JSON.stringify(report, null, 2));
      if (!report.qualityPassed) process.exitCode = 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Model evaluation could not start");
      process.exitCode = 1;
    }
  } else if (args.length) {
    console.error("Usage: reporting:walkthrough [--models]");
    process.exitCode = 1;
  } else {
    const { startDriver } = await import("./server");
    const driver = await startDriver({ port: 0 });
    try {
      await runWalkthrough(driver.url);
      console.log("\nWalkthrough complete (fixture chain, fixture wallets, recorded transport).");
    } finally {
      await driver.stop();
    }
  }
}
