import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { buildPromptKombatV2 } from "./prompts.js";
import { routerSchema } from "./schemas.mjs";
import { buildPromptKombat } from "./prompts.js";

import { priceTool, infoCatalogoVulcano, infoPalasKombat } from "./tools.js";

const model = new ChatOpenAI({
  model: "gpt-5-mini",

  apiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
});

const tools = [infoPalasKombat, priceTool, infoCatalogoVulcano];

tools.forEach((tool) => {
  console.log("tool name");
  console.log(tool.name);
});
// const modelWithTools = model.bindTools(tools);

const MessagesState = Annotation.Root({
  ...MessagesAnnotation.spec,
  derivation: Annotation<Record<string, unknown> | null>,
});

const buildModel = (config: any) => {
  let modelWithTools = model;
  if (config?.area === "ventas") {
    console.log("Derivado a ventas");
    modelWithTools.bindTools([priceTool]);
  } else if (config?.area === "soporte técnico") {
    console.log("Derivado a soporte ");
    modelWithTools.bindTools([infoPalasKombat, infoCatalogoVulcano]);
  }

  return modelWithTools;
};

const llmCall = async (state: typeof MessagesState.State) => {
  const { messages, derivation } = state;
  const prompt = buildPromptKombatV2(derivation || {});
  const sysMessage = new SystemMessage(prompt);
  const modelWithTools = model.bindTools(tools);

  const response = await modelWithTools.invoke([sysMessage, ...messages]);
  console.log("response", response);
  return { messages: [response] };
};

const toolNode = new ToolNode(tools);

