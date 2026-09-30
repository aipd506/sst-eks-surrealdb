import app from "./index";

async function runTests() {
  console.log("=== Testing Hono + SurrealDB Endpoints ===");

  // 1. Test /health
  const healthRes = await app.request("/health");
  console.log("GET /health -> HTTP", healthRes.status);
  const healthBody = await healthRes.json();
  console.log("Response:", JSON.stringify(healthBody));
  if (healthRes.status !== 200 || healthBody.status !== "ok") {
    throw new Error("Health check failed!");
  }

  console.log("✓ Health endpoint verified successfully.");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
