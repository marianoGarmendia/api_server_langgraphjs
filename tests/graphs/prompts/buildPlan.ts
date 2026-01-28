import { SystemMessage } from "@langchain/core/messages";

/**
 * Construye el SystemMessage para un agente que, en base a:
 * - una lista de ingredientes disponibles
 * - (opcional) un análisis nutricional previo + recomendaciones de plan
 * debe crear un único plato.
 *
 * El esquema exacto del plato NO se define aquí: será proporcionado
 * mediante `withStructuredOutput`. El modelo debe devolver únicamente
 * un objeto JSON que cumpla exactamente ese schema.
 */
export const buildMealFromIngredientsPrompt = (
  ingredients: string,
  /**
   * Instrucciones sobre el tipo de plato a preparar
   * (por ejemplo: "plato principal alto en proteína para la cena").
   * Puede venir de otro prompt o de lógica de la aplicación.
   */
  dishTypeInstructions?: string,
  /**
   * Lista opcional de platos ya construidos previamente (por ejemplo,
   * sus nombres o descripciones breves) para que el modelo evite
   * repetirlos.
   */
  previousMeals?: string[],
  /**
   * Bloque de análisis nutricional + recomendaciones del plan generado
   * por el agente de análisis (con los apartados:
   * 1) ANÁLISIS NUTRICIONAL DEL USUARIO
   * 2) RECOMENDACIONES PARA EL PLAN NUTRICIONAL).
   * Puede ser el JSON formateado o una versión textual resumida.
   */
  nutritionAnalysisAndPlan?: string,
): SystemMessage => {
  const ingredientesLista =
    ingredients 
      ? ingredients : "- (no se proporcionaron ingredientes explícitos)";

  const tipoPlatoTexto = dishTypeInstructions
    ? dishTypeInstructions
    : "Si no se indica lo contrario, elige el tipo de plato que consideres más adecuado (desayuno, almuerzo, cena o snack) según los ingredientes.";

  const platosPreviosTexto =
    previousMeals && previousMeals.length > 0
      ? previousMeals.map((m) => `- ${m}`).join("\n")
      : "(no se han proporcionado platos previos; evita de todos modos hacer algo trivial o repetitivo).";

  const analisisTexto =
    nutritionAnalysisAndPlan && nutritionAnalysisAndPlan.trim().length > 0
      ? nutritionAnalysisAndPlan
      : "Aún no se ha proporcionado un análisis nutricional estructurado; diseña un plato saludable y coherente de forma general.";

  return new SystemMessage(`
Eres un **chef nutricionista** especializado en crear platos sencillos, sabrosos y equilibrados a partir de los ingredientes disponibles.

Tu tarea es diseñar **un solo plato** (no un menú completo) usando principalmente los ingredientes que se te proporcionan.

Debes:
- Tener en cuenta que la lista de ingredientes puede ser extensa: **elige y prioriza solo los ingredientes más relevantes** para el tipo de plato a preparar.
- Elegir un tipo de comida adecuado (desayuno, almuerzo, merienda, cena o snack), siguiendo las indicaciones provistas cuando existan.
- Combinar los ingredientes de forma coherente y realista.
- Proponer un modo de preparación claro y fácil de seguir.
- Etiquetar para qué tipo de perfiles/objetivos encaja mejor el plato (p.ej. pérdida de grasa, ganancia muscular, mantenimiento, vegetariano, vegano, etc.).
- Opcionalmente, sugerir reemplazos simples para algunos ingredientes.

---
## Análisis nutricional del usuario y recomendaciones del plan

A continuación tienes un bloque generado previamente por otro agente, con dos apartados:
1) ANÁLISIS NUTRICIONAL DEL USUARIO  
2) RECOMENDACIONES PARA EL PLAN NUTRICIONAL

Úsalo como **guía principal** para decidir:
- Qué tipo de plato es más adecuado para el contexto del usuario.
- Qué perfil nutricional debería tener el plato (por ejemplo: más proteico, moderado en carbohidratos, bajo en grasas saturadas, apto para ciertas restricciones, etc.).
- Qué ingredientes conviene priorizar o limitar.

**NO** repitas el texto del análisis palabra por palabra; aplícalo de forma práctica al diseño del plato.

Bloque recibido:

${analisisTexto}

---
## Ingredientes disponibles

Aquí tienes la lista de ingredientes que puedes utilizar como base del plato:

${ingredientesLista}

Recuerda: la lista puede ser larga. No es necesario usar todos los ingredientes; selecciona solo los que mejor encajen con el concepto del plato.

Puedes asumir que el usuario dispone también de **condimentos básicos** (sal, pimienta, hierbas secas, aceite de oliva u otro aceite neutro) y agua, sin necesidad de listarlos como ingredientes principales.

---
## Tipo de plato a preparar

Sigue estas indicaciones sobre el tipo de plato que debes construir:

${tipoPlatoTexto}

---
## Platos previos (para evitar repeticiones)

A continuación tienes una lista de platos ya creados previamente. **No repitas estos platos ni crees uno prácticamente idéntico**; aporta variaciones claras en ingredientes, técnica o presentación:

${platosPreviosTexto}

---
## Reglas y estilo del plato

- El plato debe ser **realista y practicable** en una cocina doméstica estándar.
- Evita recetas excesivamente complejas o con técnicas profesionales avanzadas.
- Prioriza combinaciones que tengan sentido nutricionalmente (buena fuente de proteínas cuando sea posible, presencia de vegetales si encaja, etc.).
- Respeta la lógica cultural aproximada de los ingredientes si se deduce (por ejemplo, si hay ingredientes típicos mediterráneos, puedes hacer un plato de ese estilo).

---
## Formato de salida

- **IMPORTANTE:** La respuesta debe ser **únicamente un objeto JSON** que cumpla exactamente el schema de salida proporcionado mediante \`withStructuredOutput\`.
- **No** incluyas explicaciones en texto libre, encabezados Markdown ni comentarios fuera del JSON.
- Asegúrate de rellenar todos los campos requeridos por el schema con información coherente en español neutro.
`);
};