const router = async (state: typeof MessagesState.State) => {
  const messages = state.messages;
  const systemRouter = `
  Eres encargado de decidir hacia el área que debe ser derivado el usuario  para que su respuesta sea atendida correctamente si es que en este contexto no encuentras la respuesta a su consulta.

  Las áreas disponibles son 'ventas' , 'soporte técnico', 'general'.

  - Si el usuario realiza una consulta relacionada con información de precios, promociones, beneficios, bancos, descuentos, formas de pago y/o relacionado a la compra de un producto kombat debes derivarlo al área de 'ventas'.

  - Si el usuario realiza una consulta relacionada con información técnica de los productos, características, materiales, diferencias entre modelos, usos y/o relacionado a aspectos técnicos de un producto kombat debes derivarlo al área de 'soporte técnico'.

  - Si el usuario realiza una consulta relacionada con temas generales como envíos, devoluciones, reclamos, garantías, facturación y/o cualquier otra consulta que no esté relacionada con los puntos anteriores debes derivarlo al área 'general'.

  En el campo 'reason' debes explicar brevemente por qué se eligió esa área, para que el modelo que reciba esta información lo entienda claramente.

  En el campo 'respuesta_sugerida' debes incluir la respuesta sugerida al usuario en base a las políticas oficiales de la empresa.

  ## información para generar una respuesta suguerida:
Regla de oro (prioridad absoluta)

Especificaciones técnicas / “qué modelo me conviene” (Línea Vulcano): responder usando CATALOGO_VULCANO (inmutable). No mezclar precios acá.

Precios, promos, cuotas y bancos: responder usando DATOS_PRECIOS (y las promos por banco).

Intenciones típicas a enrutar

Consulta técnica / recomendación de modelo (Vulcano)

Disparadores: “características”, “dureza”, “balance”, “forma”, “control/potencia”, “qué modelo me conviene”, “soy principiante/intermedio”.

Acción: usar CATALOGO_VULCANO (modelos: Arenal, Etna, Fuji, Galeras, Krakatoa, Osorno, Teide, Vesubio + Vulcano 2024: Navy Seal, Hunter, Magnum).

Tip extra: si pide “diamante / potencia”, explicar breve + recomendar Vesubio/Teide/Etna/Arenal (aclarar que Krakatoa es redonda).

Precios / descuentos / packs / cuotas

Disparadores: “precio”, “promo”, “descuento”, “cuotas”, “sin interés”, “Banco Nación/Provincia”.

Acción: consultar DATOS_PRECIOS y ofrecer el canal correcto:

Banco Nación: link compra TiendaBNA + cuotas (12 o 24 según fechas).

Banco Provincia: link Provincia Compras + cuotas (6 o 18 según fechas).

Cierre sugerido: preguntar “¿Sos cliente del banco?” + pasar link directo.

Cómo comprar / hacer pedido

Disparadores: “cómo compro”, “cómo hago el pedido”, “link”, “carrito”.

Respuesta base: entrar a kombatpadel.com.ar → carrito → finalizar → promos por canal → llega seguimiento por mail.

Envíos / seguimiento

Disparadores: “envío”, “cuánto tarda”, “seguimiento”, “código”.

Respuesta base: 2–7 días hábiles a domicilio; tras despacho llega mail de Shipnow con código.

Retiro / local

Disparadores: “retiro”, “sucursal”, “local”.

Respuesta base: no hay local a la calle; venta online + envío. “Puntos de test” solo si el cliente lo pide (ofrecer ayudar por canales oficiales).

Accesorios / funda

Disparadores: “incluye funda”, “viene con funda”.

Respuesta base: no incluye; viene en caja protectora.

Reclamo / producto defectuoso

Disparadores: “vino roto”, “reclamo”, “garantía”, “cambio”.

Proceso fijo:

empatizar, 2) pedir nº pedido o email, 3) no prometer, 4) derivar a tienda@kombatpadel.com.ar
, 5) cerrar con empatía (“24–48hs” contacto).

Factura A

Disparadores: “factura A”, “CUIT”.

Respuesta base: solo si el CUIT tiene actividad de venta de artículos deportivos; escribir a tienda@kombatpadel.com.ar
.

Fabricación / origen

Disparadores: “dónde se fabrican”.

Respuesta base: principalmente en China, fábricas de alta calidad.

Garantía

Disparadores: “garantía”, “cuánto dura”.

Respuesta base: 3 meses desde la compra (reparación o reemplazo por defecto o inconformidad).

  ´## Canales oficiales
- WhatsApp: +54 9 11 72270778 (atención al cliente)
- Reclamos: tienda@kombatpadel.com.ar
- Mayoristas: julian@ipacsa.com.ar
- Instagram: @kombatpadelargentina

  **Debes respetar la salida en formato JSON con el esquema provisto**
  `;

  const modelRouter = new ChatOpenAI({
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY,
  }).withStructuredOutput(routerSchema, { strict: true });

  const response = await modelRouter.invoke([
    new SystemMessage(systemRouter),
    ...messages,
  ]);

  return { messages: messages, derivation: response };
};

const ventasNode = async (state: typeof MessagesState.State) => {
  console.log("Derivado a ventas");
  const { messages, derivation } = state;
  return {};
};

const shouldContinue = (state: typeof MessagesState.State) => {
  const last = state.messages.at(-1) as AIMessage;
  // if (!last || !(last instanceof AIMessage)) return END;
  console.log("last", last);
  return last?.tool_calls?.length ? "toolNode" : END;
};

const graphKombat = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("router", router)
  .addNode("toolNode", toolNode)
  .addEdge(START, "router")
  .addEdge("router", "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall");

const checkpointer = new MemorySaver();
export const workflow = graphKombat.compile({ checkpointer });

// Ejemplo de uso:
async function demo() {
  const orgId = "kombatpadel";
  const agentId = "agent_wsp";
  const title = "como_elegir_palas_kombat";

  const question = `Soy principiante en el padel y quiero elegir una pala. Me gustaria que me recomiendes una pala.`;

  const result = await workflow.invoke(
    {
      messages: [new HumanMessage(question)],
    },
    {
      configurable: {
        thread_id: "1234567890",
        orgId: orgId,
        agentId: agentId,
        title: title,
      },
    },
  );

  console.log("finished!");

  console.log(result);
}

// demo().catch(console.error);
