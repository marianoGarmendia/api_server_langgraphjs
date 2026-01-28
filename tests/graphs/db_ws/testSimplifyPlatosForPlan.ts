import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { simplifyPlatosForWeeklyPlan } from "./simplifyPlatosForPlan.js";

async function main() {
  const inputArg = process.argv.find((a) => a.startsWith("--input="))?.split("=", 2)[1];
  const outputArg = process.argv.find((a) => a.startsWith("--output="))?.split("=", 2)[1];

  const inputPath = path.resolve(process.cwd(), inputArg ?? "result-plates-node.json");
  const outputPath = path.resolve(process.cwd(), outputArg ?? "plates-simplified.json");

  const raw = await readFile(inputPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("El JSON de entrada no es un array de platos.");
  }

  const simplified = simplifyPlatosForWeeklyPlan(parsed as any[]);

  await writeFile(outputPath, JSON.stringify(simplified, null, 2), "utf8");
  console.log(`✅ Listo. Archivo generado: ${outputPath}`);
  console.log(`   Platos leídos: ${parsed.length}`);
  console.log(`   Platos simplificados: ${simplified.length}`);
}

main().catch((err) => {
  console.error("❌ Error simplificando platos:", err);
  process.exitCode = 1;
});


