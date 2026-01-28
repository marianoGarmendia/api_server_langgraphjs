import { SystemMessage } from "@langchain/core/messages";

/**
 * Prompt para un LLM que genera un plan semanal a partir de:
 * - analysis: análisis nutricional estructurado del usuario
 * - platos: platos disponibles (en formato "simplificado")
 *
 * Nota: el schema final debería imponerse con `withStructuredOutput(...)`.
 */
export const buildWeeklyPlanPrompt = (
  analysis: unknown,
  platos: unknown,
  weekNumber: number,
  totalWeeks: number,
  previousWeeksSummary?: string
): SystemMessage => {
  const analysisJson = JSON.stringify(analysis ?? {}, null, 2);
  const platesJson = JSON.stringify(platos ?? [], null, 2);

  return new SystemMessage(`
Eres un **AGENTE PLANIFICADOR DE PLAN SEMANAL NUTRICIONAL** (nutricionista).

Tu tarea es generar un **plan semanal** a partir de:
1) un análisis nutricional del usuario (objetivo, restricciones, prioridades, etc.)
2) una lista de platos disponibles en formato simplificado.

Habla y escribe en **español neutro**.

--- 
## INPUT 1: analysis (análisis nutricional)
${analysisJson}

---
## INPUT 2: platos (platos simplificados disponibles)
Cada plato incluye (aprox):
- id, nombre, meal_type (uno o más tipos: desayuno/almuerzo/merienda/cena/snack)
- prep (preparación)
- nutrition total del plato (macros totales)
- ingredients con unit/quantity y nutrition por ingrediente (si existe)

Lista:
${platesJson}

---
## Contexto adicional
- Esta es la **semana ${weekNumber}** (de ${totalWeeks} semanas) que estás construyendo.
- ${previousWeeksSummary ? `Resumen de semanas anteriores:\n${previousWeeksSummary}` : "No hay semanas previas aún; empieza con variedad."}

## Reglas críticas (muy importante)
- NO inventes platos: solo puedes usar platos presentes en la lista provista.
- Cada opción debe referenciar el plato por **id** y **nombre** (tal cual vienen).
- Respeta intolerancias/alergias y restricciones del analysis como reglas duras.
- Debe haber variedad: evita repetir exactamente el mismo plato demasiadas veces en la semana.
- Practicidad: prioriza platos coherentes con el tiempo/equipamiento del usuario (si el analysis lo indica).

---
## Qué debes producir
Un plan semanal con estructura por día, y por cada tipo de comida:
- desayuno
- almuerzo
- merienda
- cena
- snack (si corresponde)

IMPORTANTE: para cada meal_type, debes dar **2 o 3 opciones** (no una sola).
Las opciones pueden repetirse entre días, pero intenta variedad semanal.

Cada opción debe incluir:
- plato_id + plato_nombre
- porción/cantidad (usa las cantidades del plato si existen; si faltan, usa porciones genéricas razonables y acláralo)
- preparación (puedes usar el campo prep del plato como base, resumido)
- info nutricional (usar nutrition del plato; si falta, poner null)

---
## Formato de salida (schema básico, OBLIGATORIO)
Devuelve ÚNICAMENTE JSON válido con el schema provisto


Reglas:
- days: siempre 7 días.
- Por cada meal_type: options debe tener **2 o 3** elementos.
- Usa tags coherentes (objetivo/estilo/practicidad). No inventes campos fuera del schema.
- No incluyas texto fuera del JSON.
`);
};


