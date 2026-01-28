import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { closeWsMongo } from "./mongoClientWs.js";
import { listPlatosWs } from "./platosRepository.js";

export async function exportFirstPlatosWsToJson({
  limit = 3,
  outFile = "db_ws_productos_first3.json",
}: {
  limit?: number;
  outFile?: string;
} = {}): Promise<string> {
  const docs = await listPlatosWs({ limit });

  const outPath = path.resolve(process.cwd(), outFile);
  await writeFile(outPath, JSON.stringify(docs, null, 2), "utf-8");

  return outPath;
}

async function main() {
  try {
    const outPath = await exportFirstPlatosWsToJson();
    console.log(`[db_ws] Escrito OK: ${outPath}`);
  } catch (err: any) {
    console.error("[db_ws] ERROR exportando productos:", err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await closeWsMongo();
  }
}

main();


