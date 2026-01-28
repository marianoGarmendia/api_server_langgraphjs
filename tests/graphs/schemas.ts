import { z } from "zod";


export const analysisSchema = z.object({
  perfil_nutricional: z
    .object({
      resumen_ejecutivo: z
        .string()
        .describe(
          "Resumen corto (5-10 líneas) con lo más importante para el plan: objetivo, restricciones, prioridades y estrategia general."
        ),

      datos_clave_extraidos: z
        .object({
          nombre: z.string().nullable().describe("Nombre del usuario si está disponible"),
          edad: z.number().int().nullable().describe("Edad (años) si está disponible"),
          sexo: z
            .enum(["male", "female", "other"])
            .nullable()
            .describe("Sexo reportado en el perfil si está disponible"),
          objetivo_principal: z
            .string()
            .nullable()
            .describe("Objetivo principal del usuario (p.ej. lose_fat, gain_muscle, recomposition, etc.)"),
          peso_kg: z.number().nullable().describe("Peso en kg si está disponible"),
          altura_cm: z.number().nullable().describe("Altura en cm si está disponible"),
          imc_estimado: z.number().nullable().describe("IMC estimado si se cuenta con peso y altura"),
          contexto_evento_o_fecha: z
            .string()
            .nullable()
            .describe("Evento/fecha o motivación específica si fue provista"),
          horarios_comidas_reportados: z
            .string()
            .nullable()
            .describe("Horarios de primera/última comida reportados"),
          comidas_por_dia_reportadas: z
            .string()
            .nullable()
            .describe("Cantidad de comidas por día reportada"),
        })
        .describe("Campos del perfil del usuario normalizados a un formato útil"),

      restricciones_y_preferencias: z
        .object({
          intolerancias: z
            .array(z.string())
            .describe("Intolerancias reportadas (ej: gluten, lactosa). Vacío si no hay"),
          alergias: z
            .array(z.string())
            .describe("Alergias reportadas. Vacío si no hay"),
          alimentos_a_evitar: z
            .array(z.string())
            .describe("Alimentos que el usuario evita por preferencia/aversión. Vacío si no hay"),
          preferencias: z
            .array(z.string())
            .describe("Preferencias relevantes para adherencia (ej: 'comidas simples', 'salado vs dulce')."),
          frecuencia_pescado_dias_semana: z
            .number()
            .int()
            .nullable()
            .describe("Días/semana que consume pescado (si el perfil lo indica)"),
          huevos_por_semana: z
            .string()
            .nullable()
            .describe("Huevos por semana reportados (ej: '6-8')"),
        })
        .describe("Restricciones duras y preferencias para maximizar adherencia"),

      targets: z
        .object({
          calorias: z
            .object({
              bmr_kcal: z
                .number()
                .nullable()
                .describe("BMR estimado en kcal/día (si se puede estimar)"),
              mantenimiento_kcal: z
                .number()
                .nullable()
                .describe("Calorías de mantenimiento estimadas en kcal/día (si se puede estimar)"),
              objetivo_kcal: z
                .number()
                .nullable()
                .describe("Calorías objetivo diarias (kcal/día) para el objetivo principal"),
              estrategia_calorica: z
                .string()
                .describe("Déficit/superávit recomendado y racional (conservador/moderado/agresivo)"),
              supuestos: z
                .array(z.string())
                .describe("Suposiciones explícitas usadas para estimar calorías (ej: actividad, entrenamiento)"),
            })
            .describe("Targets calóricos y supuestos de cálculo"),

          macronutrientes: z
            .object({
              proteinas_g: z
                .number()
                .nullable()
                .describe("Proteínas objetivo (g/día)"),
              carbohidratos_g: z
                .number()
                .nullable()
                .describe("Carbohidratos objetivo (g/día)"),
              grasas_g: z
                .number()
                .nullable()
                .describe("Grasas objetivo (g/día)"),
              fibra_g: z
                .number()
                .nullable()
                .describe("Fibra objetivo (g/día)"),
              racional_macros: z
                .string()
                .describe("Racional cualitativo de la distribución de macros"),
            })
            .describe("Targets de macros diarios"),

          distribucion_diaria_sugerida: z
            .array(
              z.object({
                comida: z
                  .string()
                  .describe("Nombre de la comida (ej: desayuno, almuerzo, merienda, cena)"),
                notas: z
                  .string()
                  .describe("Objetivo de esa comida (saciedad, pre/post entrenamiento, etc.)"),
              })
            )
            .describe("Cómo repartir el día en comidas según el perfil (sin menú detallado)"),
        })
        .describe("Targets de calorías/macros y estructura diaria sugerida"),

      brief_para_agente_planificador: z
        .object({
          reglas_duras: z
            .array(z.string())
            .describe("Reglas que el plan NO puede violar (alergias/intolerancias/aversión fuerte, etc.)"),
          prioridades: z
            .array(z.string())
            .describe("Prioridades del plan (ej: saciedad, simpleza, proteína alta, etc.)"),
          riesgos_y_bandera_roja: z
            .array(z.string())
            .describe("Riesgos/puntos rojos y cómo mitigarlos en el plan"),
          preguntas_para_afinar: z
            .array(z.string())
            .describe("Preguntas faltantes clave para mejorar precisión del plan"),
        })
        .describe("Resumen accionable para el agente que genera el plan"),
    })
    .describe("Perfil nutricional estructurado para pasar a un agente planificador"),

  analisis_del_usuario: z
    .object({
      resumen_general: z
        .string()
        .describe("Resumen general del caso y del contexto del usuario"),
      situacion_corporal_estimada: z
        .string()
        .describe("Descripción estimada de la composición corporal y estado físico"),
      sueno_y_descanso: z
        .string()
        .describe("Calidad, cantidad y regularidad del sueño y su impacto en el objetivo"),
      hidratacion_y_bebidas: z
        .string()
        .describe("Patrones de hidratación, consumo de agua y otras bebidas"),
      habitos_alimentarios_y_preferencias: z
        .string()
        .describe("Hábitos alimentarios actuales, gustos, aversiones y patrones de ingesta"),
      contexto_de_cocina_y_practicidad: z
        .string()
        .describe("Tiempo disponible para cocinar, equipamiento y grado de practicidad necesario"),
      fortalezas_clave: z
        .string()
        .describe("Puntos fuertes actuales que favorecen el éxito del plan"),
      oportunidades_de_mejora: z
        .string()
        .describe("Principales áreas de mejora y riesgos a trabajar"),
    })
    .describe("Análisis estructurado del usuario a partir del cuestionario"),

  recomendaciones_para_el_plan_nutricional: z
    .object({
      enfoque_calorico_y_objetivo: z
        .string()
        .describe("Recomendación sobre superávit/déficit/mantenimiento y grado de agresividad"),
      macronutrientes_orientacion_cualitativa: z
        .string()
        .describe("Rol y nivel recomendado de proteínas, carbohidratos y grasas"),
      estructura_diaria_de_comidas: z
        .string()
        .describe("Número de comidas sugerido, distribución y comidas principales"),
      estrategia_practica_en_cocina: z
        .string()
        .describe("Nivel de complejidad de recetas, uso de equipamiento y estrategias de ahorro de tiempo"),
      hidratacion_y_bebidas: z
        .string()
        .describe("Objetivos y ajustes en hidratación y consumo de bebidas"),
      pautas_relacionadas_con_el_sueno: z
        .string()
        .describe("Recomendaciones nutricionales vinculadas a la mejora del sueño"),
      ajustes_por_intolerancias_y_aversions: z
        .string()
        .describe("Adaptaciones por intolerancias, alergias o aversiones declaradas"),
      estrategia_de_adherencia_y_flexibilidad: z
        .string()
        .describe("Estrategias para mejorar la adherencia, manejo de antojos y flexibilidad del plan"),
      riesgos_y_advertencias: z
        .string()
        .describe("Posibles riesgos, banderas rojas y sugerencias de derivación médica si aplica"),
    })
    .describe("Recomendaciones estructuradas para el diseño del plan nutricional"),
});

