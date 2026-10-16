import { test } from "node:test";
import assert from "node:assert/strict";
import { check, allowedHost } from "../server/guard.js";

const req = (method, headers) => ({ method, headers: { host: "localhost:4747", ...headers } });

test("only local host names pass (DNS rebinding)", () => {
  assert.ok(allowedHost("localhost:4747"));
  assert.ok(allowedHost("127.0.0.1:4747"));
  assert.ok(!allowedHost("evil.example:4747"));
  assert.ok(!allowedHost(""));
  assert.match(check(req("GET", { host: "evil.example" })), /Unbekannter Host/);
});

test("changes from other websites are blocked (CSRF), own pages and programs pass", () => {
  assert.equal(check(req("POST", { origin: "http://localhost:4747" })), null);
  assert.equal(check(req("POST", {})), null); // curl, MCP server, Stimme
  assert.match(check(req("POST", { origin: "https://evil.example" })), /fremden Website/);
  assert.match(check(req("DELETE", { origin: "null" })), /fremden Website/);
  assert.match(check(req("PUT", { "sec-fetch-site": "cross-site" })), /fremden Website/);
  assert.equal(check(req("GET", { origin: "https://evil.example" })), null); // reads are protected by the browser's same-origin rule
});
