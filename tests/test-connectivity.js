#!/usr/bin/env node

// Simple connectivity test to validate our check logic
const https = require("https");

async function testConnectivity() {
  console.log("🧪 Testing connectivity check logic...\n");

  // Test client connectivity with the same method as the run-tests.js
  try {
    console.log("Testing client on port 3001 (HTTPS)...");

    const clientStatus = await new Promise((resolve) => {
      const req = https.get(
        "https://localhost:3001/",
        {
          timeout: 5000,
          rejectUnauthorized: false, // Accept self-signed cert from mkcert
        },
        (res) => {
          console.log(`Response received: ${res.statusCode}`);
          console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
          resolve({ status: res.statusCode, success: true });
        }
      );

      req.on("error", (error) => {
        console.log(`Request error: ${error.message}`);
        resolve({ status: 0, success: false, error: error.message });
      });

      req.on("timeout", () => {
        console.log("Request timed out");
        req.destroy();
        resolve({ status: 0, success: false, error: "timeout" });
      });
    });

    console.log(`Final result: ${JSON.stringify(clientStatus, null, 2)}`);

    if (clientStatus.success && clientStatus.status >= 200 && clientStatus.status < 500) {
      console.log(`✅ Client is working (HTTPS ${clientStatus.status})`);
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
