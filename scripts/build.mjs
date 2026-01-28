#!/usr/bin/env node
import { $ } from "./utils.mjs";

import { copyFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

async function rimraf(path) {
  await rm(path, { recursive: true, force: true });
}

async function moveChildren(srcDir, destDir) {
  let entries = [];
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      await rename(join(srcDir, entry.name), join(destDir, entry.name));
    }),
  );
}

await rimraf("dist");
await $`pnpm tsc --outDir dist`;
await $`pnpm tsc --module nodenext --outDir dist/src/cli -d src/cli/spawn.mts`;
await $`pnpm tsc --module nodenext --outDir dist/src/auth -d src/auth/index.mts`;

await mkdir("dist/src/graph/parser/schema", { recursive: true });
await copyFile(
  "src/graph/parser/schema/types.template.mts",
  "dist/src/graph/parser/schema/types.template.mts",
);
await rimraf("dist/src/graph/parser/schema/types.template.mjs");

await moveChildren("dist/src", "dist");
await rimraf("dist/src");
await rimraf("dist/tests");
