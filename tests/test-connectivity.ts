#!/usr/bin/env tsx

/**
 * Service Connectivity Test
 *
 * Validates connectivity check logic for all Green Goods services.
 * Run with: bun tests/test-connectivity.ts
 */
import * as http from "node:http";
import * as https from "node:https";

interface ServiceResult {
  status: number | null;
  protocol: string;
  error: string | null;
}

interface TestResults {
  indexer: ServiceResult;
  client: ServiceResult;
  admin: ServiceResult;
}

async function testConnectivity(): Promise<boolean> {
  console.log("🧪 Testing service connectivity...\n");

  const results: TestResults = {
    indexer: { status: null, protocol: "HTTP", error: null },
    client: { status: null, protocol: "HTTPS", error: null },
    admin: { status: null, protocol: "HTTPS", error: null },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Test Indexer (HTTP on port 8080)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("📊 Testing Indexer (port 8080)...");
  try {
    results.indexer = await new Promise<ServiceResult>((resolve) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 8080,
          path: "/v1/graphql",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          timeout: 5000,
        },
        (res) => {
          console.log(`   HTTP Status: ${res.statusCode}`);
          resolve({ status: res.statusCode!, protocol: "HTTP", error: null });
        }
      );

      req.on("error", (err) => {
        console.log(`   Error: ${err.message}`);
        resolve({ status: null, protocol: "HTTP", error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        console.log("   Timeout");
        resolve({ status: null, protocol: "HTTP", error: "timeout" });
      });

      req.write(JSON.stringify({ query: "query { __typename }" }));
      req.end();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   Exception: ${message}`);
    results.indexer.error = message;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Client (HTTPS on port 3001)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n🌐 Testing Client (port 3001)...");
  try {
    results.client = await new Promise<ServiceResult>((resolve) => {
      const req = https.request(
        {
          hostname: "localhost",
          port: 3001,
          path: "/",
          method: "GET",
          timeout: 5000,
          rejectUnauthorized: false, // Accept self-signed certs from mkcert
        },
        (res) => {
          console.log(`   HTTPS Status: ${res.statusCode}`);
          resolve({ status: res.statusCode!, protocol: "HTTPS", error: null });
        }
      );

      req.on("error", (err) => {
        console.log(`   Error: ${err.message}`);
        resolve({ status: null, protocol: "HTTPS", error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        console.log("   Timeout");
        resolve({ status: null, protocol: "HTTPS", error: "timeout" });
      });

      req.end();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   Exception: ${message}`);
    results.client.error = message;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Admin (HTTPS on port 3002)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n🔧 Testing Admin (port 3002)...");
  try {
    results.admin = await new Promise<ServiceResult>((resolve) => {
      const req = https.request(
        {
          hostname: "localhost",
          port: 3002,
          path: "/",
          method: "GET",
          timeout: 5000,
          rejectUnauthorized: false,
        },
        (res) => {
          console.log(`   HTTPS Status: ${res.statusCode}`);
          resolve({ status: res.statusCode!, protocol: "HTTPS", error: null });
        }
      );

      req.on("error", (err) => {
        console.log(`   Error: ${err.message}`);
        resolve({ status: null, protocol: "HTTPS", error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        console.log("   Timeout");
        resolve({ status: null, protocol: "HTTPS", error: "timeout" });
      });

      req.end();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   Exception: ${message}`);
    results.admin.error = message;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));

  const isOk = (r: ServiceResult): boolean => r.status !== null && r.status < 500;

  console.log(`  Indexer: ${isOk(results.indexer) ? "✅ Available" : "❌ Not available"}`);
  console.log(`  Client:  ${isOk(results.client) ? "✅ Available" : "❌ Not available"}`);
  console.log(`  Admin:   ${isOk(results.admin) ? "✅ Available" : "❌ Not available"}`);

  const allOk = isOk(results.indexer) && isOk(results.client) && isOk(results.admin);

  console.log("");
  if (allOk) {
    console.log("🎯 All services are ready for E2E testing!");
  } else {
    console.log("💡 Start missing services with: bun dev");
  }

  return allOk;
}

// Run if executed directly
testConnectivity().then((success) => {
  process.exit(success ? 0 : 1);
});

export { testConnectivity };
