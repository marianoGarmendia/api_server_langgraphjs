import { ObjectId } from "mongodb";
import { getMongoDb } from "./mongoClient.js";
import type {
  IngredientCard,
  IngredientDetailedCard,
  IngredientDoc,
  IngredientTranslate,
  NutrientsObject,
} from "./types.js";

const COLLECTION_NAME = "ingredientes";

function safeObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export type SetIngredientTranslateResult =
  | { ok: true; matched: number; modified: number }
  | { ok: false; error: "invalid_object_id" | "empty_update" };

/**
 * Setea/actualiza los campos de `translate.*` de un ingrediente por `_id`.
 * - Solo actualiza las claves que vengan definidas (undefined => se ignora)
 * - Permite poner `null` explícitamente si lo necesitas
 */
export async function setIngredientTranslateById(options: {
  id: string;
  translate: IngredientTranslate;
}): Promise<SetIngredientTranslateResult> {
  const objectId = safeObjectId(options.id);
  if (!objectId) return { ok: false, error: "invalid_object_id" };

  const entries = Object.entries(options.translate ?? {});
  const setDoc: Record<string, string | null> = {};

  for (const [k, v] of entries) {
    if (v === undefined) continue;
    // guardamos como translate.<key> para no pisar otras claves
    setDoc[`translate.${k}`] = v as string | null;
  }

  if (Object.keys(setDoc).length === 0) {
    return { ok: false, error: "empty_update" };
  }

  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(COLLECTION_NAME);

  const res = await col.updateOne({ _id: objectId }, { $set: setDoc });

  return { ok: true, matched: res.matchedCount, modified: res.modifiedCount };
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeQuery(query: string): string[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  return q
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

// “Semántica” básica: expandimos algunas queries a términos típicos en USDA.
// (USDA descriptions suelen estar en inglés)
function expandSemanticTerms(query: string): string[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const synonyms: Record<string, string[]> = {
    chicken: ["chicken", "hen", "broiler"],
    // OJO: "whiting" en $text a veces matchea "white" (ruidoso). Lo usamos principalmente en regex.
    hake: ["hake", "whiting", "merluza"],
    merluza: ["merluza", "hake", "whiting"],
    beef: ["beef", "veal"],
    pork: ["pork", "ham"],
    salmon: ["salmon"],
    tuna: ["tuna"],
  };

  // tokenizamos por espacios simples
  const tokens = q.split(/\s+/g).filter(Boolean);
  const expanded = new Set<string>();

  for (const t of tokens) {
    expanded.add(t);
    const syns = synonyms[t];
    if (syns) syns.forEach((s) => expanded.add(s));
  }

  return Array.from(expanded).filter((t) => t.length >= 2);
}

function detectFoodCategoryHintRegex(terms: string[]): RegExp | null {
  const set = new Set(terms.map((t) => t.toLowerCase()));

  const fishTerms = [
    "hake",
    "merluza",
    "whiting",
    "fish",
    "cod",
    "salmon",
    "tuna",
  ];
  const poultryTerms = ["chicken", "turkey", "poultry"];

  if (fishTerms.some((t) => set.has(t))) {
    return /(fish|finfish|shellfish)/i;
  }
  if (poultryTerms.some((t) => set.has(t))) {
    return /(poultry)/i;
  }
  return null;
}

async function ensureTextIndex(): Promise<void> {
  const db = await getMongoDb();
  const col = db.collection(COLLECTION_NAME);
  // idempotente: si ya existe con ese nombre, no rompe.
  await col.createIndex(
    { "bestMatch.description": "text" },
    { name: "bestMatch_description_text" }
  );
}

export async function listIngredientCards(
 { limit = 500,
  collection_name = COLLECTION_NAME
}:{ limit?: number; collection_name?: string } = {}): Promise<IngredientCard[]> {
  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(collection_name);

  const docs = await col
    .find(
      { bestMatch: { $ne: null } },
      {
        projection: {
          _id: 1,
          "bestMatch.description": 1,
          "bestMatch.foodCategory": 1,
          "bestMatch.matchedQuery": 1,
        },
      }
    )
    .limit(limit)
    .toArray();

  return docs
    .filter((d) => d.bestMatch && d.bestMatch.description)
    .map((d) => ({
      _id: d._id,
      description: d.bestMatch!.description,
      foodCategory: d.bestMatch!.foodCategory,
      matchedQuery: d.bestMatch!.matchedQuery,
    }));
}

export async function getIngredientNutrientsById(
  id: string
): Promise<NutrientsObject | null> {
  const objectId = safeObjectId(id);
  if (!objectId) return null;

  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(COLLECTION_NAME);

  const doc = await col.findOne(
    { _id: objectId },
    { projection: { _id: 1, "bestMatch.nutrients": 1 } }
  );

  return doc?.bestMatch?.nutrients ?? null;
}

export async function searchIngredientsByDescription(options: {
  query: string;
  limit?: number;
}): Promise<IngredientCard[]> {
  const limit = Math.max(1, Math.min(50, options.limit ?? 10));
  // Regla: la query (tokens) debe estar incluida en description.
  const queryTokens = tokenizeQuery(options.query);
  if (queryTokens.length === 0) return [];

  // Mantenemos sinónimos como *apoyo* para ampliar, pero SIN sacar la regla anterior.
  const terms = expandSemanticTerms(options.query);
  const categoryHint = detectFoodCategoryHintRegex(terms);

  // AND por tokens de la query sobre description (case-insensitive)
  const mustMatchDescription = queryTokens.map((t) => ({
    "bestMatch.description": { $regex: escapeRegex(t), $options: "i" },
  }));

  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(COLLECTION_NAME);

  // 1) Intentar $text (mejor ranking) si hay índice.
  try {
    await ensureTextIndex();

    // Para $text usamos los términos expandidos (si no hay, usamos tokens)
    const search = (terms.length > 0 ? terms : queryTokens).join(" ");
    const docs = await col
      .find(
        {
          $text: { $search: search },
          bestMatch: { $ne: null },
          $and: mustMatchDescription,
          ...(categoryHint
            ? { "bestMatch.foodCategory": { $regex: categoryHint } }
            : {}),
        },
        {
          projection: {
            _id: 1,
            "bestMatch.description": 1,
            "bestMatch.foodCategory": 1,
            "bestMatch.matchedQuery": 1,
            score: { $meta: "textScore" },
          } as any,
        }
      )
      .sort({ score: { $meta: "textScore" } } as any)
      .limit(limit)
      .toArray();

    return docs
      .filter((d) => d.bestMatch && d.bestMatch.description)
      .map((d) => ({
        _id: d._id,
        description: d.bestMatch!.description,
        foodCategory: d.bestMatch!.foodCategory,
        matchedQuery: d.bestMatch!.matchedQuery,
        nutrients: d.bestMatch!.nutrients,
      }));
  } catch {
    // si falla (por permisos/índice/etc), hacemos fallback a regex
  }

  // 2) Fallback: regex case-insensitive por términos expandidos
  const ors = (terms.length > 0 ? terms : queryTokens).map((t) => ({
    "bestMatch.description": { $regex: escapeRegex(t), $options: "i" },
  }));

  const docs = await col
    .find(
      {
        bestMatch: { $ne: null },
        $or: ors,
        $and: mustMatchDescription,
        ...(categoryHint
          ? { "bestMatch.foodCategory": { $regex: categoryHint } }
          : {}),
      },
      {
        projection: {
          _id: 1,
          "bestMatch.description": 1,
          "bestMatch.foodCategory": 1,
          "bestMatch.matchedQuery": 1,
          totalHits: 1,
          foodsReturned: 1,
        },
      }
    )
    .sort({ foodsReturned: -1, totalHits: -1 })
    .limit(limit)
    .toArray();

  return docs
    .filter((d) => d.bestMatch && d.bestMatch.description)
    .map((d) => ({
      _id: d._id,
      description: d.bestMatch!.description,
      foodCategory: d.bestMatch!.foodCategory,
      matchedQuery: d.bestMatch!.matchedQuery,
    }));
}

/**
 * Igual que `searchIngredientsByDescription`, pero devuelve más información útil
 * para construir platos: incluye `totalHits`, `foodsReturned` y `bestMatch.nutrients`.
 *
 * Nota: esto evita tener que hacer un segundo query por `_id`.
 */
export async function searchIngredientsDetailedByDescription(options: {
  query: string;
  limit?: number;
}): Promise<IngredientDetailedCard[]> {
  const limit = Math.max(1, Math.min(50, options.limit ?? 10));
  const queryTokens = tokenizeQuery(options.query);
  if (queryTokens.length === 0) return [];

  const terms = expandSemanticTerms(options.query);
  const categoryHint = detectFoodCategoryHintRegex(terms);

  const mustMatchDescription = queryTokens.map((t) => ({
    "bestMatch.description": { $regex: escapeRegex(t), $options: "i" },
  }));

  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(COLLECTION_NAME);

  // 1) Intentar $text (mejor ranking) si hay índice.
  try {
    await ensureTextIndex();

    const search = (terms.length > 0 ? terms : queryTokens).join(" ");
    const docs = await col
      .find(
        {
          $text: { $search: search },
          bestMatch: { $ne: null },
          $and: mustMatchDescription,
          ...(categoryHint
            ? { "bestMatch.foodCategory": { $regex: categoryHint } }
            : {}),
        },
        {
          projection: {
            _id: 1,
            totalHits: 1,
            foodsReturned: 1,
            "bestMatch.description": 1,
            "bestMatch.foodCategory": 1,
            "bestMatch.matchedQuery": 1,
            "bestMatch.nutrients": 1,
            score: { $meta: "textScore" },
          } as any,
        }
      )
      .sort({ score: { $meta: "textScore" } } as any)
      .limit(limit)
      .toArray();

    return docs
      .filter((d) => d.bestMatch && d.bestMatch.description)
      .map((d) => ({
        _id: d._id,
        description: d.bestMatch!.description,
        foodCategory: d.bestMatch!.foodCategory,
        matchedQuery: d.bestMatch!.matchedQuery,
        totalHits: d.totalHits,
        foodsReturned: d.foodsReturned,
        nutrients: d.bestMatch!.nutrients ?? null,
      }));
  } catch {
    // fallback a regex
  }

  // 2) Fallback: regex case-insensitive por términos expandidos
  const ors = (terms.length > 0 ? terms : queryTokens).map((t) => ({
    "bestMatch.description": { $regex: escapeRegex(t), $options: "i" },
  }));

  const docs = await col
    .find(
      {
        bestMatch: { $ne: null },
        $or: ors,
        $and: mustMatchDescription,
        ...(categoryHint ? { "bestMatch.foodCategory": { $regex: categoryHint } } : {}),
      },
      {
        projection: {
          _id: 1,
          totalHits: 1,
          foodsReturned: 1,
          "bestMatch.description": 1,
          "bestMatch.foodCategory": 1,
          "bestMatch.matchedQuery": 1,
          "bestMatch.nutrients": 1,
        },
      }
    )
    .sort({ foodsReturned: -1, totalHits: -1 })
    .limit(limit)
    .toArray();

  return docs
    .filter((d) => d.bestMatch && d.bestMatch.description)
    .map((d) => ({
      _id: d._id,
      description: d.bestMatch!.description,
      foodCategory: d.bestMatch!.foodCategory,
      matchedQuery: d.bestMatch!.matchedQuery,
      totalHits: d.totalHits,
      foodsReturned: d.foodsReturned,
      nutrients: d.bestMatch!.nutrients ?? null,
    }));
}

export type UpsertIngredientsResult = {
  processed: number;
  skipped: number;
  matched: number;
  modified: number;
  upserted: number;
};

/**
 * Upsert masivo en la colección `ingredientes`, usando `bestMatch.description` como clave.
 * - NO usa `_id` del input (Mongo lo maneja).
 * - Si ya existe un doc con esa description, lo actualiza (set).
 */
export async function upsertIngredientsByDescription(
  docs: Array<Partial<Omit<IngredientDoc, "_id">>>
): Promise<UpsertIngredientsResult> {
  const valid = docs.filter(
    (d) => d?.bestMatch && typeof d.bestMatch?.description === "string" && d.bestMatch.description
  );
  const skipped = docs.length - valid.length;

  if (valid.length === 0) {
    return { processed: 0, skipped, matched: 0, modified: 0, upserted: 0 };
  }

  const db = await getMongoDb();
  const col = db.collection<IngredientDoc>(COLLECTION_NAME);

  const ops = valid.map((d) => {
    const desc = d.bestMatch!.description;
    const setDoc: Partial<IngredientDoc> = {
      bestMatch: d.bestMatch ?? null,
    };
    const unsetDoc: Record<string, ""> = {};

    if (d.totalHits !== null && d.totalHits !== undefined) {
      setDoc.totalHits = d.totalHits;
    } else {
      unsetDoc.totalHits = "";
    }

    if (d.foodsReturned !== null && d.foodsReturned !== undefined) {
      setDoc.foodsReturned = d.foodsReturned;
    } else {
      unsetDoc.foodsReturned = "";
    }

    const update: {
      $set: Partial<IngredientDoc>;
      $unset?: Record<string, "">;
    } = { $set: setDoc };

    if (Object.keys(unsetDoc).length > 0) {
      update.$unset = unsetDoc;
    }

    return {
      updateOne: {
        filter: { "bestMatch.description": desc },
        update,
        upsert: true,
      },
    };
  });

  const res = await col.bulkWrite(ops, { ordered: false });

  return {
    processed: valid.length,
    skipped,
    matched: res.matchedCount,
    modified: res.modifiedCount,
    upserted: res.upsertedCount,
  };
}