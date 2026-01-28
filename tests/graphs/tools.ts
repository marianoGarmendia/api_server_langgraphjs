// import { tool } from "@langchain/core/tools";
import { tool } from "langchain";
// import fs from "node:fs";
import {
  searchIngredientsByDescription,
  listIngredientCards,
} from "./db/index.js";
import analysisSchema, { mealBucketSchema, weeklyPlanSchema } from "./schemas.js";
import { invokeWithRetry } from "./helpers/retrys.js";
import { buildPromptAnalysis } from "./prompts/analisisAgent.js";
import { buildPromptNutritionPlan } from "./prompts/buildNutritionPlanPrompt.js";
import { buildModel } from "./models/chatModels.js";
import { buildIngredientsPrompt } from "./prompts/buildIngredientsPrompt.js";
import { buildMealsPrompt } from "./prompts/buildMealsPrompt.js";
import { buildWeeklyPlanPrompt } from "./prompts/buildWeeklyPlanPrompt.js";
import { buildModifyMealPrompt } from "./prompts/modifyMealPrompt.js";
import { suplementsProductsPrompt } from "./prompts/suplementsProductsPrompt.js";
import { suplementsPrescriptionPrompt } from "./prompts/suplementsPrompts.js";
import {
  listPlatosWsByMealType,
  getPlatoWsByNombre,
  listPlatosWsNombreMealType,
} from "./db_ws/platosRepository.js";
import { SystemMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { comprimedSchema } from "./schemas.js";
import { z } from "zod";
import { objetivo, composicion, restricciones, tipo_de_plato, practicidad, cocina } from "./constants/mealTags.js";
import { buildPromptSelectWeeklyPlanCandidates } from "./prompts/selectWeeklyPlanCandidatesPrompt.js";
import { comprimedPrompt } from "./prompts/comprimedPrompt.js";

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    },
    2
  );
}

const getAllPlatesByTool = async () => {
  // const platos = await listPlatosWsByMealType({ meal_type });
  const platos = await listPlatosWsNombreMealType();
  return platos;
};

// const test = async () => {
//   const platos = await listPlatosWsByMealType({ meal_type: "desayuno" });
//   platos.forEach((plato) => {
//     console.log("--------------------------------");
//     console.log(plato.nombre);
//     console.log(plato.props.meal_type);
//   });

//   const plato = await getPlatoWsByNombre(
//     "BOWL DE AVENA CON YOGUR GRIEGO, PLÁTANO Y MIEL"
//   );
//   console.log("plato:", plato);
//   console.log("--------------------------------");
//   console.log("ingredients:");
//   console.dir(plato.props.ingredients, { depth: null });
// };
// test();
const analysisTool = tool(
  async ({ user_profile }: { user_profile: unknown }) => {
    try {
      const prompt = buildPromptAnalysis(user_profile);
      const model = buildModel("gpt-4o");

      // Valida contra `analysisSchema` y reintenta hasta 3 veces si el output no cumple.
      const result = await invokeWithRetry({
        model,
        schema: analysisSchema,
        basePrompt: prompt,
        maxAttempts: 3,
      });

      return result;
    } catch (err: any) {
      console.error(
        "[analysisTool] No se pudo validar el schema tras 3 intentos:",
        err?.message ?? err
      );
      return "No se pudo armar el perfil nutricional porque el modelo no respetó el schema después de 3 intentos.";
    }
  },
  {
    name: "analysisTool",
    description:
      "Analiza el perfil del usuario y devuelve un perfil nutricional estructurado (validado por schema).",
    schema: z.object({
      user_profile: z
        .any()
        .describe("Perfil del usuario (objeto JSON o string)"),
    }),
  }
);

const getDescriptions = async () => {
  try {
    const cards = await listIngredientCards();
    return cards.map((card) => card.description);
  } catch (error) {
    console.error("Error al obtener las descripciones:", error);
    return [];
  }
};

