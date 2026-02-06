import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { registerFromEnv } from "./graph/load.mjs";

import runs from "./api/runs.mjs";
import threads from "./api/threads.mjs";
import assistants from "./api/assistants.mjs";
import store from "./api/store.mjs";

import { truncate, conn as opsConn } from "./storage/ops.mjs";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { queue } from "./queue.mjs";
import { logger, requestLogger } from "./logging.mjs";
import { checkpointer } from "./storage/checkpoint.mjs";
import { store as graphStore } from "./storage/store.mjs";
import { auth } from "./auth/custom.mjs";
import { registerAuth } from "./auth/index.mjs";
import { workflow, getStateOfLead, cleanState } from "../tests/graphAgent.js";
import { getMongoClient } from "./kb/mongoClient.mjs";
import type { Db } from "mongodb";
import { appendCustomer } from "../tests/sheet/writeSheet.js";
import { saveState } from "./kb/savedState.mjs";

const app = new Hono();
const EXPIRATION_MS = 2 * 60 * 1000;
const CRON_SECRET = process.env.CRON_SECRET;
// const USE_IN_PROCESS_EXPIRATION =
//   process.env.USE_IN_PROCESS_EXPIRATION === "true";
const leadTimers = new Map<
  string,
  { timeout: NodeJS.Timeout; threadId: string; conversationNumber: number }
>();

function clearLeadTimer(telefono: string) {
  const existing = leadTimers.get(telefono);
  if (existing) {
    clearTimeout(existing.timeout);
    leadTimers.delete(telefono);
  }
}

async function expireLeadConversation({
  telefono,
  threadId,
  conversationNumber,
  db,
}: {
  telefono: string;
  threadId: string;
  conversationNumber: number;
  db: Db;
}) {
  try {
    const state = await getStateOfLead(threadId);
    const clientes = db.collection("clientes");
    const result = await clientes.updateOne(
      { telefono },
      {
        $set: {
          "conversations.$[conv].expired": true,
          "conversations.$[conv].cliente": state.cliente || "No definido",
          "conversations.$[conv].fecha": new Date().toISOString(),
          "conversations.$[conv].resumen_conversacion": state.resumen,
          "conversations.$[conv].calificacion": state.calificacion,
          "conversations.$[conv].motivo_calificacion":
            state.motivo_calificacion,
          "conversations.$[conv].productos_mencionados":
            state.productos_mencionados,
          "conversations.$[conv].siguiente_accion":
            state.siguiente_accion || "No definida",
        },
      },
      {
        arrayFilters: [
          {
            "conv.conversationNumber": conversationNumber,
            "conv.expired": false,
          },
        ],
      },
    );

    // Acá es donde tengo que ir a buscar la informacion del cliente al graph, extraer los datos , grabarlos en la base de datos y en el sheet
    if (result.modifiedCount > 0) {
      logger.info("State obtenido por expiración", { threadId });
      // Actualizar el sheet con la información del cliente
      const customerSaved = await appendCustomer({
        cliente: state.cliente || "No definido",
        telefono: telefono,
        resumen: state.resumen,
        calificacion: state.calificacion,
        motivo_calificacion: state.motivo_calificacion,
        productos_mencionados: state.productos_mencionados,
        siguiente_accion: state.siguiente_accion || "No definida",
        fecha: new Date().toISOString(),
      });

      if (customerSaved) {
        logger.info("Cliente agregado correctamente en Google Sheets.");
      } else {
        logger.error("Error al agregar cliente en Google Sheets.");
      }

      // Limpiar el state del graph
      const cleanStateSaved = await cleanState({ threadId });
      if (cleanStateSaved.error) {
        logger.error(
          "Error al limpiar el estado del graph",
          cleanStateSaved.error,
        );
      }

      if (cleanStateSaved?.success) {
        logger.info("Estado del graph limpiado correctamente");
      }

      // Limpiar el state
      void state;
    }
  } catch (error) {
    logger.error("Error en expiración de cliente", error);
  }
}

async function processDueLeadExpirations(limit: number) {
  const now = new Date();
  const nowIso = now.toISOString();
  const { client, db } = await getMongoClient();
  try {
    const clientes = db.collection("clientes");
    const dueConversations = await clientes
      .aggregate([
        { $unwind: "$conversations" },
        {
          $match: {
            "conversations.expired": false,
            $or: [
              { "conversations.timeToSave": { $lte: nowIso } },
              { "conversations.timeToSave": { $lte: now } },
            ],
          },
        },
        {
          $project: {
            telefono: 1,
            conversationNumber: "$conversations.conversationNumber",
          },
        },
        { $limit: limit },
      ])
      .toArray();

    for (const item of dueConversations) {
      await expireLeadConversation({
        telefono: item.telefono,
        threadId: item.telefono,
        conversationNumber: item.conversationNumber,
        db,
      });
    }

    return { processed: dueConversations.length };
  } finally {
    await client.close();
  }
}

