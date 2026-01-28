import "dotenv/config";
import { Db, MongoClient } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

function getWsMongoUri(): string {
  const uri = process.env.WS_MONGODB_URI;
  if (!uri) {
    throw new Error(
      "[db_ws] Falta WS_MONGODB_URI en el .env (ej: mongodb://usuario:password@host:27017/)"
    );
  }
  return uri;
}

function getWsMongoDbName(): string {
  // Default según tu indicación
  return process.env.WS_MONGODB_DB_NAME ?? "fabricadecampeones";
}

export function getWsPlatosCollectionName(): string {
  // Default según tu indicación
  return process.env.WS_PLATOS_COLLECTION ?? "productos";
}

export async function getWsMongoClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(getWsMongoUri());
  await client.connect();
  cachedClient = client;
  return client;
}

export async function getWsMongoDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = await getWsMongoClient();
  const db = client.db(getWsMongoDbName());
  cachedDb = db;
  return db;
}

export async function closeWsMongo(): Promise<void> {
  if (!cachedClient) return;
  await cachedClient.close();
  cachedClient = null;
  cachedDb = null;
}
