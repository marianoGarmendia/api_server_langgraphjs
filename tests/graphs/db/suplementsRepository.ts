import { ObjectId } from "mongodb";
import { getMongoDb } from "./mongoClient.js";

const COLLECTION_NAME = "suplementos";

function safeObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export type SuplementDoc = Record<string, unknown> & { _id: ObjectId };

export type SuplementDocTyped = {
  _id: ObjectId;
  nombre_corto?: string;
  nombre_detallado?: string;
  tags?: string[];
  descripcion?: string;
  contenido?: string;
  precio?: string;
  beneficios?: string;
  para_quien_es?: string;
  como_tomar?: string;
  info_nutricional?: string;
  advertencias?: string;
  evidencia_cientifica?: string;
  tiene_triple_certificacion?: boolean;
  imagenes?: string[];
};

export type SuplementCard = {
  _id: ObjectId;
  nombre_corto: string | null;
  nombre_detallado: string | null;
  descripcion: string | null;
  tags: string[];
  precio: string | null;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function listSuplementCards(limit = 500): Promise<SuplementCard[]> {
  const db = await getMongoDb();
  const col = db.collection<SuplementDocTyped>(COLLECTION_NAME);

  const docs = await col
    .find(
      {},
      {
        projection: {
          _id: 1,
          descripcion: 1,
          nombre_corto: 1,
          nombre_detallado: 1,
          tags: 1,
          precio: 1,
        },
      }
    )
    .limit(limit)
    .toArray();

  return docs.map((d) => ({
    _id: d._id,
    nombre_corto: asString(d.nombre_corto),
    nombre_detallado: asString(d.nombre_detallado),
    descripcion: asString(d.descripcion),
    tags: asStringArray(d.tags),
    precio: asString(d.precio),
  }));
}

export async function getSuplementById(id: string): Promise<SuplementDocTyped | null> {
  const objectId = safeObjectId(id);
  if (!objectId) return null;

  const db = await getMongoDb();
  const col = db.collection<SuplementDocTyped>(COLLECTION_NAME);
  return await col.findOne({ _id: objectId });
}

// Trae documentos completos por lista de ids (ObjectId en string).
// - Ignora ids invalidos
// - Devuelve en el mismo orden que `ids` (solo los encontrados)
export async function getSuplementsByIds(ids: string[]): Promise<SuplementDocTyped[]> {
  const inputIds = Array.isArray(ids) ? ids : [];
  if (inputIds.length === 0) return [];

  // Dedupe manteniendo orden
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  for (const id of inputIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    uniqueIds.push(trimmed);
  }

  const objectIds = uniqueIds
    .map((id) => ({ id, oid: safeObjectId(id) }))
    .filter((x): x is { id: string; oid: ObjectId } => x.oid !== null);

  if (objectIds.length === 0) return [];

  const db = await getMongoDb();
  const col = db.collection<SuplementDocTyped>(COLLECTION_NAME);

  const docs = await col.find({ _id: { $in: objectIds.map((x) => x.oid) } }).toArray();

  const byId = new Map<string, SuplementDocTyped>();
  for (const d of docs) byId.set(d._id.toString(), d);

  const ordered: SuplementDocTyped[] = [];
  for (const id of uniqueIds) {
    const doc = byId.get(id);
    if (doc) ordered.push(doc);
  }
  return ordered;
}

