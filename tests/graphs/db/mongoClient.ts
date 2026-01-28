import "dotenv/config";
import { Db, MongoClient } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

function getMongoUri(): string {
  // Compat: algunos scripts usan `MONGODB_URI` y otros `WS_MONGODB_URI`
  const uri = process.env.WS_MONGODB_URI ;
  if (!uri) {
    throw new Error(
      "[db] Falta MONGODB_URI (o WS_MONGODB_URI) en el .env (ej: mongodb://localhost:27017)"
    );
  }
  return uri;
}

function getMongoDbName(): string {
  // Si no se define, usamos el mismo default que `db_ws`
  return process.env.WS_MONGODB_DB_NAME ?? "fabricadecampeones";
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(getMongoUri());
  await client.connect();

  cachedClient = client;
  return client;
}

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const client = await getMongoClient();
  const db = client.db(getMongoDbName());

  cachedDb = db;
  return db;
}

export async function closeMongo(): Promise<void> {
  if (!cachedClient) return;
  await cachedClient.close();
  cachedClient = null;
  cachedDb = null;
}
