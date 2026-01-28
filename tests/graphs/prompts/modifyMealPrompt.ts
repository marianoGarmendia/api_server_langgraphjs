import { SystemMessage } from "@langchain/core/messages";

/**
 * Prompt para regenerar un "bucket" de opciones de comida (2–3 opciones)
 * para reemplazar/modificar un plato existente, respetando analysis + perfil.
 */
export const buildModifyMealPrompt = (args: {
  analysis: unknown;
  user_profile: unknown;
  mealToModify: unknown;
  dayMeals: unknown;
  availablePlates: unknown;
  nutritionistPrompt: string;
}): SystemMessage => {
  const analysisJson = JSON.stringify(args.analysis ?? {}, null, 2);
  const profileJson = JSON.stringify(args.user_profile ?? {}, null, 2);
  const mealToModifyJson = JSON.stringify(args.mealToModify ?? {}, null, 2);
  const dayMealsJson = JSON.stringify(args.dayMeals ?? [], null, 2);
  const availablePlatesJson = JSON.stringify(args.availablePlates ?? [], null, 2);
  const instruction = (args.nutritionistPrompt ?? "").trim();

  return new SystemMessage(`
Eres un **nutricionista** que debe **regenerar un plato** (o mejor dicho, un conjunto de opciones) dentro de un plan diario.

Vas a recibir:
1) analysis nutricional del usuario (reglas duras, objetivo, restricciones)
2) user_profile (contexto adicional)
3) el bloque exacto del plato/meal a modificar (mealToModify)
4) el array de platos del día (dayMeals) para evitar repetición y mantener coherencia
5) una lista de platos disponibles/candidatos (availablePlates) para elegir SIN inventar
6) un prompt del nutricionista con instrucciones específicas para esta regeneración

--- 
## analysis
${analysisJson}

---
## user_profile
${profileJson}

---
## mealToModify (el bloque a reemplazar)
${mealToModifyJson}

---
## dayMeals (platos ya usados en ese día)
${dayMealsJson}

---
## availablePlates (candidatos disponibles; NO inventar platos fuera de esta lista)
${availablePlatesJson}

---
## Instrucciones del nutricionista (prioridad máxima)
${instruction || "(sin instrucciones adicionales)"}

---
## Tu tarea
Devuelve un nuevo **bucket** con **2 o 3 opciones** (options) para reemplazar el mealToModify.

Reglas:
- Mantén coherencia con el objetivo (p.ej. lose_fat / gain_muscle) y restricciones del analysis.
- Evita repetir exactamente los mismos platos ya usados en dayMeals.
- Si mealToModify ya contiene opciones, puedes reutilizar alguna si es válida, pero mejora variedad.
- NO inventes platos: cada opción debe corresponder a un plato de availablePlates (usar su id/nombre/prep/nutrition/ingredients como base).
- Las opciones deben incluir: plato_id, plato_nombre, portion (con ingredients), prep, nutrition (o null), tags.
- Respeta siempre el tipo de comida (meal_type) del mealToModify.

---
## Formato de salida (OBLIGATORIO)
Devuelve ÚNICAMENTE JSON válido que cumpla EXACTAMENTE el schema provisto 
No incluyas markdown ni texto fuera del JSON.
`);
};


