// contract.test.mjs
// CTO-side smoke test for the Engineer's Next.js MVP build.
// Run with: node contract.test.mjs
//
// Pre-reqs: Next.js dev server running on http://localhost:3000
//           DATABASE_URL points to a Postgres with waitlist+edits+events tables
//           REMOVEBG_API_KEY set (or REMOVE_BG_MOCK=1 to short-circuit)

import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE ?? "http://localhost:3000";

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json, text };
}

let failed = 0;
function check(name, fn) {
  return fn().then(
    () => console.log(`PASS  ${name}`),
    (e) => { failed++; console.error(`FAIL  ${name}\n      ${e.message ?? e}`); }
  );
}

await check("GET / returns 200 (landing or upload page)", async () => {
  const r = await http("GET", "/");
  assert.equal(r.status, 200, `got ${r.status}`);
});

await check("POST /api/waitlist with valid email returns 200", async () => {
  const email = `test-${Date.now()}@productpop.local`;
  const r = await http("POST", "/api/waitlist", { email, source: "contract-test" });
  assert.equal(r.status, 200, `got ${r.status}: ${r.text}`);
  assert.equal(r.json?.ok, true);
});

await check("POST /api/waitlist with invalid email returns 400", async () => {
  const r = await http("POST", "/api/waitlist", { email: "not-an-email", source: "x" });
  assert.equal(r.status, 400, `got ${r.status}`);
});

await check("POST /api/waitlist with duplicate email returns 409", async () => {
  const email = `dup-${Date.now()}@productpop.local`;
  await http("POST", "/api/waitlist", { email, source: "contract-test" });
  const r = await http("POST", "/api/waitlist", { email, source: "contract-test" });
  assert.equal(r.status, 409, `got ${r.status}`);
});

await check("POST /api/remove-bg without file returns 400", async () => {
  const r = await http("POST", "/api/remove-bg", {});
  assert.equal(r.status, 400, `got ${r.status}`);
});

await check("POST /api/remove-bg with tiny PNG returns 200 + base64 output (or 502 if no key)", async () => {
  // 1x1 transparent PNG
  const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";
  const r = await http("POST", "/api/remove-bg", { imageBase64: pngB64 });
  if (process.env.REMOVE_BG_MOCK === "1") {
    assert.equal(r.status, 200, `mock mode: got ${r.status}: ${r.text}`);
    assert.ok(r.json?.outputBase64, "expected outputBase64 in response");
  } else {
    // without key the route must return 502, not 500
    assert.ok([200, 502].includes(r.status), `got ${r.status}: ${r.text}`);
  }
});

await check("waitlist row visible via psql SELECT", async () => {
  const out = execSync(
    `PGPASSWORD=productpop_dev psql -h 127.0.0.1 -p 5438 -U productpop -d productpop -tAc "SELECT count(*) FROM waitlist WHERE source = 'contract-test'"`,
    { encoding: "utf8" }
  ).trim();
  assert.ok(Number(out) > 0, `no contract-test rows in waitlist, got '${out}'`);
});

await sleep(50);

if (failed > 0) {
  console.error(`\n${failed} contract check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll contract checks passed.");
