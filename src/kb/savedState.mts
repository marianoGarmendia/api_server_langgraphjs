import { getMongoClient } from "./mongoClient.mjs";
import { scheduleLeadExpiration } from "../server.mjs";
import { logger } from "../logging.mjs";

const EXPIRATION_MS = 2 * 60 * 1000;

// console.log("boot", new Date().toISOString());

// setTimeout(() => {
//   console.log("timeout fired", new Date().toISOString());
// }, 30_000);

// // opcional: heartbeat
// setInterval(() => {
//   console.log("alive", new Date().toISOString());
// }, 10_000);

export const saveState = async ({
  from,
  source,
}: {
  from: string;
  source: string;
}) => {
  const now = new Date();
  const timeToSave = new Date(now.getTime() + EXPIRATION_MS);
  const nowIso = now.toISOString();
  const timeToSaveIso = timeToSave.toISOString();
  console.log("saveState: ---> ", from);

  try {
    const { client, db } = await getMongoClient();
    try {
      const clientes = db.collection("clientes");
      const existing = await clientes.findOne<{
        conversations?: {
          conversationNumber: number;
          expired: boolean;
          createdAt: string;
          timeToSave: string;
          fecha: string;
        }[];
      }>({ telefono: from }, { projection: { conversations: 1 } });

      const conversations = existing?.conversations ?? [];
    
      const lastConversation = conversations[conversations.length - 1];
      if(lastConversation) {
        console.log("lastConversation: ---> ", lastConversation);
      }

      if (!lastConversation || lastConversation.expired) {
        console.log("lastConversation is expired or not found");
        const conversationNumber =
          (lastConversation?.conversationNumber ?? 0) + 1;
        const newConversation = {
          conversationNumber,
          resumen_conversacion: "",
          calificacion: "",
          createdAt: nowIso,
          timeToSave: timeToSaveIso,
          expired: false,
          fecha: nowIso,
        };
        if (!existing) {
          await clientes.insertOne({
            telefono: from,
            conversations: [newConversation],
          });
        } else {
          await clientes.updateOne({ telefono: from }, {
            $push: { conversations: newConversation },
          } as any);
        }

        console.log("scheduleLeadExpiration: ---> ", from);
        scheduleLeadExpiration({
          telefono: from,
          threadId: from,
          conversationNumber,
        });
      } else {
        console.log("lastConversation is not expired");
       
        await clientes.updateOne(
          { telefono: from },
          {
            $set: {
              "conversations.$[conv].fecha": nowIso,
              "conversations.$[conv].timeToSave": timeToSaveIso,
            },
          },
          {
            arrayFilters: [
              {
                "conv.conversationNumber": lastConversation.conversationNumber,
              },
            ],
          },
        );
      }
    } finally {
      await client.close();
    }
  } catch (error) {
    logger.error("Error guardando cliente en MongoDB", error);
  }
};
