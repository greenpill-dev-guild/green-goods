#!/usr/bin/env node

const ADMIN_PROJECT_ID = process.env.POSTHOG_ADMIN_PROJECT_ID || "262122";
const CLIENT_PROJECT_ID = process.env.POSTHOG_CLIENT_PROJECT_ID || "163591";

const adminRoutes = [
  "/hub/work",
  "/hub/assess",
  "/hub/certify",
  "/hub/history",
  "/garden/overview",
  "/garden/impact",
  "/garden/settings",
  "/community/treasury",
  "/community/governance",
  "/community/payouts",
  "/community/members",
  "/actions",
];

const clientRoutes = ["/gardens", "/impact", "/fund", "/actions"];

const staleRouteCandidates = [
  "/work",
  "/dashboard",
  "/hub/actions",
  "/garden",
  "/community",
];

const privacyTerms = [
  "distinct_id",
  "wallet",
  "walletAddress",
  "session_recording",
  "recording",
  "replay",
  "person_id",
  "person.properties",
];

function normalizeHost(host) {
  if (!host) return null;
  const trimmed = host.replace(/\/+$/, "");
  if (trimmed === "https://us.i.posthog.com") return "https://us.posthog.com";
  if (trimmed === "https://eu.i.posthog.com") return "https://eu.posthog.com";
  return trimmed;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const token =
  process.env.POSTHOG_ANALYTICS_READ_KEY ||
  process.env.POSTHOG_ANALYTICS_KEY ||
  process.env.POSTHOG_ANALYTIC_KEY ||
  process.env.POSTHOG_API_KEY ||
  process.env.POSTHOG_PROJECT_API_KEY ||
  process.env.POSTHOG_CLI_TOKEN;

if (!token) {
  console.error(
    "Missing a PostHog API token. Set POSTHOG_ANALYTICS_READ_KEY, POSTHOG_ANALYTICS_KEY, POSTHOG_ANALYTIC_KEY, POSTHOG_API_KEY, POSTHOG_PROJECT_API_KEY, or POSTHOG_CLI_TOKEN."
  );
  process.exit(2);
}

const hosts = unique([
  normalizeHost(process.env.POSTHOG_HOST),
  normalizeHost(process.env.VITE_POSTHOG_HOST),
  "https://us.posthog.com",
  "https://app.posthog.com",
]);

async function requestJson(host, path, init = {}) {
  const url = path.startsWith("http") ? path : `${host}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 250)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function findHost() {
  const errors = [];
  for (const host of hosts) {
    try {
      await requestJson(host, `/api/projects/${ADMIN_PROJECT_ID}/`);
      return host;
    } catch (error) {
      errors.push(`${host}: ${error.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Could not authenticate to any PostHog host:\n${errors.join("\n")}`);
}

async function queryProject(host, projectId, query) {
  return requestJson(host, `/api/projects/${projectId}/query/`, {
    method: "POST",
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });
}

function rowsFromQuery(result) {
  const columns = result?.columns || [];
  const rows = result?.results || [];
  return rows.map((row) => Object.fromEntries(row.map((value, index) => [columns[index], value])));
}

async function pageViewsByPath(host, projectId, app) {
  const query = `
    SELECT
      properties['path'] AS path,
      count() AS event_count,
      max(timestamp) AS last_seen
    FROM events
    WHERE event = 'page_view'
      AND properties['app'] = '${app}'
      AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY path
    ORDER BY event_count DESC
    LIMIT 500
  `;
  return rowsFromQuery(await queryProject(host, projectId, query));
}

async function paginated(host, startPath) {
  const out = [];
  let next = startPath;
  while (next) {
    const page = await requestJson(host, next);
    out.push(...(page?.results || []));
    next = page?.next || null;
  }
  return out;
}

function routeSummary(rows, routes) {
  return routes.map((route) => {
    const matching = rows.filter((row) => String(row.path || "").startsWith(route));
    const count = matching.reduce((sum, row) => sum + Number(row.event_count || 0), 0);
    const lastSeen = matching
      .map((row) => row.last_seen)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { route, seen: count > 0, count, lastSeen: lastSeen || null };
  });
}

function scanObjects(objects, terms) {
  return objects
    .map((object) => {
      const text = JSON.stringify(object);
      const matches = terms.filter((term) => text.includes(term));
      return {
        id: object.id,
        name: object.name || object.title || object.short_id || String(object.id),
        url: object.short_id ? `/insights/${object.short_id}` : null,
        matches,
      };
    })
    .filter((entry) => entry.matches.length > 0);
}

function printRouteSummary(label, summary) {
  console.log(`\n${label}`);
  for (const row of summary) {
    const status = row.seen ? "OK" : "MISSING";
    console.log(
      `- ${status} ${row.route} count=${row.count} lastSeen=${row.lastSeen || "n/a"}`
    );
  }
}

const host = await findHost();
const adminRows = await pageViewsByPath(host, ADMIN_PROJECT_ID, "admin");
const clientRows = await pageViewsByPath(host, CLIENT_PROJECT_ID, "client");
const adminDashboards = await paginated(host, `/api/projects/${ADMIN_PROJECT_ID}/dashboards/?limit=100`);
const clientDashboards = await paginated(host, `/api/projects/${CLIENT_PROJECT_ID}/dashboards/?limit=100`);
const adminInsights = await paginated(host, `/api/projects/${ADMIN_PROJECT_ID}/insights/?limit=200`);
const clientInsights = await paginated(host, `/api/projects/${CLIENT_PROJECT_ID}/insights/?limit=200`);

const dashboards = [...adminDashboards, ...clientDashboards];
const insights = [...adminInsights, ...clientInsights];

console.log("PostHog checklist result");
console.log(`Host: ${host}`);
console.log(`Admin project: ${ADMIN_PROJECT_ID}`);
console.log(`Client project: ${CLIENT_PROJECT_ID}`);
console.log(`Dashboards fetched: ${dashboards.length}`);
console.log(`Insights fetched: ${insights.length}`);

printRouteSummary("Admin page_view routes, last 30 days", routeSummary(adminRows, adminRoutes));
printRouteSummary("Client page_view routes, last 30 days", routeSummary(clientRows, clientRoutes));

const staleDashboardRefs = scanObjects(dashboards, staleRouteCandidates);
const staleInsightRefs = scanObjects(insights, staleRouteCandidates);
const privacyDashboardRefs = scanObjects(dashboards, privacyTerms);
const privacyInsightRefs = scanObjects(insights, privacyTerms);

console.log("\nPossible stale dashboard route references");
console.log(JSON.stringify(staleDashboardRefs, null, 2));

console.log("\nPossible stale insight/funnel route references");
console.log(JSON.stringify(staleInsightRefs, null, 2));

console.log("\nPossible privacy-sensitive dashboard references");
console.log(JSON.stringify(privacyDashboardRefs, null, 2));

console.log("\nPossible privacy-sensitive insight/funnel references");
console.log(JSON.stringify(privacyInsightRefs, null, 2));
