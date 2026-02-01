// // import { Router } from "express";
// // import { messageExampleTemplateConfirm_event_4 } from "../templates.ts"; // esta plantilla es customizada y aprobada por meta para enviar mensaje de confirmacion e iniciar la conversacion
// // import { WEBHOOK_VERIFY_TOKEN } from "../server.ts";
// import { workflow } from "../graphAgent.ts";

// // export const conversationRouter = Router();

// // Template de ejemplo para iniciar la conversacion con la confirmacion de evento
// // messageExampleTemplateConfirm_event_4;

// // Este endpoint es para respuesta siempre de conversacion
// // Mandas a este endpoint el id del numero de ID del teléfono que envia el mensaje y se inicia la conversacion, en base a esto habria que elegir la plantilla
// // conversationRouter.post("/conversation", async (req, res): Promise<any> => {
// //   const { context, template } = req.body;
// //   const { phone_number_id_sender } = context;
// //   if (!template) return res.end();
// //   try {
// //     const response = await conversation({ phone_number_id_sender, template });
// //     res.status(200).json(response);
// //   } catch (error) {
// //     console.error("Error sending message:", error);
// //     res.sendStatus(500);
// //   }
// // });

// const body = {
//   template: {
//     messaging_product: "whatsapp",
//     recipient_type: "individual",
//     to: "",

//     text: {
//       preview_url: true,
//       body: `
//           `,
//     },
//   },
//   context: {
//     phone_number_id_sender: "487260501146994",
//     verify_token: "asdajkshdjkahs",
//     agent_settings: "soy un agente ...",
//     url_notify_message: "http://localhost:3000/webhook",
//   },
// };

// conversationRouter.post("/agent", async (req, res): Promise<any> => {
//   const { query, from } = req.body;
//   const orgId = "kombatpadel";
//   const agentId = "agent_wsp";
//   const title = "como_elegir_palas_kombat";

//   let config = { configurable: { thread_id: from, orgId, agentId, title } };
//   console.log("Mensaje recibido", query);

//   const responseGraph = await workflow.invoke(
//     { messages: query },
//     { ...config, streamMode: "values" }
//   );
//   console.log("Respuesta de agente", responseGraph);

//   res
//     .status(200)
//     .json(responseGraph.messages[responseGraph.messages.length - 1].content);
// });

// // Iniciar conversacion con plantillas aprobadas por meta
// export const conversation = async ({
//   phone_number_id_sender,
//   template,
// }: ConversationProps) => {
//   // Send a reply message
//   try {
//     const response = await fetch(
//       `https://graph.facebook.com/v22.0/${phone_number_id_sender}/messages`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${WEBHOOK_VERIFY_TOKEN}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(template),
//       }
//     );

//     const result = await response.json();
//     console.log("Message sent successfully:", result);
//     return result;
//   } catch (error) {
//     console.error("Error sending message:", error);
//   }
// };

// interface ConversationProps {
//   phone_number_id_sender: string;
//   template: object;
// }

// // Respuesta de la API de whatsapp cuando un mensaje es enviado correctamente
// // ********************************************************************************************************************
// // const responseMessage = {
// //   messaging_product: "whatsapp",
// //   contacts: [{ input: "+542214371684", wa_id: "5492214371684" }], // el número de teléfono del destinatario
// //   messages: [
// //     {
// //       id: "wamid.HBgNNTQ5MjIxNDM3MTY4NBUCABEYEjkwOUE1Q0NCRDRGMkE1QThEMwA=", // el id del mensaje dentro de wsp
// //     },
// //   ],
// // };
// // ********************************************************************************************************************

// // Iniciar conversacion
// // Para iniciar la conversacion debe hacerse a traves de plantillas autorizadas por meta, ya configure una plantilla en: https://business.facebook.com/latest/whatsapp_manager/message_templates?business_id=554867304947575&tab=message-templates&filters=%7B%22date_range%22%3A30%2C%22language%22%3A[]%2C%22quality%22%3A[]%2C%22search_text%22%3A%22%22%2C%22status%22%3A[%22APPROVED%22%2C%22IN_APPEAL%22%2C%22PAUSED%22%2C%22PENDING%22%2C%22REJECTED%22]%2C%22tag%22%3A[]%7D&nav_ref=whatsapp_manager&asset_id=487260501146994

// // Para confirmación de eventos con dos botones, confirmo y rechazo
