import "dotenv/config";
import {
  closeWsMongo,
  getWsMongoDb,
  getWsPlatosCollectionName,
} from "./mongoClientWs.js";
import { listPlatosWs } from "./platosRepository.js";

export async function testDbWsPlatos(): Promise<void> {
  const db = await getWsMongoDb();
  const collectionName = getWsPlatosCollectionName();

  console.log("[db_ws] Connected OK");
  console.log(`[db_ws] db=${db.databaseName} collection=${collectionName}`);

  const total = await db.collection(collectionName).countDocuments({});
  console.log(`[db_ws] total documentos en colección: ${total}`);

  const sample = await listPlatosWs({ limit: 3 });
  console.log("[db_ws] sample (hasta 3 docs):");

  for (const [i, doc] of sample.entries()) {
    console.log(`--- doc ${i + 1} ---`);
    console.log(JSON.stringify(doc, null, 2));
  }
}

async function main() {
  try {
    await testDbWsPlatos();
  } catch (err: any) {
    console.error(
      "[db_ws] ERROR testeando conexión/lectura:",
      err?.message ?? err
    );
    process.exitCode = 1;
  } finally {
    await closeWsMongo();
  }
}

// Script ejecutable
main();
