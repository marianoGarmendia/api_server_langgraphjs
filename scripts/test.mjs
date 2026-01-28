#!/usr/bin/env node
import { parseArgs } from "util";
import { $ } from "./utils.mjs";
import { rm } from "node:fs/promises";

const { values, positionals } = parseArgs({
  options: { config: { short: "c", type: "string" } },
  allowPositionals: true,
});

await rm("tests/graphs/.langgraph_api", { recursive: true, force: true });
await Promise.race([
  $`pnpm tsx ./tests/utils.server.mts ${values.config}`,
  (async () => {
    await $`bun x wait-port -t 24000 localhost:2024`;
    await $`pnpm vitest run ${positionals}`;
    process.exit(0);
  })(),
]);