const ingredientSchema = z.object({
  description: z.string().describe("La descripción del ingrediente"),
  role: z
    .enum(["protein", "vegetable", "carb", "fat", "condiment"])
    .describe("El rol del ingrediente"),
  notes: z.string().describe("Las notas del ingrediente").nullable(),
});

const plateOptionSchema = z.object({
  optionName: z
    .string()
    .describe("Nombre corto de la opción (ej: 'Opción 1: merluza + brócoli')"),
  query: z
    .string()
    .describe("Query corta para esta opción de plato")
    .nullable(),
  selectedIngredients: z.array(ingredientSchema).min(3).max(6),
});

const schema = z.object({
  query: z.string().describe("Resumen corto del pedido del usuario"),
  plateOptions: z
    .array(plateOptionSchema)
    .min(3)
    .describe("Opciones de platos (mínimo 3)"),
  substitutions: z
    .array(
      z.object({
        requested: z.string(),
        used: z.string(),
        reason: z.string(),
      })
    )
    .describe("Sustituciones aplicadas cuando faltan ingredientes")
    .nullable(),
  missing: z
    .array(z.string())
    .describe("Cosas pedidas que no estaban en la lista")
    .nullable(),
});
// Determina la query con la que debe determinar el ingrediente
export const determineIngredients = tool(
  async ({ query }: { query: string }) => {
    try {
      const ids = await getDescriptions();
      const prompt = buildIngredientsPrompt(ids, query);
      // Evitamos `json_schema` en el request porque OpenAI puede rechazar schemas con `$ref` + metadata.
      const model = buildModel("gpt-4o");
      const structuredModel = model.withStructuredOutput(schema, {
        strict: true,
      });
      const response = await structuredModel.invoke(prompt);
      return response;
    } catch (error) {
      console.error("Error al determinar la query:", error);
      return {
        error: "Error al determinar la query",
      };
    }
  },
  {
    name: "determineIngredients",
    description: "Selecciona los ingredientes para el plato solicitado",
    schema: z.object({
      query: z
        .string()
        .describe("La query con la que debe determinar el ingrediente"),
    }),
  }
);

const fetchIngredientsById = tool(
  async (id: string) => {
    const ingredient = await searchIngredientsByDescription({
      query: id,
      limit: 1,
    });
    return ingredient;
  },
  {
    name: "fetchIngredientsById",
    description: "Busca un ingrediente por su id",
    schema: z.object({
      id: z.string().describe("El id del ingrediente"),
    }),
  }
);

const schemaSelectPlates = z.object({
  nombres: z
    .array(z.string())
    .describe(
      "Nombres de los platos exactos que se deben seleccionar, para luego con ellos buscar el plato completo en la base de datos"
    ),
});

const selectPlatesTool = tool(
  async ({ analysis, meal_type }: { analysis: unknown; meal_type: string }) => {
    const platos = await getAllPlatesByTool();

    const prompt = buildPromptSelectWeeklyPlanCandidates({
      userAnalysis: analysis,
      plates: platos,
    });
    const model = buildModel();
    const result = await invokeWithRetry({
      model,
      schema: schemaSelectPlates,
      basePrompt: prompt,
      maxAttempts: 3,
    });


    const platesSelected = await Promise.all(
      result.nombres.map(async (nombre: string) => {
        const plato = await getPlatoWsByNombre(nombre);
        return plato;
      })
    );
    console.log("platesSelected", platesSelected);

    return new Command({
      update: {
        plates: platesSelected,
      },
    });
  },
  {
    name: "selectPlatesTool",
    description:
      "Selecciona los platos para el plan de nutriciónal semanal en base al análisis nutricional del usuario y los platos disponibles",
    schema: z.object({
      analysis: z.any().describe("Análisis nutricional del usuario"),
    }),
  }
);
const buildNutritionPlanTool = tool(
  async ({ analysis }: { analysis: unknown }) => {
    console.log("analysis buildNutritionPlanTool", analysis);
    const model = buildModel();
    const prompt = buildPromptNutritionPlan(analysis);
    const result = await invokeWithRetry({
      model,
      schema: analysisSchema,
      basePrompt: prompt,
      maxAttempts: 3,
    });
    return result;
  },
  {
    name: "buildNutritionPlanTool",
    description: "Construye un plan de nutrición basado en un cuestionario",
    schema: z.object({
      analysis: z.any().describe("Análisis nutricional del usuario"),
    }),
  }
);
const ingredientSchemaBuildMeals = z.object({
  ingredient: z.string().describe("Ingrediente"),
  cantidad: z.object({
    cantidad: z
      .number()
      .describe("Cantidad del ingrediente para la porcion del plato"),
    unidad: z
      .string()
      .describe(
        "Unidad de la cantidad del ingrediente para la porcion del plato"
      ),
  }),
});