// -----------------------------
// Weekly plan schema (plan semanal)
// -----------------------------

const weekDaySchema = z.enum([
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
]);

export const mealOptionSchema = z.object({
  plato_id: z.string().describe("ID estable del plato (de la fuente de platos simplificados)"),
  plato_nombre: z.string().describe("Nombre exacto del plato (tal cual viene en la fuente)"),
  portion: z.object({
    label: z.string().describe("Etiqueta de porción (ej: '1 porción')"),
    ingredients: z.array(
      z.object({
        name: z.string().describe("Nombre del ingrediente"),
        unit: z.string().nullable().describe("Unidad (ej: g, ml, unidad) o null si no aplica"),
        quantity: z.number().nullable().describe("Cantidad numérica o null si no se definió"),
      })
    ),
  }),
  prep: z.string().describe("Modo de preparación (resumen claro)"),
  nutrition: z
    .object({
      calories: z.number().describe("Calorías totales estimadas del plato"),
      protein: z.number().describe("Proteína total (g)"),
      carbs: z.number().describe("Carbohidratos totales (g)"),
      fats: z.number().describe("Grasas totales (g)"),
      fiber: z.number().describe("Fibra total (g)"),
      sodium: z.number().describe("Sodio total (mg)"),
    })
    .nullable()
    .describe("Información nutricional del plato; null si no está disponible"),
  tags: z.array(z.string()).describe("Tags del plato (para filtrado/metadata)"),
});

