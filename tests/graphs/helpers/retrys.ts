import * as z from "zod";
import { SystemMessage } from "@langchain/core/messages";
// --- helpers ---
function formatStructuredError(err: unknown): string {
  // LangChain suele tirar OutputParserException u otros errores.
  // No necesitamos detectar perfecto, solo dar un resumen útil al modelo.
  if (err && typeof err === "object") {
    const anyErr = err as any;
    const msg =
      anyErr?.message ||
      anyErr?.toString?.() ||
      "Error desconocido al validar/parsear el output.";
    // A veces Zod errors vienen en err.cause o err.error
    const issues =
      anyErr?.issues ||
      anyErr?.cause?.issues ||
      anyErr?.error?.issues ||
      anyErr?.cause?.error?.issues;

    if (Array.isArray(issues) && issues.length) {
      const top = issues
        .slice(0, 5)
        .map((i: any) => `- ${i.path?.join(".") ?? "(root)"}: ${i.message}`)
        .join("\n");
      return `${msg}\nProblemas:\n${top}`;
    }
    return msg;
  }
  return String(err);
}

function extractRawOutputFromError(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as any;

  // LangChain suele incluir el texto crudo en distintas props según versión/capa:
  const candidates: unknown[] = [
    anyErr?.llmOutput,
    anyErr?.output,
    anyErr?.text,
    anyErr?.raw,
    anyErr?.response?.text,
    anyErr?.response?.data,
    anyErr?.cause?.llmOutput,
    anyErr?.cause?.output,
    anyErr?.cause?.text,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
    if (c && typeof c === "object") {
      // a veces viene como objeto ya parseado (parcial)
      try {
        return JSON.stringify(c, null, 2);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

async function invokeStructuredWithRepair<T>({
  model,
  schema,
  basePrompt,
  maxAttempts,
  seedRepairMessage,
}: {
  model: any;
  schema: z.ZodType<T>;
  basePrompt: SystemMessage;
  maxAttempts: number;
  seedRepairMessage?: SystemMessage;
}): Promise<{ result: T | null; lastErr: unknown; lastErrText: string | null; lastRaw: string | null }> {
  const structured = model.withStructuredOutput(schema, { strict: true });

  let lastErr: unknown = null;
  let lastErrText: string | null = null;
  let lastRaw: string | null = null;

  let messages: SystemMessage[] = seedRepairMessage
    ? [basePrompt, seedRepairMessage]
    : [basePrompt];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await structured.invoke(messages);
      return { result: result as T, lastErr: null, lastErrText: null, lastRaw };
    } catch (err) {
      lastErr = err;
      lastErrText = formatStructuredError(err);
      lastRaw = extractRawOutputFromError(err) ?? lastRaw;

      if (attempt === maxAttempts) break;

      const repair = new SystemMessage(`
La respuesta anterior NO cumplió el schema y falló la validación/parseo.

Error (resumen):
${lastErrText}

Reintenta y devuelve ÚNICAMENTE un JSON válido que cumpla EXACTAMENTE el schema.
Reglas:
- No agregues texto extra, ni markdown, ni comentarios.
- No inventes campos que no existan.
- Asegúrate de incluir TODOS los campos requeridos.
- Usa español neutro en strings.
`);

      messages = [basePrompt, repair];
    }
  }

  return { result: null, lastErr, lastErrText, lastRaw };
}
/**
 * Invoca un modelo con retry en caso de error de validación/parseo
 * @returns T
 */

export async function invokeWithRetry<T>({
  model,
  schema,
  basePrompt,
  maxAttempts = 3,
  fallback,
}: {
  model: any;
  schema: z.ZodType<T>;
  basePrompt: SystemMessage;
  maxAttempts?: number;
  fallback?: {
    model: any;
    maxAttempts?: number;
  };
}): Promise<T> {
  const primary = await invokeStructuredWithRepair<T>({
    model,
    schema,
    basePrompt,
    maxAttempts,
  });

  if (primary.result) return primary.result;

  if (!fallback) throw primary.lastErr;

  const fallbackAttempts = fallback.maxAttempts ?? 2;
  const seed = new SystemMessage(`
Se agotaron los reintentos del modelo principal y el output NO valida contra el schema.
Vas a recibir el último output disponible (posiblemente inválido) y el resumen del error.

Tu tarea: **reparar y completar** el JSON para que cumpla EXACTAMENTE el schema provisto.

Reglas críticas:
- Devuelve ÚNICAMENTE JSON válido (sin markdown/texto extra).
- Mantén la intención del output anterior: no “reinventes” la solución si no hace falta.
- Completa lo faltante y corrige tipos/enum/arrays (por ejemplo: 7 días, y 2–3 opciones por meal_type).
- No inventes campos fuera del schema.

Resumen del error:
${primary.lastErrText ?? "(no disponible)"}

Último output (puede ser inválido):
${primary.lastRaw ?? "(no disponible)"}
`);

  const repaired = await invokeStructuredWithRepair<T>({
    model: fallback.model,
    schema,
    basePrompt,
    maxAttempts: fallbackAttempts,
    seedRepairMessage: seed,
  });

  if (repaired.result) return repaired.result;

  throw repaired.lastErr ?? primary.lastErr;
}