// Tags controladas (para poder filtrar consistentemente)
// const mealTagSchema = z.enum(MEAL_TAGS);

const schemaBuildMeals = z.object({
  meals: z.array(
    z.object({
      name: z.string().describe("Nombre del plato"),
      ingredients: z.array(z.string().describe("Ingredientes del plato")),
      descripcion: z.string().describe("una breve descripción del plato para mostrar al usuario"),
      instructions: z.string().describe("Instrucciones para preparar el plato"),
      objetivo: z.array(z.enum(objetivo)).min(1).describe("Selecciona 1 o más objetivos (array)."),
      composicion: z.array(z.enum(composicion)).min(1).describe("Selecciona 1 o más composiciones (array)."),
      restricciones: z.array(z.enum(restricciones)).min(1).describe("Selecciona 1 o más restricciones (array)."),
      tipo_de_plato: z.array(z.enum(tipo_de_plato)).min(1).describe("Selecciona 1 o más tipos de plato (array)."),
      practicidad: z.array(z.enum(practicidad)).min(1).describe("Selecciona 1 o más practicidades (array)."),
      cocina: z.array(z.enum(cocina)).min(1).describe("Selecciona 1 o más cocinas (array)."),
      cantidad: z.array(ingredientSchemaBuildMeals),
    })
  ),
});

const buildMealsTool = tool(
  async ({
    ingredients_info,
    platesProps,
  }: {
    ingredients_info: any[];
    platesProps: any[];
  }) => {
    const prompt = buildMealsPrompt(ingredients_info, platesProps);
    const model = buildModel();

    const result = await invokeWithRetry({
      model,
      schema: schemaBuildMeals,
      basePrompt: new SystemMessage(prompt),
      maxAttempts: 3,
    });
    return result;
  },
  {
    name: "buildMealsTool",
    description:
      "Construye platos a partir de ingredientes y opciones de platos",
    schema: z.object({
      ingredients_info: z
        .any()
        .describe("Array con info desde Mongo (matches + nutrients)"),
      platesProps: z
        .any()
        .describe("Opciones de plato generadas por determineIngredients"),
    }),
  }
);

const buildWeeklyPlanTool = tool(
  async ({
    simplifiedPlates,
    analysis,
    weekNumber,
    totalWeeks,
    previousWeeksSummary,
  }: {
    simplifiedPlates: any[];
    analysis: any;
    weekNumber: number;
    totalWeeks: number;
    previousWeeksSummary?: string;
  }) => {
    const prompt = buildWeeklyPlanPrompt(
      analysis,
      simplifiedPlates,
      weekNumber,
      totalWeeks,
      previousWeeksSummary
    );
    const model = buildModel('gpt-5-mini');
    const fallbackModel = buildModel("gpt-5.2");
    const result = await invokeWithRetry({
      model,
      schema: weeklyPlanSchema,
      basePrompt: prompt,
      maxAttempts: 3,
      fallback: { model: fallbackModel, maxAttempts: 2 },
    });
    return result;
  },
  {
    name: "buildWeeklyPlanTool",
    description: "Construye un plan de nutrición semanal basado en platos simplificados",
    schema: z.object({
      simplifiedPlates: z.any().describe("Platos simplificados"),
      analysis: z.any().describe("Análisis nutricional del usuario"),
      weekNumber: z.number().describe("Número de semana (1..totalWeeks)"),
      totalWeeks: z.number().describe("Cantidad total de semanas a generar (max 4)"),
      previousWeeksSummary: z
        .string()
        .optional()
        .describe("Resumen de semanas previas para continuidad"),
    }),
  }
);