export const mealBucketSchema = z.object({
  options: z
    .array(mealOptionSchema)
    .min(2)
    .max(3)
    .describe("2 a 3 opciones para este tipo de comida"),
});

const dayPlanSchema = z.object({
  day: weekDaySchema.describe("Día de la semana"),
  meals: z.object({
    desayuno: mealBucketSchema,
    almuerzo: mealBucketSchema,
    merienda: mealBucketSchema,
    cena: mealBucketSchema,
    snack: mealBucketSchema,
  }),
});

export const weeklyPlanSchema = z.object({
  weekPlan: z.object({
    days: z
      .array(dayPlanSchema)
      .length(7)
      .describe("Plan semanal de 7 días"),
    notes: z
      .array(z.string())
      .describe("Notas generales: timing, hidratación, meal-prep, reglas del plan, etc."),
  }),
});

export const comprimedSchema = z.object({
  resumen_usuario: z.object({
    objetivo_principal: z.string().nullable(),
    objetivos_secundarios: z.array(z.string()),
    datos_perfil: z.object({
      edad: z.number().nullable(),
      sexo: z.string().nullable(),
      peso_kg: z.number().nullable(),
      altura_cm: z.number().nullable(),
      actividad: z.string().nullable(),
    }),
    banderas_riesgo: z.object({
      embarazo_o_lactancia: z.boolean().nullable(),
      medicamentos: z.array(z.string()),
      condiciones: z.array(z.string()),
      alergias_intolerancias: z.array(z.string()),
    }),
    rutina: z.object({
      horario_entrenamiento: z.string().nullable(),
      horario_sueno: z.string().nullable(),
    }),
  }),
  resumen_plan_nutricional: z.object({
    existe_plan: z.boolean(),
    aspectos_destacados: z.array(z.string()),
    brechas_potenciales: z.array(z.string()),
  }),
  plan_supletario: z.object({
    existe_plan: z.boolean(),
    elementos: z.array(
      z.object({
        id: z.string().nullable(),
        nombre: z.string().nullable(),
        motivo: z.string(),
        como_tomar: z.string().nullable(),
        momento: z.string().nullable(),
        duracion_ciclo: z.string().nullable(),
        advertencias: z.string().nullable(),
      })
    ),
    horario_diario_sugerido: z.string().nullable(),
  }),
  notas_de_seguridad: z.array(z.string()),
  preguntas_abiertas: z.array(z.string()),
  no_perder: z.array(z.string()),
});

export default analysisSchema;