export function scheduleLeadExpiration({
  telefono,
  threadId,
  conversationNumber,
}: {
  telefono: string;
  threadId: string;
  conversationNumber: number;
}) {
  // if (!USE_IN_PROCESS_EXPIRATION) {
  //   return;
  // }
  clearLeadTimer(telefono);
  console.log("clearLeadTimer: ---> ", telefono);

  /*
  
  todo: crear un cron job que se ejecute cada 1 minuto y se fije si hay clientes que expiraron y si hay, se guardan en el sheet y se limpia el state del graph
  opcion 1:
  crear un cron job que se ejecute cada 1 minuto y se fije si hay clientes que expiraron y si hay, se guardan en el sheet y se limpia el state del graph
opcion 2:
  lo que tienen que comparar es si la fecha actual es igual o mayor al timeToSave del cliente, si es true entonces expiro en true, guardo en sheet, borro el timer, clearTimer , borro el graph y ya no consulto más esa conversacion del cliente, si es false, activo otro timer que verifique nuevamente, un bucle.
  
  */

  const timeout = setTimeout(async () => {
    console.log("scheduleLeadExpiration: ---> ", telefono);
    const { client, db } = await getMongoClient();
    try {
      await expireLeadConversation({
        telefono,
        threadId,
        conversationNumber,
        db,
      });
    } finally {
      await client.close();
      clearLeadTimer(telefono);
    }
  }, EXPIRATION_MS);

  leadTimers.set(telefono, { timeout, threadId, conversationNumber });
}

// This is used to match the behavior of the original LangGraph API
// where the content-type is not being validated. Might be nice
// to warn about this in the future and throw an error instead.
app.use(async (c, next) => {
  if (
    c.req.header("content-type")?.startsWith("text/plain") &&
    c.req.method !== "GET" &&
    c.req.method !== "OPTIONS"
  ) {
    c.req.raw.headers.set("content-type", "application/json");
  }

  await next();
});

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(requestLogger());
app.get("/info", (c) => c.json({ flags: { assistants: true, crons: false } }));
app.get("/internal/expire-due-leads", async (c) => {
  const token = c.req.query("token") ?? c.req.header("x-cron-token");
  if (CRON_SECRET && token !== CRON_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }

  const limitRaw = c.req.query("limit");
  const limit = Math.max(1, Math.min(500, Number(limitRaw) || 100));
  const result = await processDueLeadExpirations(limit);
  return c.json({ ok: true, ...result });
});

app.post(
  "/internal/truncate",
  zValidator(
    "json",
    z.object({
      runs: z.boolean().optional(),
      threads: z.boolean().optional(),
      assistants: z.boolean().optional(),
      checkpointer: z.boolean().optional(),
      store: z.boolean().optional(),
    }),
  ),
  (c) => {
    const { runs, threads, assistants, checkpointer, store } =
      c.req.valid("json");

    truncate({ runs, threads, assistants, checkpointer, store });
    return c.json({ ok: true });
  },
);

/*
1 - Envia un msj el usuario, chequeo si existe en la db 
2 - Si existe, me fijo si expiró su timer
3 - Si existe y expiró, creo otro timer para guardar una nueva conversación.
4 - Si existe y no expiró continúo normal

*/