const modifyMealTool = tool(
  async ({
    analysis,
    user_profile,
    mealToModify,
    dayMeals,
    availablePlates,
    nutritionistPrompt,
  }: {
    analysis: unknown;
    user_profile: unknown;
    mealToModify: unknown;
    dayMeals: unknown;
    availablePlates: unknown;
    nutritionistPrompt: string;
  }) => {
    const prompt = buildModifyMealPrompt({
      analysis,
      user_profile,
      mealToModify,
      dayMeals,
      availablePlates,
      nutritionistPrompt,
    });

    const model = buildModel();
    const fallbackModel = buildModel("gpt-5.2");

    const result = await invokeWithRetry({
      model,
      schema: mealBucketSchema,
      basePrompt: prompt,
      maxAttempts: 3,
      fallback: { model: fallbackModel, maxAttempts: 2 },
    });

    return result;
  },
  {
    name: "modifyMealTool",
    description:
      "Regenera un bucket de 2–3 opciones de comida para reemplazar/modificar un plato, usando analysis + perfil + contexto del día.",
    schema: z.object({
      analysis: z.any().describe("Análisis nutricional del usuario"),
      user_profile: z.any().describe("Perfil del usuario"),
      mealToModify: z.any().describe("El bloque/meal a modificar"),
      dayMeals: z.any().describe("Array de platos del día para evitar repetición"),
      availablePlates: z
        .any()
        .describe("Platos candidatos disponibles para elegir (idealmente simplificados)"),
      nutritionistPrompt: z
        .string()
        .describe("Instrucciones del nutricionista para regenerar el plato"),
    }),
  }
);

// const suplementsInfoTool = tool(
//   async ({ query }: { query: string }, config) => {
//     // Debug: guardamos la config de ejecución (RunnableConfig) en un JSON
//     try {
//       const payload = { at: new Date().toISOString(), query, config };
//       fs.writeFileSync(
//         "suplementsInfoTool_config.json",
//         safeJsonStringify(payload),
//         "utf-8"
//       );
//     } catch (e) {
//       // No rompemos la tool por fallos de logging
//       console.warn("⚠️ No se pudo escribir suplementsInfoTool_config.json:", e);
//     }

//     const envios = `Los envíos son sin cargo (a través de Rapi).`;
//     const formasDePago = `Formas de pago: tarjeta de crédito, tarjeta de débito, PayPal, transferencia bancaria y Mercado Pago.`;
//     return `${envios} ${formasDePago}`;
//   },
//   {
//     name: "suplementsInfoTool",
//     description: "Responde información operativa (envíos y formas de pago) de Centenarian Road.",
//     schema: z.object({
//       query: z.string().describe("La pregunta del usuario"),
//     }),
//   }
// );

