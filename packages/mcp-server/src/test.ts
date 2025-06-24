import { Octokit } from "octokit";

// Test script to verify the MCP server works
async function testMCPServer() {
  console.log("Testing Green Goods MCP Server...\n");

  // Test 1: GitHub connectivity
  console.log("1. Testing GitHub connectivity...");
  try {
    const github = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await github.rest.users.getAuthenticated();
    console.log("✓ GitHub connected as:", data.login);
  } catch (error) {
    console.error("✗ GitHub connection failed:", error instanceof Error ? error.message : String(error));
    console.log("  Make sure GITHUB_TOKEN is set in your .env file");
  }

  // Test 2: File system access
  console.log("\n2. Testing file system access...");
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const docsPath = path.join(process.cwd(), "docs");
    const files = await fs.readdir(docsPath);
    console.log("✓ Found docs:", files.filter(f => f.endsWith('.md')).join(", "));
  } catch (error) {
    console.error("✗ File system access failed:", error instanceof Error ? error.message : String(error));
  }

  // Test 3: Contract directory access
  console.log("\n3. Testing contract directory access...");
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const contractsPath = path.join(process.cwd(), "packages/contracts/src");
    const dirs = await fs.readdir(contractsPath);
    console.log("✓ Found contract directories:", dirs.join(", "));
  } catch (error) {
    console.error("✗ Contract directory access failed:", error instanceof Error ? error.message : String(error));
  }

  // Test 4: HTTP server test (if running)
  console.log("\n4. Testing HTTP server (if running)...");
  try {
    const response = await fetch("http://localhost:8000/health");
    const data = await response.json();
    console.log("✓ HTTP server is running:", data);
  } catch (error) {
    console.log("✗ HTTP server not running (start with: npm run dev:http)");
  }

  console.log("\nTest complete!");
}

// Run tests
testMCPServer().catch(console.error); 