app.use(auth());
app.post(
  "/agent",
  zValidator(
    "json",
    z.object({
      query: z.string(),
      from: z.string(),
      source: z.string(),
      numberWithoutPlus: z.string(),
    }),
  ),
  async (c) => {
    const { query, from, source, numberWithoutPlus } = c.req.valid("json");

    console.log("llego un mensaje de un usuario");

    await saveState({ from, source, numberWithoutPlus });

    // const now = new Date();
    // const timeToSave = new Date(now.getTime() + EXPIRATION_MS);
    // try {
    //   const { client, db } = await getMongoClient();
    //   try {
    //     const clientes = db.collection("clientes");
    //     const existing = await clientes.findOne<{
    //       conversations?: {
    //         conversationNumber: number;
    //         expired: boolean;
    //         createdAt: Date;
    //         timeToSave: Date;
    //         fecha: Date;
    //       }[];
    //     }>({ telefono: from }, { projection: { conversations: 1 } });

    //     const conversations = existing?.conversations ?? [];
    //     console.log("conversations: ---> ", conversations);
    //     const lastConversation = conversations[conversations.length - 1];

    //     if (!lastConversation || lastConversation.expired) {
    //       const conversationNumber =
    //         (lastConversation?.conversationNumber ?? 0) + 1;
    //       const newConversation = {
    //         conversationNumber,
    //         resumen_conversacion: "",
    //         calificacion: "",
    //         createdAt: now,
    //         timeToSave,
    //         expired: false,
    //         fecha: now,
    //       };
    //       if (!existing) {
    //         await clientes.insertOne({
    //           telefono: from,
    //           conversations: [newConversation],
    //         });
    //       } else {
    //         await clientes.updateOne({ telefono: from }, {
    //           $push: { conversations: newConversation },
    //         } as any);
    //       }

    //       scheduleLeadExpiration({
    //         telefono: from,
    //         threadId: `${source}:${from}`,
    //         conversationNumber,
    //       });
    //     } else {
    //       await clientes.updateOne(
    //         { telefono: from },
    //         { $set: { "conversations.$[conv].fecha": now } },
    //         {
    //           arrayFilters: [
    //             {
    //               "conv.conversationNumber":
    //                 lastConversation.conversationNumber,
    //             },
    //           ],
    //         },
    //       );
    //     }
    //   } finally {
    //     await client.close();
    //   }
    // } catch (error) {
    //   logger.error("Error guardando cliente en MongoDB", error);
    // }

    // IMPORTANTE: await
    const fromNumber = numberWithoutPlus.startsWith("549")
      ? numberWithoutPlus
      : from;
    const state = await workflow.invoke(
      {
        // IMPORTANTE: si usás MessagesAnnotation, pasá lista de mensajes
        messages: query,
      },
      {
        configurable: {
          thread_id: fromNumber, // buena práctica: evita colisiones entre canales
          from: fromNumber,
          source,
        },
      },
    );

    // Normalmente querés responder con el último mensaje del assistant
    const last = state?.messages?.at?.(-1);

    return c.json({
      content: last?.content ?? "",
      // opcional: si querés debug
      // messages: state.messages?.map(m => ({ type: m.getType?.(), content: m.content })),
    });
  },
);

app.post(
  "/custom/echo",
  zValidator(
    "json",
    z.object({
      question: z.string(),
      metadata: z.record(z.string()).optional(),
    }),
  ),
  (c) => {
    const { question, metadata } = c.req.valid("json");
    console.log("question", question);
    console.log("metadata", metadata);
    return c.json({ ok: true, question, metadata: metadata ?? {} });
  },
);
app.route("/", assistants);
app.route("/", runs);
app.route("/", threads);
app.route("/", store);

export const StartServerSchema = z.object({
  port: z.number(),
  nWorkers: z.number(),
  host: z.string(),
  cwd: z.string(),
  graphs: z.record(z.string()),
  auth: z
    .object({
      path: z.string().optional(),
      disable_studio_auth: z.boolean().default(false),
    })
    .optional(),
  ui: z.record(z.string()).optional(),
  ui_config: z.object({ shared: z.array(z.string()).optional() }).optional(),
});

export async function startServer(options: z.infer<typeof StartServerSchema>) {
  logger.info(`Initializing storage...`);
  const callbacks = await Promise.all([
    opsConn.initialize(options.cwd),
    checkpointer.initialize(options.cwd),
    graphStore.initialize(options.cwd),
  ]);

  const cleanup = async () => {
    logger.info(`Flushing to persistent storage, exiting...`);
    await Promise.all(callbacks.map((c) => c.flush()));
  };

  logger.info(`Registering graphs from ${options.cwd}`);
  await registerFromEnv(options.graphs, { cwd: options.cwd });

  if (options.auth?.path) {
    logger.info(`Loading auth from ${options.auth.path}`);
    await registerAuth(options.auth, { cwd: options.cwd });
  }

  if (options.ui) {
    logger.info(`Loading UI`);
    const { api, registerGraphUi } = await import("./ui/load.mjs");
    app.route("/", api);

    logger.info(`Registering UI from ${options.cwd}`);
    await registerGraphUi(options.ui, {
      cwd: options.cwd,
      config: options.ui_config,
    });
  }

  logger.info(`Starting ${options.nWorkers} workers`);
  for (let i = 0; i < options.nWorkers; i++) queue();

  return new Promise<{ host: string; cleanup: () => Promise<void> }>(
    (resolve) => {
      serve(
        { fetch: app.fetch, port: options.port, hostname: options.host },
        (c) => {
          const host = `${c.address}:${c.port}`;
          logger.info(`Server listening on http://${host}`);
          resolve({ host, cleanup });
        },
      );
    },
  );
}
