#!/usr/bin/env node
/**
 * Replace large unnecessary chunks with lightweight stubs after `mastra build`.
 * This brings the gzipped Worker bundle under Cloudflare's 3MB free-tier limit.
 *
 * Stubbed modules:
 *   - o200k_base.mjs (~2.2MB) — tiktoken encoding table, not needed at runtime
 *   - observational-memory-*.mjs (~2.4MB) — memory system, unused in this project
 */

import { readdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const OUTPUT = resolve(".mastra/output");

const stubs = [
  {
    match: (f) => f === "o200k_base.mjs",
    content: `var o200k_base = {};\nexport default o200k_base;\n`,
  },
  {
    match: (f) => f.startsWith("observational-memory-") && f.endsWith(".mjs"),
    content: `export const ObservationalMemory = class { constructor() { throw new Error("ObservationalMemory not available"); } };\n`,
  },
];

for (const file of readdirSync(OUTPUT)) {
  for (const stub of stubs) {
    if (stub.match(file)) {
      const path = join(OUTPUT, file);
      writeFileSync(path, stub.content);
      console.log(`✓ Stubbed ${file}`);
    }
  }
}
