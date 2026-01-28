import { Document, WithId } from "mongodb";
import { getWsMongoDb, getWsPlatosCollectionName } from "./mongoClientWs.js";

export type PlatoWsDoc = WithId<Document>;

function parseMaybeNumberId(id: string): number | null {
  const trimmed = (id ?? "").trim();
  if (!trimmed) return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export async function listMealTypesWs(): Promise<string[]> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();

  const values = await db
    .collection(collectionName)
    .distinct("props.meal_type");
  return values
    .filter((v: unknown) => typeof v === "string" && v.trim().length > 0)
    .map((v: string) => v.trim())
    .sort((a, b) => a.localeCompare(b, "es"));
}

export async function listPlatosWs({
  limit = 50,
  skip = 0,
  filter = {},
}: {
  limit?: number;
  skip?: number;
  filter?: Record<string, unknown>;
} = {}): Promise<PlatoWsDoc[]> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();

  return await db
    .collection(collectionName)
    .find(filter, { limit, skip })
    .toArray();
}

export async function listPlatosWsByMealType({
  meal_type,
  limit = 50,
  skip = 0,
}: {
  meal_type: string;
  limit?: number;
  skip?: number;
}): Promise<PlatoWsDoc[]> {
  const mt = (meal_type ?? "").trim();
  if (!mt) return [];

  return await listPlatosWs({
    limit,
    skip,
    filter: { "props.meal_type": mt },
  });
}

/**
 * Trae un plato "completo" por id.
 * Soporta:
 * - `_id` numérico (como en tus documentos)
 * - `id_producto` numérico
 */
export async function getPlatoWsById(
  id: string | number
): Promise<PlatoWsDoc | null> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();

  if (typeof id === "number" && Number.isFinite(id)) {
    return await db
      .collection<PlatoWsDoc>(collectionName)
      .findOne({ $or: [{ _id: id }, { id_producto: id }] } as any);
  }

  const raw = String(id ?? "").trim();
  if (!raw) return null;

  const maybeNumber = parseMaybeNumberId(raw);
  if (maybeNumber !== null) {
    return await db.collection<PlatoWsDoc>(collectionName).findOne({
      $or: [{ _id: maybeNumber }, { id_producto: maybeNumber }],
    } as any);
  }

  // Si en el futuro `_id` fuera string (u ObjectId serializado), intentamos por igualdad directa.
  return await db
    .collection<PlatoWsDoc>(collectionName)
    .findOne({ _id: raw } as any);
}

/**
 * Trae un plato "completo" por el campo `nombre` (a nivel raíz).
 * Intenta match exacto primero, y luego case-insensitive.
 */
export async function getPlatoWsByNombre(
  nombre: string
): Promise<PlatoWsDoc | null> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();
  const q = (nombre ?? "").trim();
  if (!q) return null;

  const exact = await db
    .collection<PlatoWsDoc>(collectionName)
    .findOne({ nombre: q } as any);
  if (exact) return exact;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return await db
    .collection<PlatoWsDoc>(collectionName)
    .findOne({ nombre: { $regex: `^${escaped}$`, $options: "i" } } as any);
}

export type PlatoWsNombreMealType = {
  nombre: string;
  meal_type: unknown;
};

/**
 * Devuelve todos los platos pero proyectando solo { nombre, meal_type }.
 * Útil para selección/filtrado en frontend/LLM sin traer documentos completos.
 */
export async function listPlatosWsNombreMealType(): Promise<
  PlatoWsNombreMealType[]
> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();

  const docs = await db
    .collection(collectionName)
    .find(
      {},
      {
        projection: {
          _id: 0,
          nombre: 1,
          "props.meal_type": 1,
        },
      }
    )
    .toArray();

  return docs
    .map((d: any) => ({
      nombre: typeof d?.nombre === "string" ? d.nombre : "",
      meal_type: d?.props?.meal_type ?? null,
    }))
    .filter((x) => x.nombre.trim().length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
