const sentryDsn =
  process.env.VITE_SENTRY_ADMIN_DSN ||
  process.env.SENTRY_ADMIN_DSN ||
  process.env.SENTRY_DSN;

if (!sentryDsn) {
  throw new Error("Missing admin Sentry DSN for proof event");
}

const dsn = new URL(sentryDsn);
const projectId = dsn.pathname.replace(/^\//, "");
const sentryKey = dsn.username;
const ingestUrl = `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/?sentry_key=${sentryKey}&sentry_version=7&sentry_client=green-goods-admin-build-proof/1.0`;

const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "manual";
const shortSha = sha.slice(0, 12);
const release = `green-goods-admin@${shortSha}`;
const marker = `gg-admin-sentry-proof-build-20260528-${shortSha}`;
const eventId = crypto.randomUUID().replaceAll("-", "");
const timestamp = new Date().toISOString();
const event = {
  event_id: eventId,
  timestamp,
  platform: "javascript",
  level: "error",
  environment: "production",
  release,
  message: marker,
  exception: {
    values: [{ type: "Error", value: marker }],
  },
  tags: {
    app: "green-goods",
    surface: "admin",
    verification: "codex-admin-sentry-build-proof",
  },
  request: {
    url: "https://admin.greengoods.app/",
  },
};

const envelope = [
  JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: sentryDsn }),
  JSON.stringify({ type: "event" }),
  JSON.stringify(event),
].join("\n");

const response = await fetch(ingestUrl, {
  method: "POST",
  headers: { "content-type": "application/x-sentry-envelope" },
  body: envelope,
});
const body = await response.text();

console.log(
  JSON.stringify({
    sentryBuildProof: response.ok,
    sentryStatus: response.status,
    marker,
    eventId,
    release,
    projectId,
  })
);

if (!response.ok) {
  throw new Error(`Sentry build proof failed: ${response.status} ${body}`);
}
