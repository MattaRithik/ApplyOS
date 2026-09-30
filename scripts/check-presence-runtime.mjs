// Run after `npm run build`. Import the real production bundle in a fresh
// process: unit-test aliases for `server-only` must not hide runtime failures.
import assert from "node:assert/strict";
const { default: bundle } = await import("../.next/server/app/api/presence/route.js");
const route = bundle.routeModule.userland;
assert.equal(typeof route.POST, "function");
const response = await route.POST(new Request("https://app.test/api/presence", {
  method: "POST",
  headers: { origin: "https://other.test", "content-type": "application/json" },
  body: "{}",
}));
assert.equal(response.status, 403);
assert.equal(response.headers.get("cache-control"), "private, no-store");
assert.deepEqual(await response.json(), { error: "Invalid origin." });
console.log("Production heartbeat module loads and handles requests without a server-only import crash.");
