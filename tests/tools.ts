import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { PROMOS_KOMBAT_FEBRERO_BLOCK } from "./prompts.ts";
import { getMongo, getVectorStore } from "./kb/mongoVector.ts";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

export const priceTool = tool(
  async ({ query }: { query: string }) => {
    const model = new ChatOpenAI({
      model: "gpt-5-mini",
      apiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
    });

    const sysPrompt = PROMOS_KOMBAT_FEBRERO_BLOCK;

    const response = await model.invoke([
      new SystemMessage(sysPrompt),
      new HumanMessage(query),
    ]);
    
    console.log("response", response);
    return response;
  },
  {
    name: "precios_y_promociones_vigentes",
    description:
      "Obtiene la información relacionada sobre precios, cuotas, promociones vigentes",
    schema: z.object({
      query: z
        .string()
        .describe(
          "La consulta del cliente relacionada sobre precios, cuotas, promociones vigentes, lo mas detallada y estructurada posible para que el modelo pueda responder de la mejor manera posible, debe ser como un mensaje del usuario"
        ),
    }),
  }
);

export const infoCatalogoVulcano = tool(
  async ({ query }: { query: string }) => {
    const CATALOGO_VULCANO = {
      lineas: [
        {
          nombre_linea: "Línea Vulcano",
          palas: [
            {
              tipo_de_pala: "Arenal",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Goma Black EVA",
              peso: "350g-360g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Etna",
              forma: "Diamante",
              dureza: "Dura",
              balance: "Alto",
              potencia: "Alto",
              control: "Medio",
              nucleo: "Black EVA Pro",
              peso: "360g-370g",
              material: "Carbono 12k Rugoso",
            },
            {
              tipo_de_pala: "Fuji",
              forma: "Lágrima",
              dureza: "Media",
              balance: "Medio",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 18K Aluminizado Rugoso",
            },
            {
              tipo_de_pala: "Galeras",
              forma: "Lágrima",
              dureza: "Blanda",
              balance: "Medio",
              potencia: "Medio",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "350g-360g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Krakatoa",
              forma: "Redonda",
              dureza: "Dura",
              balance: "Bajo",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 12K Rugoso",
            },
            {
              tipo_de_pala: "Osorno",
              forma: "Lágrima",
              dureza: "Blanda",
              balance: "Medio",
              potencia: "Medio",
              control: "Alto",
              nucleo: "Goma EVA de doble densidad",
              peso: "360g-370g",
              material: "3D Carbon Rugoso",
            },
            {
              tipo_de_pala: "Teide",
              forma: "Diamante",
              dureza: "Media",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black EVA",
              peso: "360g-370g",
              material: "Carbono 18K Blue Rugoso",
            },
            {
              tipo_de_pala: "Vesubio",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Goma Eva de doble densidad",
              peso: "360g-370g370g",
              material: "3D Carbon Rugoso",
            },
          ],
        },
        {
          nombre_linea: "Línea VULCANO 2024",
          palas: [
            {
              tipo_de_pala: "Navy Seal",
              forma: "Diamante",
              dureza: "Media",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 18K Rugoso",
            },
            {
              tipo_de_pala: "Hunter",
              forma: "Lágrima",
              dureza: "Dura",
              balance: "Medio",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 3K",
            },
            {
              tipo_de_pala: "Magnum",
              forma: "Diamante",
              dureza: "Blanda",
              balance: "Alto",
              potencia: "Alto",
              control: "Alto",
              nucleo: "Black Eva",
              peso: "365g",
              material: "Carbono 18K Rugoso",
            },
          ],
        },
      ],
    };

    const normalize = (text: string) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const q = normalize(query);
    const includes = (value: string) => q.includes(normalize(value));

    const shape =
      (q.includes("lagrima") && "Lágrima") ||
      (q.includes("diamante") && "Diamante") ||
      (q.includes("redonda") && "Redonda") ||
      undefined;

    const hardness =
      (q.includes("blanda") && "Blanda") ||
      (q.includes("media") && "Media") ||
      (q.includes("dura") && "Dura") ||
      undefined;

    const balance =
      (q.includes("alto") && q.includes("balance") && "Alto") ||
      (q.includes("medio") && q.includes("balance") && "Medio") ||
      (q.includes("bajo") && q.includes("balance") && "Bajo") ||
      undefined;

    const potencia =
      q.includes("potencia") && q.includes("alto")
        ? "Alto"
        : q.includes("potencia") && q.includes("medio")
        ? "Medio"
        : q.includes("potencia") && q.includes("bajo")
        ? "Bajo"
        : q.includes("potencia")
        ? "Alto"
        : undefined;

    const control =
      q.includes("control") && q.includes("alto")
        ? "Alto"
        : q.includes("control") && q.includes("medio")
        ? "Medio"
        : q.includes("control") && q.includes("bajo")
        ? "Bajo"
        : q.includes("control")
        ? "Alto"
        : undefined;

    const allPalas = CATALOGO_VULCANO.lineas.flatMap((l) =>
      l.palas.map((p) => ({ ...p, linea: l.nombre_linea }))
    );

    const exactName = allPalas.find((p) => includes(p.tipo_de_pala));

    const matches = allPalas.filter((p) => {
      if (shape && normalize(p.forma) !== normalize(shape)) return false;
      if (hardness && normalize(p.dureza) !== normalize(hardness)) return false;
      if (balance && normalize(p.balance) !== normalize(balance)) return false;
      if (potencia && normalize(p.potencia) !== normalize(potencia))
        return false;
      if (control && normalize(p.control) !== normalize(control)) return false;
      return true;
    });

    const ranked = (
      exactName ? [exactName] : matches.length ? matches : allPalas
    )
      .map((p) => {
        const haystack = normalize(
          [
            p.tipo_de_pala,
            p.forma,
            p.dureza,
            p.balance,
            p.potencia,
            p.control,
            p.nucleo,
            p.material,
            p.linea,
          ].join(" ")
        );
        const score = q
          .split(" ")
          .filter((t) => t.length > 2)
          .reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const header = `Resultados para: "${query}"`;
    const body = ranked
      .map(
        (p) =>
          `- ${p.tipo_de_pala} (${p.linea}) | forma: ${p.forma}, dureza: ${p.dureza}, balance: ${p.balance}, potencia: ${p.potencia}, control: ${p.control}, nucleo: ${p.nucleo}, material: ${p.material}, peso: ${p.peso}`
      )
      .join("\n");

    console.log("tool info_catalogo_vulcano");
    console.log(header);
    console.log(body);

    return `${header}\n${body}`;
  },
  {
    name: "info_catalogo_vulcano",
    description:
      "Obtiene la información relacionada sobre el catálogo de palas Vulcano",
    schema: z.object({
      query: z
        .string()
        .describe(
          "La consulta del cliente relacionada sobre el catálogo de palas Vulcano, o tambien una query para buscar en el catálogo sin que el usuario haya preguntado específicamente sobre el catálogo, trata de ser lo más específico posible"
        ),
    }),
  }
);

// Tool: búsqueda vectorial con preFilter
const SearchInput = z.object({
  query: z.string().min(1),
  orgId: z.string().min(1),
  agentId: z.string().min(1),
  docId: z.string().min(1),
  title: z.string().describe("El título del documento").nullable(),
  product: z.string().describe("El producto del documento").nullable(),
  // ejemplos de filtros “de negocio”
  category: z.string().nullable(),
  brands: z.array(z.string()).nullable(),

  k: z.number().int().min(1).max(20).default(6),
});
export const infoPalasKombat = tool(
  async (input, config: LangGraphRunnableConfig) => {
    const { client, collection } = await getMongo();
    // const { orgId, agentId, title } = config.configurable as any;
    // console.log("orgId", orgId);
    // console.log("agentId", agentId);
    // console.log("title", title);
    const orgId = "kombatpadel";
    const agentId = "agent_wsp";
    const title = "como_elegir_palas_kombat";
    try {
      const vectorStore = await getVectorStore(collection);

      // IMPORTANTÍSIMO: preFilter (requiere que esos campos estén como type:"filter" en el índice)
      const and: any[] = [
        { orgId: { $eq: orgId } },
        { agentId: { $eq: agentId } },
      ];
      // if (input.category) and.push({ category: { $eq: input.category } });
      if (title) and.push({ title: { $eq: title } });
      // if (input.brands?.length) and.push({ brand: { $in: input.brands } });

      const results = await vectorStore.similaritySearchWithScore(
        input.query,
        input.k,
        { preFilter: { $and: and } }
      );

      // Para excluir ids de una busqueda
      //       const excludedIds = results.map((r) => r.metadata._id);

      // const results2 = await vectorStore.similaritySearchWithScore(
      //   input.query,
      //   input.k,
      //   {
      //     preFilter: {
      //       $and: [
      //         ...and, // tus filtros habituales (orgId, agentId, etc.)
      //         { _id: { $nin: excludedIds } }, // excluye esos documentos
      //       ],
      //     },
      //   }
      // );

      // Mongo (y el vector store) entiende { _id: { $nin: [...] } } como “todos menos estos”, así que los chunks ya vistos no volverán a aparecer en el segundo intento. Si no tienes otros filtros, puedes omitir el resto del $and y usar directamente { preFilter: { _id: { $nin: excludedIds } } }.

      // devolvés texto + metadata para que el LLM cite páginas/fuente
      const payload = results.map(([doc, score]) => ({
        id: doc.metadata._id,
        score,
        text: doc.pageContent,
        metadata: doc.metadata,
      }));

     

      console.log("payload", payload);

      return payload
        .map((p) => {
          return `
          ${p.text}
          `;
        })
        .join("\n\n");
    } finally {
      await client.close();
    }
  },
  {
    name: "como_elegir_palas_kombat",
    description:
      "Busca contexto relevante para responder preguntas sobre como elegir palas kombat.",
    schema: SearchInput,
  }
);

// Probamos crear un retriever manual
