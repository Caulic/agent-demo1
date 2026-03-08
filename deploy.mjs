#!/usr/bin/env node
/**
 * Strip sensitive env vars from generated wrangler.json, then run wrangler deploy.
 * Secrets should be configured in Cloudflare dashboard or via:
 *   npx wrangler secret put OPENAI_API_KEY
 *
 * Usage:
 *   npm run build   # generate .mastra/output/
 *   npm run deploy  # strip keys + wrangler deploy
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const WRANGLER_JSON = resolve(".mastra/output/wrangler.json");
const SENSITIVE_KEYS = ["OPENAI_API_KEY"];

const config = JSON.parse(readFileSync(WRANGLER_JSON, "utf8"));
for (const key of SENSITIVE_KEYS) {
  if (config.vars?.[key]) {
    delete config.vars[key];
    console.log(`✓ Removed '${key}' from wrangler.json`);
  }
}
writeFileSync(WRANGLER_JSON, JSON.stringify(config, null, 2));

execSync("npx wrangler deploy --config .mastra/output/wrangler.json", {
  stdio: "inherit",
});
