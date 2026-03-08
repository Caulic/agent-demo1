#!/usr/bin/env node
/**
 * Prepare and deploy to Cloudflare Workers:
 * 1. Strip sensitive env vars from generated wrangler.json
 * 2. Inject typescript stub to prevent ~10MB TS from being bundled (workaround for
 *    https://github.com/mastra-ai/mastra/issues/11449 until fix is released)
 * 3. Run wrangler deploy
 *
 * Secrets should be configured in Cloudflare dashboard or via:
 *   npx wrangler secret put OPENAI_API_KEY
 *
 * Usage:
 *   npm run build   # generate .mastra/output/
 *   npm run deploy  # strip keys + inject stub + wrangler deploy
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve(".mastra/output");
const WRANGLER_JSON = resolve(OUTPUT_DIR, "wrangler.json");
const TS_STUB = resolve(OUTPUT_DIR, "typescript-stub.mjs");
const SENSITIVE_KEYS = ["OPENAI_API_KEY"];

// 1. Strip sensitive keys
const config = JSON.parse(readFileSync(WRANGLER_JSON, "utf8"));
for (const key of SENSITIVE_KEYS) {
  if (config.vars?.[key]) {
    delete config.vars[key];
    console.log(`✓ Removed '${key}' from wrangler.json`);
  }
}

// 2. Write typescript stub (prevents ~10MB TS library from being bundled)
writeFileSync(
  TS_STUB,
  `export default {};
export const createSourceFile = () => null;
export const createProgram = () => null;
export const findConfigFile = () => null;
export const readConfigFile = () => ({ error: new Error('TypeScript not available') });
export const parseJsonConfigFileContent = () => ({ errors: [], fileNames: [], options: {} });
export const flattenDiagnosticMessageText = (msg) => typeof msg === 'string' ? msg : msg?.messageText ?? '';
export const ScriptTarget = { Latest: 99 };
export const ModuleKind = { ESNext: 99 };
export const JsxEmit = { ReactJSX: 4 };
export const DiagnosticCategory = { Warning: 0, Error: 1, Suggestion: 2, Message: 3 };
export const sys = { fileExists: () => false, readFile: () => undefined };
`
);
console.log("✓ Created typescript-stub.mjs");

// 3. Inject alias into wrangler.json
config.alias = { ...config.alias, typescript: "./typescript-stub.mjs" };
writeFileSync(WRANGLER_JSON, JSON.stringify(config, null, 2));
console.log("✓ Injected typescript alias into wrangler.json");

execSync("npx wrangler deploy --config .mastra/output/wrangler.json", {
  stdio: "inherit",
});