const suplementsProductsTool = tool(
  async (input: {
    analisis_nutricional?: unknown;
    informacion_nutricional?: unknown;
    prompt: string;
  }) => {
    const model = buildModel();
    const fallbackModel = buildModel("gpt-5.2");

    const suplementsRecommendationSchema = z.object({
      selected_ids: z
        .array(
          z
            .string()
            .describe(
              "ID del suplemento seleccionado (debe existir en el catálogo)"
            )
        )
        .min(1)
        .max(3)
        .describe("IDs de suplementos seleccionados para este usuario"),
        reason: z.string().describe("Razón por la que se seleccionaron los suplementos, intenta ser descriptivo y preciso"),
      follow_up_questions: z
        .array(z.string())
        .max(3)
        .describe("Preguntas cortas si falta información para recomendar con seguridad"),
    });

    const basePrompt = new SystemMessage(`
${suplementsProductsPrompt}

## Inputs
analisis_nutricional:
${safeJsonStringify(input.analisis_nutricional ?? null)}

informacion_nutricional:
${safeJsonStringify(input.informacion_nutricional ?? null)}

prompt:
${String(input.prompt ?? "").trim()}
`);

    const result = await invokeWithRetry({
      model,
      schema: suplementsRecommendationSchema,
      basePrompt,
      maxAttempts: 3,
      fallback: { model: fallbackModel, maxAttempts: 2 },
    });

    return result;
  },
  {
    name: "suplementsProductsTool",
    description:
      "Selecciona 1–3 IDs de suplementos del catálogo en base a analisis_nutricional, informacion_nutricional y el prompt del usuario.",
    schema: z.object({
      analisis_nutricional: z.any().describe("Contexto/objetivo del usuario (opcional)").nullable(),
      informacion_nutricional: z.any().describe("Info adicional del usuario o plan (opcional)").nullable(),
      prompt: z.string().describe("Lo que pide o pregunta el usuario"),
    }),
  }
)

const suplementsPrescriptionTool = tool(
  async (input: {
    suplements_raw: any[];
    analysis: any;
    informacion_nutricional: any;
    prompt: string;
  }) => {
    const model = buildModel();
    const fallbackModel = buildModel("gpt-5.2");

    const suplementsPrescriptionSchema = z.object({
      prescription: z.string().describe("Prescripción de suplementos en base a los suplementos seleccionados , el prompt del usuario y el análisis nutricional del usuario"),
    });
    const basePrompt = new SystemMessage(`
${suplementsPrescriptionPrompt}

## Análisis nutricional
${safeJsonStringify(input.analysis ?? null)}

## Información nutricional del plan nutricional actual del usuario
${safeJsonStringify(input.informacion_nutricional ?? null)}

## Inputs
suplements_raw:
${safeJsonStringify(input.suplements_raw ?? null)}

prompt:
${String(input.prompt ?? "").trim()}
`);

    const result = await invokeWithRetry({
      model,
      schema: suplementsPrescriptionSchema,
      basePrompt,
      maxAttempts: 3,
      fallback: { model: fallbackModel, maxAttempts: 2 },
    });

    return result;
  },
  {
    name: "suplementsPrescriptionTool",
    description: "Genera una prescripción de suplementos en base a los suplementos seleccionados , el prompt del usuario y el análisis nutricional del usuario",
    schema: z.object({
      suplements_raw: z.any().describe("Suplementos seleccionados"),
      prompt: z.string().describe("Lo que pide o pregunta el usuario"),
      analysis: z.any().describe("Análisis nutricional del usuario"),
      informacion_nutricional: z.any().describe("Información nutricional del plan nutricional actual del usuario"),
    }),
  }
)

const comprimedTool = tool(
  async (input: { context: any }) => {
    const model = buildModel("gpt-5-mini");
    const fallbackModel = buildModel("gpt-5");
    const prompt = comprimedPrompt(input.context);
    const result = await invokeWithRetry({
      model,
      schema: comprimedSchema,
      basePrompt: new SystemMessage(prompt),
      maxAttempts: 3,
      fallback: { model: fallbackModel, maxAttempts: 2 },
    });
    return result;
  },
  {
    name: "comprimirTool",
    description: "Comprime infomracion, extrayendo datos claves e importantes para el usuario y el proceso a continuacion",
      schema: z.object({
        context: z.any().describe("Contexto a comprimir"),
      })
    }
)

export {
  fetchIngredientsById,
  buildNutritionPlanTool,
  buildMealsTool,
  analysisTool,
  selectPlatesTool,
  buildWeeklyPlanTool,
  modifyMealTool,
  suplementsProductsTool,
  suplementsPrescriptionTool,
  comprimedTool,
};


