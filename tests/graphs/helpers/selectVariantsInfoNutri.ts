import { SystemMessage } from "@langchain/core/messages";
import { promises as fs } from "fs";
import * as z from "zod";

import {
  getVariantsByCanonical,
  getInfoNutritionalVariantsByCanonical,
} from "../api/nutri-api.js";
import { buildModel } from "../models/chatModels.js";
import { invokeWithRetry } from "./retrys.js";

/**
 * Schema estructurado que devuelve el modelo para decidir:
 * - qué ingredientes canónicos usar
 * - qué variantes (usdaDescription) de cada canónico priorizar
 */
const VariantChoiceSchema = z.object({
  canonicalId: z.string().min(1),
  reason: z
    .string()
    .min(1)
    .describe(
      "Motivo por el cual este ingrediente canónico es relevante para el perfil/plan",
    ),
  variants: z
    .array(
      z.object({
        usdaDescription: z.string().min(1),
        reason: z
          .string()
          .min(1)
          .describe(
            "Motivo por el cual esta variante concreta es adecuada para el perfil/plan",
          ),
      }),
    )
    .min(1),
});

const VariantSelectionSchema = z.object({
  selectedCanonicalVariants: z.array(VariantChoiceSchema).min(1),
});

export type VariantSelectionResult = z.infer<typeof VariantSelectionSchema>;

export interface SelectVariantsInfoNutriParams {
  /**
   * Perfil del usuario (objeto libre, normalmente el cuestionario completo).
   */
  userProfile: unknown;

  /**
   * Lista de IDs canónicos candidatos. Suele venir del endpoint
   * `/api/ingredients/canonical-ids` o de algún filtro previo.
   */
  canonicalIds: string[];

  /**
   * (Opcional) Bloque de análisis y propuesta de plan nutricional
   * generado por el analisisGraph/buildNutritionPlanTool.
   * Puede ser un objeto o un string JSON.
   */
  nutritionAnalysisAndPlan?: unknown;

  /**
   * Directorio donde se escribirá el JSON final.
   * Por defecto: `./nutriWorkspace`
   */
  outputDir?: string;

  /**
   * Nombre de archivo del JSON final.
   * Por defecto: `ingredients_variants_nutri.json`
   */
  outputFileName?: string;
}

export interface SelectedVariantNutritionInfo {
  canonicalId: string;
  usdaDescription: string;
  selectionReason: string;
  /**
   * Payload devuelto por
   * `/api/ingredients/:id/variants/by-usda-description?usdaDescription=...`
   * tal cual, para mantener trazabilidad.
   */
  nutritionPayload: unknown;
}

export interface CanonicalWithVariantsNutrition {
  canonicalId: string;
  /**
   * Lista completa de descripciones USDA disponibles para este canónico.
   * Devuelta por `/api/ingredients/:id/usda-descriptions`.
   */
  availableUsdaDescriptions: string[];
  /**
   * Variantes seleccionadas por el modelo + su información nutricional.
   */
  selectedVariants: SelectedVariantNutritionInfo[];
}

export interface SelectVariantsInfoNutriResult {
  /**
   * Ruta absoluta/relativa del archivo JSON escrito en disco.
   */
  filePath: string;
  /**
   * Nombre de archivo (sin ruta).
   */
  fileName: string;
  /**
   * Objeto estructurado con canónicos, variantes seleccionadas
   * y su información nutricional.
   */
  data: CanonicalWithVariantsNutrition[];
  /**
   * Respuesta “cruda” del modelo con la decisión de canónicos/variantes.
   * Útil para depurar o para otros nodos.
   */
  variantSelection: VariantSelectionResult;
}

/**
 * Construye el prompt de sistema para que el modelo elija:
 * - qué ingredientes canónicos usar
 * - qué variantes (usdaDescriptions) priorizar de cada uno
 * en base al perfil del usuario y (opcionalmente) al análisis/propuesta de plan.
 */