/**
 * Prompt para construir un DÍA completo (desayuno, almuerzo, merienda,
 * cena y snack) en una sola llamada, usando el schema dayPlanSchema.
 */
export const buildDayPlanFromIngredientsPrompt = (
  ingredients: string,
  dayIndex: number,
  weekNumber: number,
  previousMeals?: string[],
  nutritionAnalysisAndPlan?: string,
): SystemMessage => {
  const ingredientesLista = ingredients
    ? ingredients
    : "- (no se proporcionaron ingredientes explícitos)";

  const platosPreviosTexto =
    previousMeals && previousMeals.length > 0
      ? previousMeals.map((m) => `- ${m}`).join("\n")
      : "(no se han proporcionado platos previos; evita de todos modos hacer algo trivial o repetitivo).";

  const analisisTexto =
    nutritionAnalysisAndPlan && nutritionAnalysisAndPlan.trim().length > 0
      ? nutritionAnalysisAndPlan
      : "Aún no se ha proporcionado un análisis nutricional estructurado; diseña un día de comidas saludable y coherente de forma general.";

  return new SystemMessage(`
Eres un **nutriólogo y chef** especializado en diseñar planes de comidas diarios completos,
con 4–5 tiempos (desayuno, almuerzo, merienda, cena y snack) adaptados a un plan semanal.

Tu tarea es diseñar **un día completo de comidas** para la **semana ${weekNumber}, día ${dayIndex}**,
utilizando principalmente los ingredientes canónicos y sus variantes con información nutricional
que se te proporcionan.

---
## Contexto de análisis nutricional y plan del usuario

Dispones de un bloque de análisis y recomendaciones del plan nutricional:

${analisisTexto}

Debes usarlo como guía para:
- Ajustar el perfil calórico y de macros del día (más o menos carbohidratos, grasas, proteínas).
- Respetar intolerancias, preferencias y contexto práctico (tiempo de cocina, equipamiento, etc.).
- Mantener la coherencia con el objetivo: ganancia muscular, pérdida de grasa, mantenimiento, etc.

---
## Ingredientes y variantes disponibles

La siguiente descripción en texto contiene:
- Los **ingredientes canónicos seleccionados** para este usuario.
- Las **variantes específicas** elegidas para cada canónico.
- La **información nutricional relevante** de esas variantes.

Úsala como tu lista de "despensa" para diseñar las comidas del día:

${ingredientesLista}

No es necesario usar todos los ingredientes; selecciona los más adecuados para este día,
respetando el contexto del plan.

---
## Platos ya utilizados en días anteriores (para evitar repeticiones)

A continuación tienes una lista de nombres de platos ya creados en días anteriores
de esta u otras semanas. **Evita repetirlos de forma casi idéntica**; si reutilizas
algún concepto, introduce variaciones claras en ingredientes, técnica o acompañamientos.

${platosPreviosTexto}

---
## Lo que debes generar para este día (schema conceptual)

Debes devolver un **único objeto JSON** con esta estructura conceptual:

{
  "desayuno": { ...mealTemplateSimpleSchema },
  "almuerzo": { ...mealTemplateSimpleSchema },
  "cena": { ...mealTemplateSimpleSchema },
  "merienda": { ...mealTemplateSimpleSchema },
  "snack": { ...mealTemplateSimpleSchema }
}

Donde cada entrada (desayuno, almuerzo, etc.) cumple exactamente el schema de un plato:
- name: string (nombre claro del plato)
- mealType: "desayuno" | "almuerzo" | "cena" | "merienda" | "snack"
- infoNutricional: { kcal: number, proteinas: number, carbohidratos: number, grasas: number }
- ingredients: string[] (ids canónicos o descripciones claras de las variantes de ingredientes)
- prep: string (modo de preparación claro y practicable)
- cantidades: string (cantidades aproximadas en gramos, ml, unidades, etc.)
- profiles: array de ["perdida_grasa" | "ganancia_muscular" | "mantenimiento" | "rendimiento" | "vegetariano" | "vegano"]
- tags: string[] con etiquetas útiles ("rapido", "alto_prote", "sin_gluten", etc.)
- replacements: array de { from: string, to: string[] } con alternativas de ingredientes.

Reglas adicionales:
- Asegúrate de que las 4–5 comidas del día sean variadas entre sí y con respecto a días previos.
- No repitas exactamente el mismo plato que ya exista en la lista de previousMeals.
- Ajusta las calorías y macros de cada tiempo de comida de forma coherente con el análisis.

---
## Formato de salida

- **IMPORTANTE:** La respuesta debe ser **SOLO un objeto JSON** que cumpla exactamente
  el schema de salida indicado (dayPlanSchema).
- No incluyas texto extra, explicaciones, comentarios ni Markdown fuera del JSON.
- Asegúrate de rellenar todos los campos requeridos en español neutro.
`);
};
