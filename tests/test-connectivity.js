#!/usr/bin/env node

// Simple connectivity test to validate our check logic
const https = require("https");

async function testConnectivity() {
  console.log("🧪 Testing connectivity check logic...\n");

  // Test client connectivity with secure approach
  try {
    console.log("Testing client on port 3001 (trying HTTP first, then HTTPS)...");

    const clientStatus = await new Promise((resolve) => {
      const http = require("http");

      // Try HTTP first (common for health checks)
      const req = http.get(
        "http://localhost:3001/",
        {
          timeout: 5000,
        },
        (res) => {
          console.log(`HTTP Response received: ${res.statusCode}`);
          console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
          resolve({ status: res.statusCode, success: true, protocol: "HTTP" });
        }
      );

      req.on("error", (error) => {
        console.log(`HTTP Request error: ${error.message}, trying HTTPS...`);

        // Fallback to HTTPS with proper certificate handling
        const httpsReq = https.get(
          "https://localhost:3001/",
          {
            timeout: 5000,
            // Only allow self-signed certs in test environment
            ...(process.env.NODE_ENV === "test" && { rejectUnauthorized: false }),
          },
          (res) => {
            console.log(`HTTPS Response received: ${res.statusCode}`);
            console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
            resolve({ status: res.statusCode, success: true, protocol: "HTTPS" });
          }
        );

        httpsReq.on("error", (httpsError) => {
          console.log(`HTTPS Request error: ${httpsError.message}`);
          resolve({ status: 0, success: false, error: httpsError.message });
        });

        httpsReq.on("timeout", () => {
          console.log("HTTPS Request timed out");
          httpsReq.destroy();
          resolve({ status: 0, success: false, error: "timeout" });
        });
      });

      req.on("timeout", () => {
        console.log("HTTP Request timed out, trying HTTPS...");
        req.destroy();

        // Try HTTPS as fallback
        const httpsReq = https.get(
          "https://localhost:3001/",
          {
            timeout: 5000,
            // Only allow self-signed certs in test environment
            ...(process.env.NODE_ENV === "test" && { rejectUnauthorized: false }),
          },
          (res) => {
            console.log(`HTTPS Response received: ${res.statusCode}`);
            resolve({ status: res.statusCode, success: true, protocol: "HTTPS" });
          }
        );

        httpsReq.on("error", (httpsError) => {
          console.log(`HTTPS Request error: ${httpsError.message}`);
          resolve({ status: 0, success: false, error: httpsError.message });
        });

        httpsReq.on("timeout", () => {
          console.log("HTTPS Request timed out");
          httpsReq.destroy();
          resolve({ status: 0, success: false, error: "timeout" });
        });
      });
    });

    console.log(`Final result: ${JSON.stringify(clientStatus, null, 2)}`);

    if (clientStatus.success && clientStatus.status >= 200 && clientStatus.status < 500) {
      console.log(
        `✅ Client is working (${clientStatus.protocol || "HTTP/HTTPS"} ${clientStatus.status})`
      );
      return true;
    } else {
      console.log(`❌ Client check failed: ${JSON.stringify(clientStatus)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Connectivity test failed: ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  testConnectivity().then((result) => {
    console.log(`\n🎯 Test result: ${result ? "SUCCESS" : "FAILED"}`);
    process.exit(result ? 0 : 1);
  });
}

module.exports = { testConnectivity };
