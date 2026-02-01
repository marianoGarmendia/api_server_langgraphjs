import { randomUUID } from "crypto";
import type { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getMongo, ensureVectorIndex, getVectorStore } from "./mongoVector.ts";

export type IngestPdfParams = {
  filePath: string;
  orgId: string;
  agentId: string;
  docId?: string; // si no viene, generamos
  source?: string;
  // metadata opcional “de negocio”
  category?: string;
  title?: string;
  brand?: string;
  product?: string;
  
};

export async function ingestPdfToMongo(params: IngestPdfParams) {
  const {
    filePath, orgId, agentId,
    docId = randomUUID(),
    source, category, brand, product, title
  } = params;

  const { client, collection } = await getMongo();
  try {
    await ensureVectorIndex(collection, 1536);
    const vectorStore = await getVectorStore(collection);

    // 1) Load PDF
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load(); // docs por página, con loc.pageNumber usualmente

    // 2) Split
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 150,
    });

    const docs = await splitter.splitDocuments(rawDocs);

    // 3) Enriquecer metadata multi-tenant (IMPORTANTE para filtros)
    const enriched: Document[] = docs.map((d) => ({
      pageContent: d.pageContent,
      metadata: {
        orgId,
        agentId,
        docId,
        source,
        category,
        brand,
        product,
        title,
        loc: d.metadata?.loc, // suele incluir { pageNumber }
      },
    }));

    // 4) Guardar en Mongo (text + embedding + metadata)
    const ids = enriched.map((_, i) => `${docId}:${i}`);
    await vectorStore.addDocuments(enriched, { ids });

    return { docId, chunks: enriched.length };
  } finally {
    await client.close();
  }
}