function buildVariantSelectionPrompt(args: {
  userProfile: unknown;
  nutritionAnalysisAndPlan?: unknown;
  canonicalWithUsdaDescriptions: Array<{
    canonicalId: string;
    usdaDescriptions: string[];
  }>;
}): SystemMessage {
  const { userProfile, nutritionAnalysisAndPlan, canonicalWithUsdaDescriptions } =
    args;

  const profileText =
    typeof userProfile === "string"
      ? userProfile
      : JSON.stringify(userProfile, null, 2);

  const analysisText =
    nutritionAnalysisAndPlan == null
      ? "Aún no se proporcionó un análisis estructurado; decide usando buenas prácticas generales de nutrición."
      : typeof nutritionAnalysisAndPlan === "string"
        ? nutritionAnalysisAndPlan
        : JSON.stringify(nutritionAnalysisAndPlan, null, 2);

  const canonicalText =
    canonicalWithUsdaDescriptions.length === 0
      ? "No se proporcionaron ingredientes canónicos."
      : canonicalWithUsdaDescriptions
          .map(
            (c) =>
              `- canonicalId: ${c.canonicalId}\n  usdaDescriptions:\n${c.usdaDescriptions
                .map((u) => `    - ${u}`)
                .join("\n")}`,
          )
          .join("\n");

  return new SystemMessage(`
Eres un nutricionista experto en selección de ingredientes y sus variantes para construir **planes de comidas personalizados**.

Siempre responde **EXCLUSIVAMENTE** con un objeto JSON que cumpla el schema indicado.
No incluyas texto fuera del JSON, ni explicaciones adicionales.

---
## Perfil del usuario

Tienes el siguiente perfil (cuestionario) del usuario:

${profileText}

---
## Análisis y propuesta de plan (si existe)

Este bloque resume el análisis previo y las recomendaciones para el plan nutricional:

${analysisText}

---
## Ingredientes canónicos disponibles y sus variantes USDA

Cada ingrediente está representado por un \`canonicalId\` y una lista de \`usdaDescriptions\` (variantes posibles, por ejemplo “crudo”, “cocido”, “desgrasado”, etc.).

${canonicalText}

---
## Tu tarea

1. Selecciona únicamente los **ingredientes canónicos más relevantes** para este usuario y su plan.
2. Para cada canónico seleccionado, elige **1 a 3 variantes USDA** (\`usdaDescriptions\`) que:
   - Sean coherentes con el objetivo principal del usuario (ganar músculo, perder grasa, mantenimiento, etc.).
   - Respeten sus restricciones, intolerancias y preferencias cuando sea posible.
   - Sean prácticas para su contexto de cocina (tiempo disponible, equipamiento).
3. Justifica brevemente:
   - Por qué eliges ese ingrediente canónico (\`reason\`).
   - Por qué eliges cada variante específica (\`variants[*].reason\`).

Restricciones importantes:
- **Nunca inventes canonicalIds ni usdaDescriptions**; sólo puedes usar los que aparecen en la lista anterior.
- No devuelvas más de 15 ingredientes canónicos seleccionados en total.
- Para cada canónico, devuelve entre 1 y 3 variantes como máximo.

---
## Formato de salida

Devuelve **únicamente** un objeto JSON que cumpla este esquema (en términos conceptuales):
{
  "selectedCanonicalVariants": [
    {
      "canonicalId": "string",
      "reason": "string (explica por qué este ingrediente es útil para el plan)",
      "variants": [
        {
          "usdaDescription": "string (debe existir en la lista del canónico)",
          "reason": "string (por qué esta variante concreta es adecuada)"
        }
      ]
    }
  ]
}

No añadas comentarios ni texto extra fuera del JSON.
`);
}

/**
 * Orquesta todo el flujo:
 * 1) Recibe un perfil de usuario y una lista de IDs canónicos.
 * 2) Para cada canónico, llama al endpoint de descripciones USDA
 *    `/api/ingredients/:id/usda-descriptions`.
 * 3) Pasa el perfil + análisis/propuesta de plan + lista de canónicos/variantes
 *    a un modelo estructurado que decide qué canónicos y variantes priorizar.
 * 4) Para cada combinación seleccionada (canonicalId + usdaDescription) llama
 *    a `/api/ingredients/:id/variants/by-usda-description?usdaDescription=...`
 *    para obtener la información nutricional.
 * 5) Escribe en un archivo JSON toda la información y devuelve tanto el nombre
 *    del archivo como el objeto completo.
 */
