#!/usr/bin/env node
import { $ } from "./utils.mjs";

import { copyFile, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
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
      const from = join(srcDir, entry.name);
      const to = join(destDir, entry.name);
      try {
        await rename(from, to);
      } catch (err) {
        // Windows can throw EPERM on rename across certain FS conditions (AV/indexing).
        // Fall back to copy+delete to keep the build robust.
        await cp(from, to, { recursive: true, force: true });
        await rimraf(from);
      }
    }),
  );
}

await rimraf("dist");
// Compile into dist/src so later move-to-dist is collision-free.
await $`pnpm tsc --outDir dist/src`;
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
