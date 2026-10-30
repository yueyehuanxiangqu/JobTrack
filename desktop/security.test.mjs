import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { classifyUrl, permissionAllowed } = createRequire(import.meta.url)("./security.cjs");

test("only the exact local application origin is internal", () => {
  assert.equal(classifyUrl("http://127.0.0.1:3737/dashboard"), "internal");
  assert.equal(classifyUrl("http://127.0.0.1:3737.evil.test/"), "blocked");
  assert.equal(classifyUrl("https://careers.example.com/job/1"), "external");
  assert.equal(classifyUrl("http://127.0.0.1:3738/"), "external");
});
test("only sanitized clipboard writes from the app origin are permitted", () => {
  assert.equal(permissionAllowed("clipboard-sanitized-write", "http://127.0.0.1:3737"), true);
  assert.equal(permissionAllowed("clipboard-sanitized-write", "https://example.com"), false);
  assert.equal(permissionAllowed("clipboard-read", "http://127.0.0.1:3737"), false);
  assert.equal(permissionAllowed("media", "http://127.0.0.1:3737"), false);
});
test("privileged, malformed and credential-bearing URLs are blocked", () => {
  for (const url of ["javascript:alert(1)", "file:///C:/Windows/system.ini", "data:text/html,test", "https://user:pass@example.com", "not a URL"]) {
    assert.equal(classifyUrl(url), "blocked");
  }
});
