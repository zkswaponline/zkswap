import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// store.ts imports "server-only", so its prefix is checked as source text: the kv-gateway ACL only allows zkswap:* keys.
test("store keys default to the zkswap: prefix", () => {
  const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  assert.match(src, /KEY_PREFIX = process\.env\.STORE_KEY_PREFIX \|\| "zkswap:"/);
  assert.match(src, /const k = \(key: string\) => `\$\{prefix\}\$\{key\}`/);
});
