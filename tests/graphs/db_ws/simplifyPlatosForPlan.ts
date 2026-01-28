export type PlatoWsNutrition = {
  fats?: number;
  carbs?: number;
  fiber?: number;
  sodium?: number;
  protein?: number;
  calories?: number;
};

export type PlatoWsIngredient = {
  id?: string;
  name?: string;
  unit?: string;
  quantity?: number;
  nutritional_info?: PlatoWsNutrition;
};

export type PlatoWsLike = {
  _id?: unknown;
  id_producto?: unknown;
  nombre?: unknown;
  descripcion?: unknown;
  estado?: unknown;
  props?: {
    prep?: unknown;
    meal_type?: unknown;
    profiles?: unknown;
    nutrition?: unknown;
    ingredients?: unknown;
  };
};

export type SimplifiedPlateForPlan = {
  /** id estable para referencias (preferimos id_producto o _id numérico si existe) */
  id: string;
  nombre: string;
  estado?: string | null;
  meal_type: string[];
  /** Instrucciones/preparación corta para que el LLM entienda el plato */
  prep: string | null;
  /** Macros totales del plato (según fuente WS) */
  nutrition: Required<PlatoWsNutrition> | null;
  /** Ingredientes + cantidades (y su nutrición si viene) */
  ingredients: Array<{
    id: string | null;
    name: string;
    unit: string | null;
    quantity: number | null;
    nutrition: Required<PlatoWsNutrition> | null;
  }>;
  /** Campos auxiliares para ranking/filtrado */
  meta: {
    ingredientsCount: number;
    hasNutrition: boolean;
    hasIngredientNutrition: boolean;
  };
};

function asString(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  return s.length ? s : null;
}

function asNumber(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeMealTypes(mt: unknown): string[] {
  if (Array.isArray(mt)) {
    return mt
      .map((x) => asString(x))
      .filter((x): x is string => Boolean(x))
      .map((x) => x.toLowerCase());
  }
  const one = asString(mt);
  return one ? [one.toLowerCase()] : [];
}

function normalizeNutrition(n: unknown): Required<PlatoWsNutrition> | null {
  if (!n || typeof n !== "object") return null;
  const anyN = n as any;
  const fats = asNumber(anyN.fats);
  const carbs = asNumber(anyN.carbs);
  const fiber = asNumber(anyN.fiber);
  const sodium = asNumber(anyN.sodium);
  const protein = asNumber(anyN.protein);
  const calories = asNumber(anyN.calories);

  // Si no hay nada, devolvemos null
  if (
    fats == null &&
    carbs == null &&
    fiber == null &&
    sodium == null &&
    protein == null &&
    calories == null
  ) {
    return null;
  }

  return {
    fats: fats ?? 0,
    carbs: carbs ?? 0,
    fiber: fiber ?? 0,
    sodium: sodium ?? 0,
    protein: protein ?? 0,
    calories: calories ?? 0,
  };
}

function buildStableId(doc: PlatoWsLike): string {
  const idProducto = asNumber(doc.id_producto);
  if (idProducto != null) return String(idProducto);
  const idNum = asNumber(doc._id);
  if (idNum != null) return String(idNum);
  const idStr = asString(doc._id);
  if (idStr) return idStr;
  return "unknown";
}

/**
 * Simplifica documentos "platos WS" a la información mínima y consistente
 * para que un LLM pueda armar un plan semanal.
 *
 * Mantiene:
 * - nombre, meal_type, prep
 * - macros totales (props.nutrition)
 * - ingredientes con cantidades + nutrition por ingrediente si existe
 */
export function simplifyPlatosForWeeklyPlan(
  platos: PlatoWsLike[]
): SimplifiedPlateForPlan[] {
  const list = Array.isArray(platos) ? platos : [];

  return list
    .map((p) => {
      const id = buildStableId(p);
      const nombre = asString(p.nombre) ?? "(sin nombre)";
      const estado = asString(p.estado);

      const props = (p as any)?.props ?? {};
      const prep = asString(props.prep) ?? asString(p.descripcion);
      const meal_type = normalizeMealTypes(props.meal_type);

      const nutrition = normalizeNutrition(props.nutrition);

      const rawIngredients = Array.isArray(props.ingredients)
        ? (props.ingredients as any[])
        : [];

      const ingredients = rawIngredients
        .map((ing) => {
          const name = asString(ing?.name) ?? "";
          if (!name) return null;
          const unit = asString(ing?.unit);
          const quantity = asNumber(ing?.quantity);
          const nutritionIng = normalizeNutrition(ing?.nutritional_info);
          return {
            id: asString(ing?.id),
            name,
            unit,
            quantity,
            nutrition: nutritionIng,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      const hasIngredientNutrition = ingredients.some((i) => i.nutrition != null);

      return {
        id,
        nombre,
        estado,
        meal_type,
        prep: prep ?? null,
        nutrition,
        ingredients,
        meta: {
          ingredientsCount: ingredients.length,
          hasNutrition: nutrition != null,
          hasIngredientNutrition,
        },
      } satisfies SimplifiedPlateForPlan;
    })
    .filter((p) => p.id !== "unknown" || p.nombre !== "(sin nombre)");
}


