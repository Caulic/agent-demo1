#!/usr/bin/env node
/**
 * Safe deploy script:
 * 1. mastra build
 * 2. Strip sensitive env vars from generated wrangler.json
 * 3. npx wrangler deploy
 *
 * Secrets (e.g. OPENAI_API_KEY) must be set separately via:
 *   npx wrangler secret put OPENAI_API_KEY
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const WRANGLER_JSON = resolve(".mastra/output/wrangler.json");

// Keys to remove from vars — should be set as Wrangler Secrets instead
const SENSITIVE_KEYS = ["OPENAI_API_KEY"];

console.log("▶ Building...");
execSync("npm run build", { stdio: "inherit" });

// Strip sensitive vars
const config = JSON.parse(readFileSync(WRANGLER_JSON, "utf8"));
let stripped = 0;
for (const key of SENSITIVE_KEYS) {
  if (config.vars?.[key]) {
    delete config.vars[key];
    stripped++;
    console.log(`✓ Removed '${key}' from wrangler.json vars`);
  }
}
if (stripped > 0) {
  writeFileSync(WRANGLER_JSON, JSON.stringify(config, null, 2));
}

console.log("▶ Deploying to Cloudflare Workers...");
execSync("npx wrangler deploy --config .mastra/output/wrangler.json", {
  stdio: "inherit",
});

console.log(`
✅ Deploy complete.

If this is your first deploy, set the API key as a Secret:
  npx wrangler secret put OPENAI_API_KEY
`);
