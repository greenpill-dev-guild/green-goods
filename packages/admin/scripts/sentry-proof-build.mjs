const sentryDsn =
  "https://310b1a5a1f3f8b2c7208b4d08297f841@o4511459915726848.ingest.us.sentry.io/4511460330635264";
const ingestUrl =
  "https://o4511459915726848.ingest.us.sentry.io/api/4511460330635264/envelope/?sentry_key=310b1a5a1f3f8b2c7208b4d08297f841&sentry_version=7&sentry_client=green-goods-admin-build-proof/1.0";

const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "manual";
const release = `green-goods-admin@${sha.slice(0, 12)}`;
const marker = `gg-admin-sentry-proof-build-20260528-${sha.slice(0, 12)}`;
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
  })
);

if (!response.ok) {
  throw new Error(`Sentry build proof failed: ${response.status} ${body}`);
}
