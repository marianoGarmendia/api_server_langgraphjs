// Prompt para "comprimir" un contexto grande en un resumen estructurado y reutilizable.
// Objetivo: bajar tokens en el agente conversacional sin perder datos críticos.

const flattenContext = (context: any, prefix = ""): string[] => {
  if (context === null || context === undefined) {
    return [`- ${prefix}: null`];
  }

  if (typeof context === "string" || typeof context === "number" || typeof context === "boolean") {
    return [`- ${prefix}: ${context}`];
  }

  if (typeof context === "bigint") {
    return [`- ${prefix}: ${context.toString()}`];
  }

  if (Array.isArray(context)) {
    const serialized = JSON.stringify(context, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    return [`- ${prefix}: ${serialized}`];
  }

  if (typeof context === "object") {
    const keys = Object.keys(context);
    if (keys.length === 0) {
      return [`- ${prefix}: {}`];
    }
    return keys.flatMap((key) => {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      return flattenContext(context[key], childPrefix);
    });
  }

  const serialized = JSON.stringify(context, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  return [`- ${prefix}: ${serialized}`];
};

export const formatContextForPrompt = (context: any) => {
  console.log("context", context);
  if (!context || Object.keys(context).length === 0) {
    return "contexto vacío";
  }

  const lines = flattenContext(context);
  return lines.join("\n");
};

export const comprimedPrompt = (context: any) => {
  const contextLines =
    typeof context === "string" ? context : formatContextForPrompt(context);

  return `
Eres un **compresor de contexto** para un asistente de nutrición y suplementación.
Vas a recibir un **contexto grande** (JSON/texto) con: perfil del usuario, análisis nutricional, plan nutricional (si existe),
suplementos recomendados, y/o una prescripción (posología, horarios, duración, observaciones).

## Objetivo
Extraer y reestructurar lo **más importante** para que otro modelo pueda responder preguntas del usuario con seguridad y precisión.
Debes **reducir longitud** sin perder datos claves.

## Reglas críticas
- Responde **siempre en español**.
- **No inventes** información. Si un dato no está, no lo asumas.
- **No omitas** datos de seguridad: medicación, patologías, embarazo/lactancia, alergias, contraindicaciones, advertencias.
- Mantén coherencia: no contradigas el contexto.
- Prioriza lo accionable: qué suplementos, para qué, cómo tomarlos, cuándo, cuánto tiempo, y qué monitorear.

## Qué considerar “clave” (no se debe perder)
1) **Objetivo principal del usuario** y objetivos secundarios (rendimiento, sueño, estrés, articulaciones, etc.).
2) **Perfil y flags de riesgo**: edad/sexo/peso/actividad (si está), medicación, patologías, embarazo/lactancia, alergias.
3) **Restricciones y preferencias** relevantes (dietas, intolerancias, horarios de entreno/sueño si aparecen).
4) **Plan nutricional actual** (si existe): calorías/macros/micronutrientes relevantes y notas.
5) **Plan de suplementos activo**:
   - lista de suplementos (id/nombre)
   - motivo de inclusión (gap/objetivo)
   - posología (dosis/forma) SOLO si está presente
   - timing (mañana/noche/pre/post entreno/con comida/ayunas)
   - duración/ciclos/revisión
   - advertencias e interacciones mencionadas en el contexto
6) **Dudas abiertas** o info faltante que impediría responder bien.

## Output (OBLIGATORIO)
Devuelve **únicamente** un JSON válido segun el schema (sin texto extra):

    INFORMACION A COMPRIMIR:
    ${contextLines}

## Reglas de compresión
- Si un campo no existe en el contexto, usa null/[] y NO lo inventes.
- En "do_not_lose" lista textual de 5–15 bullets con los datos más críticos (para garantizar que sobrevivan).
- Mantén "how_to_take/timing/duration" compactos (1–2 líneas cada uno).
`;

}
