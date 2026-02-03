import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const { MONGODB_URI, MONGODB_ATLAS_DB_NAME } = process.env;

if (!MONGODB_URI || !MONGODB_ATLAS_DB_NAME) {
  throw new Error("Faltan env vars de MongoDB Atlas (URI/DB).");
}

export async function getMongoClient() {
  const client = new MongoClient(MONGODB_URI as string);
  await client.connect();
  const db = client.db(MONGODB_ATLAS_DB_NAME as string);
  return { client, db };
}
