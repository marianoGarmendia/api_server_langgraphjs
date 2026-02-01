import { MongoClient, Collection, type Document as MongoDocument } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config();
const {
  MONGODB_URI,
  MONGODB_ATLAS_DB_NAME,
  MONGODB_ATLAS_COLLECTION_NAME,
  MONGODB_ATLAS_INDEX_NAME,
} = process.env;

if (!MONGODB_URI || !MONGODB_ATLAS_DB_NAME || !MONGODB_ATLAS_COLLECTION_NAME) {
  throw new Error("Faltan env vars de MongoDB Atlas (URI/DB/COLLECTION).");
}

export type KBCollectionDoc = {
  _id?: string;
  text: string;
  embedding: number[];
  // metadata “plana” para filtrar fácil (LangChain suele materializar metadata como campos top-level)
  orgId: string;
  agentId: string;
  docId: string;
  source?: string;
  title?: string;
  category?: string;
  brand?: string;
  product?: string;
  loc?: { pageNumber?: number };
};

export async function getMongo() {
  const client = new MongoClient(MONGODB_URI as string);
  await client.connect();
  const collection = client
    .db(MONGODB_ATLAS_DB_NAME)
    .collection<MongoDocument>(MONGODB_ATLAS_COLLECTION_NAME as string);
console.log("Connected to MongoDB Atlas");
  return { client, collection };
}

export async function ensureVectorIndex(
  collection: Collection<MongoDocument>,
  dims = 1536,
) {
  const indexName = MONGODB_ATLAS_INDEX_NAME || "vector_index";
  const db = collection.db;
  const exists = await db
    .listCollections({ name: collection.collectionName }, { nameOnly: true })
    .hasNext();
  console.log("Collection exists:", exists);
  if (!exists) {
    await db.createCollection(collection.collectionName);
    console.log("Collection created");
  }
  console.log("Collection exists:", exists);

  const existing = await collection.listSearchIndexes(indexName).toArray();
  if (existing.length > 0) return;

  // Vector index + campos filter (preFilter)
  const index = {
    name: indexName,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: dims, similarity: "cosine" },

        // Multi-tenant + doc scoping
        { type: "filter", path: "orgId" },
        { type: "filter", path: "agentId" },
        { type: "filter", path: "docId" },

        // Ejemplos extra (opcionales)
        { type: "filter", path: "loc.pageNumber" },
        { type: "filter", path: "category" },
        { type: "filter", path: "title" },
        { type: "filter", path: "brand" },
        { type: "filter", path: "product" },
      ],
    },
  };

  await collection.createSearchIndex(index);
  // Puede tardar un poco en sincronizar para quedar queryable.
}

export async function getVectorStore(collection: Collection<MongoDocument>) {
  const indexName = MONGODB_ATLAS_INDEX_NAME || "vector_index";

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small", // 1536 dims (asegurate de matchear el índice)
    openAIApiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
  });
  console.log("Embeddings created");

  const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection,
    indexName,
    textKey: "text",
    embeddingKey: "embedding",
  });

  return vectorStore;
}