export async function selectVariantsInfoNutri(
  params: SelectVariantsInfoNutriParams,
): Promise<SelectVariantsInfoNutriResult> {
  const {
    userProfile,
    canonicalIds,
    nutritionAnalysisAndPlan,
    outputDir = "./nutriWorkspace",
    outputFileName = "ingredients_variants_nutri.json",
  } = params;

  if (!Array.isArray(canonicalIds) || canonicalIds.length === 0) {
    throw new Error(
      "selectVariantsInfoNutri: se requiere una lista no vacía de canonicalIds.",
    );
  }

  // 1) Obtener, para cada canónico, sus posibles variantes (usdaDescriptions)
  const canonicalWithUsdaDescriptions: Array<{
    canonicalId: string;
    usdaDescriptions: string[];
  }> = [];

  for (const canonicalId of canonicalIds) {
    try {
      const variantsData = await getVariantsByCanonical(canonicalId);
      const usdaDescriptions: string[] =
        (variantsData as any)?.usdaDescriptions ?? [];

      if (!Array.isArray(usdaDescriptions) || usdaDescriptions.length === 0) {
        console.warn(
          `[selectVariantsInfoNutri] El canónico ${canonicalId} no tiene usdaDescriptions disponibles; se omite en la selección.`,
        );
        continue;
      }

      canonicalWithUsdaDescriptions.push({
        canonicalId,
        usdaDescriptions,
      });
    } catch (err) {
      console.error(
        `[selectVariantsInfoNutri] Error obteniendo usda-descriptions para canónico ${canonicalId}:`,
        err,
      );
      // En vez de romper todo el flujo, seguimos con el siguiente canónico
      continue;
    }
  }

  if (canonicalWithUsdaDescriptions.length === 0) {
    throw new Error(
      "selectVariantsInfoNutri: ningún canónico tiene usdaDescriptions disponibles.",
    );
  }

  // 2) Llamar al modelo para seleccionar canónicos y variantes más adecuadas
  const model = buildModel();
  const prompt = buildVariantSelectionPrompt({
    userProfile,
    nutritionAnalysisAndPlan,
    canonicalWithUsdaDescriptions,
  });

  const variantSelection = await invokeWithRetry({
    model,
    schema: VariantSelectionSchema,
    basePrompt: prompt,
    maxAttempts: 3,
  });

  const resultItems: CanonicalWithVariantsNutrition[] = [];

  // 3) Para cada combinación seleccionada, llamar al endpoint de info nutricional
  for (const item of variantSelection.selectedCanonicalVariants) {
    const canonicalId = item.canonicalId;

    const available = canonicalWithUsdaDescriptions.find(
      (c) => c.canonicalId === canonicalId,
    );

    if (!available) {
      console.warn(
        `[selectVariantsInfoNutri] El modelo devolvió un canonicalId (${canonicalId}) que no estaba en la lista original. Se ignora.`,
      );
      continue;
    }

    const selectedVariants: SelectedVariantNutritionInfo[] = [];

    for (const v of item.variants) {
      const { usdaDescription, reason } = v;

      if (!available.usdaDescriptions.includes(usdaDescription)) {
        console.warn(
          `[selectVariantsInfoNutri] El modelo devolvió una usdaDescription (${usdaDescription}) que no pertenece al canónico ${canonicalId}. Se ignora.`,
        );
        continue;
      }

      try {
        const nutritionPayload =
          await getInfoNutritionalVariantsByCanonical(canonicalId, usdaDescription);

        selectedVariants.push({
          canonicalId,
          usdaDescription,
          selectionReason: reason,
          nutritionPayload,
        });
      } catch (err) {
        console.error(
          `[selectVariantsInfoNutri] Error obteniendo info nutricional para ${canonicalId} / ${usdaDescription}:`,
          err,
        );
        continue;
      }
    }

    if (selectedVariants.length === 0) {
      console.warn(
        `[selectVariantsInfoNutri] No se pudo obtener información nutricional para ninguna variante del canónico ${canonicalId}.`,
      );
      continue;
    }

    resultItems.push({
      canonicalId,
      availableUsdaDescriptions: available.usdaDescriptions,
      selectedVariants,
    });
  }

  if (resultItems.length === 0) {
    throw new Error(
      "selectVariantsInfoNutri: el modelo seleccionó variantes, pero ninguna devolvió información nutricional válida.",
    );
  }

  // 4) Escribir el resultado en JSON
  const dir = outputDir;
  const fileName = outputFileName;
  const filePath = `${dir}/${fileName}`;

  console.log("Result items -->", filePath)

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        canonicalVariantsNutrition: resultItems,
        variantSelection,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    filePath,
    fileName,
    data: resultItems,
    variantSelection,
  };
}
