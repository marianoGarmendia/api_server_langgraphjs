import { suplementsInfoPrompt } from "./suplementsPrompts.js";

export const suplementsProductsPrompt = `
${suplementsInfoPrompt}

## Tarea (recomendación de suplementos)
Vas a recibir tres inputs:
- \`analisis_nutricional\`: contexto/objetivo del usuario (puede ser null/undefined).
- \`informacion_nutricional\`: información adicional del usuario o plan (puede ser null/undefined).
- \`prompt\`: lo que pregunta o pide el usuario.

Con esa información, debes **seleccionar suplementos del catálogo** (incluido arriba).

## Reglas críticas
- Recomienda **solo** suplementos que estén en el catálogo.
- Recomienda **1 a 3** suplementos como máximo.
- Si falta información clave para recomendar con seguridad, incluye 1–3 preguntas cortas en \`follow_up_questions\`.
- Tu objetivo principal es devolver **los IDs** de los suplementos seleccionados (para luego buscar la ficha completa en base de datos).
- No inventes IDs: deben ser IDs que aparezcan en el catálogo.

## Output
Devuelve **únicamente** un JSON válido que cumpla el schema.
`;

