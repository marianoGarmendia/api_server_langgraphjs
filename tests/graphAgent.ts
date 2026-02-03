import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  
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
import { buildAgentPrompt, FAQ_SYSTEM_PROMPT } from "./promptV2.js";
import { FaqOutput, faqSchema, RouterOutputSimple, routerSchemaSimple } from "./schemas.mjs";
// import { buildPromptKombat } from "./prompts.js";

import { priceTool, infoCatalogoVulcano, infoPalasKombat, tiendaKombatTool,linkProductoTool } from "./tools.js";

const model = new ChatOpenAI({
  model: "gpt-5-mini",

  apiKey: process.env.OPENAI_API_KEY,
});

const tools = [infoPalasKombat, priceTool, infoCatalogoVulcano, tiendaKombatTool, linkProductoTool];


// const modelWithTools = model.bindTools(tools);

const MessagesState = Annotation.Root({
  ...MessagesAnnotation.spec,
  faqResult: Annotation<FaqOutput | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  derivation: Annotation<RouterOutputSimple | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});



// Función condicional después del FAQ
const afterFaq = (state: typeof MessagesState.State) => {
  const faqResult = state.faqResult;
  
  // Si es FAQ con respuesta completa, terminamos
  if (faqResult?.isFaq && faqResult.answer && !faqResult.requiere_tool) {
    return "faqResponseNode";
  }
  
  // Si no es FAQ o necesita herramientas, pasamos al router
  return "router";
}

// Nodo que genera la respuesta FAQ final
const faqResponseNode = async (state: typeof MessagesState.State) => {
  const answer = state.faqResult?.answer || "No tengo esa información.";
  
  return {
    messages: [new AIMessage({ content: answer })],
  };
};


const llmCall = async (state: typeof MessagesState.State) => {
  const { messages, derivation } = state;
  // Construir prompt dinámico según la derivación
  const systemPrompt = buildAgentPrompt(derivation);
  const modelWithTools = model.bindTools(tools);
  const response = await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  return { messages: [response] };
};

const toolNode = new ToolNode(tools);

const router = async (state: typeof MessagesState.State) => {
  const messages = state.messages;
  const ROUTER_SYSTEM_PROMPT = `
# ROL

Sos el enrutador de consultas de KOMBAT Padel. Tu única función es clasificar el mensaje del cliente y determinar a qué área debe dirigirse para ser atendido correctamente.

---

# ÁREAS DISPONIBLES

## 1. VENTAS_TIENDA
Consultas sobre compras en la tienda oficial (pago contado).
**Señales:** precio, descuento, cuánto sale, contado, transferencia, débito, pack, oferta tienda, web oficial, quiero ver, quiero comprar [producto específico]

## 2. VENTAS_BANCOS
Consultas sobre compras con financiación bancaria.
**Señales:** cuotas, sin interés, Banco Nación, Banco Provincia, financiar, pagar en cuotas, tienda BNA, Provincia Compras

## 3. ASESORAMIENTO_PRODUCTO
El cliente necesita ayuda para elegir un producto o quiere info técnica.
**Señales:** qué pala me recomendás, no sé cuál elegir, para mi nivel, características, forma, dureza, balance, carbono, diferencia entre, comparar, cómo es la [pala]

## 4. RECLAMO
El cliente tiene un problema con una compra o servicio.
**Señales:** no llegó, llegó roto, problema, queja, reclamo, devolución, reembolso, mal estado, pedido, error, no me respondieron

## 5. ENVIOS_LOGISTICA
Consultas sobre envíos, tiempos de entrega, costos de envío.
**Señales:** envío, cuánto tarda, costo de envío, hacen envíos a, seguimiento, dónde está mi pedido

## 6. MAYORISTA
Quiere comprar por cantidad para reventa.
**Señales:** mayorista, revender, por mayor, cantidad, precio por lote, distribuidor, para mi club

## 7. INFO_GENERAL
Consultas generales sobre la marca, horarios, contacto, programas.
**Señales:** horario, dónde están, contacto, teléfono, Instagram, quiénes son, kombat en cancha, programa de profes

## 8. SALUDO
Mensaje inicial sin consulta específica.
**Señales:** hola, buenas, buen día, buenas tardes, qué tal (sin pregunta adicional)

## 9. FUERA_DE_ALCANCE
No tiene relación con KOMBAT ni pádel.
**Señales:** temas no relacionados con pádel, productos de otras marcas, spam

---

# REGLAS DE CLASIFICACIÓN

## Prioridad (si hay ambigüedad)
1. RECLAMO siempre tiene prioridad máxima (cliente con problema)
2. Si menciona cuotas/bancos → VENTAS_BANCOS
3. Si menciona precio/descuento sin cuotas → VENTAS_TIENDA
4. Si pide recomendación o compara → ASESORAMIENTO_PRODUCTO
5. Si es saludo puro sin pregunta → SALUDO

## Mensajes compuestos
Si el mensaje tiene múltiples intenciones, clasificá por la **intención principal** (la que requiere acción primero).

Ejemplo: "Hola, cuánto sale la Vulcano en cuotas?"
- Tiene saludo + consulta de precio con cuotas
- Intención principal: VENTAS_BANCOS

## Casos especiales
- "Quiero comprar" sin más contexto → SALUDO (necesita más info)
- "Tienen stock de X?" → VENTAS_TIENDA (es consulta de compra)
- "Quiero ver la Osorno" → VENTAS_TIENDA (quiere info del producto)
- "Cómo es la Krakatoa?" → ASESORAMIENTO_PRODUCTO (quiere specs)
- "No me respondieron" + queja → RECLAMO
- Mensaje con insultos o agresivo → RECLAMO (priorizar contención)

---

# HERRAMIENTAS POR ÁREA

El agente usará estas herramientas según el área. Vos solo sugerís la principal.

| Área | Herramienta principal | Herramientas secundarias |
|------|----------------------|-------------------------|
| VENTAS_TIENDA | tienda_kombat_oferta_comercial | link_producto_kombat |
| VENTAS_BANCOS | precios_y_promociones_vigentes | link_producto_kombat |
| ASESORAMIENTO_PRODUCTO (recomendación) | como_elegir_palas_kombat | link_producto_kombat, tienda_kombat_oferta_comercial |
| ASESORAMIENTO_PRODUCTO (specs/comparar) | info_catalogo_vulcano | link_producto_kombat |
| RECLAMO | ninguna | - |
| ENVIOS_LOGISTICA | ninguna | - |
| MAYORISTA | ninguna | - |
| INFO_GENERAL | ninguna | link_producto_kombat (si preguntan por producto) |
| SALUDO | ninguna | - |
| FUERA_DE_ALCANCE | ninguna | - |

---

# FORMATO DE RESPUESTA

Respondé ÚNICAMENTE con un JSON válido COMO EL SCHEMA PROVISTO:



### Campo herramienta_sugerida (solo la principal)
- VENTAS_TIENDA → "tienda_kombat_oferta_comercial"
- VENTAS_BANCOS → "precios_y_promociones_vigentes"
- ASESORAMIENTO_PRODUCTO (recomendación) → "como_elegir_palas_kombat"
- ASESORAMIENTO_PRODUCTO (specs/comparar) → "info_catalogo_vulcano"
- Otros → null

---

# EJEMPLOS

## Ejemplo 1
**Mensaje:** "Hola buenas tardes"
**Respuesta:**
{
  "area": "SALUDO",
  "confianza": "alta",
  "intencion_detectada": "saludo inicial sin consulta específica",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

## Ejemplo 2
**Mensaje:** "Cuánto sale la Vulcano?"
**Respuesta:**
{
  "area": "VENTAS_TIENDA",
  "confianza": "alta",
  "intencion_detectada": "consulta precio pala Vulcano",
  "requiere_herramienta": true,
  "herramienta_sugerida": "tienda_kombat_oferta_comercial"
}

## Ejemplo 3
**Mensaje:** "Tienen cuotas sin interés con banco nación?"
**Respuesta:**
{
  "area": "VENTAS_BANCOS",
  "confianza": "alta",
  "intencion_detectada": "consulta financiación Banco Nación",
  "requiere_herramienta": true,
  "herramienta_sugerida": "precios_y_promociones_vigentes"
}

## Ejemplo 4
**Mensaje:** "Qué pala me recomiendan para alguien que recién empieza?"
**Respuesta:**
{
  "area": "ASESORAMIENTO_PRODUCTO",
  "confianza": "alta",
  "intencion_detectada": "recomendación de pala para principiante",
  "requiere_herramienta": true,
  "herramienta_sugerida": "como_elegir_palas_kombat"
}

## Ejemplo 5
**Mensaje:** "Compré hace 10 días y no me llegó nada"
**Respuesta:**
{
  "area": "RECLAMO",
  "confianza": "alta",
  "intencion_detectada": "reclamo por pedido no entregado",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

## Ejemplo 6
**Mensaje:** "Hacen envíos a Mendoza? Cuánto sale?"
**Respuesta:**
{
  "area": "ENVIOS_LOGISTICA",
  "confianza": "alta",
  "intencion_detectada": "consulta envío y costo a Mendoza",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

## Ejemplo 7
**Mensaje:** "Quiero comprar 20 palas para mi club"
**Respuesta:**
{
  "area": "MAYORISTA",
  "confianza": "alta",
  "intencion_detectada": "compra mayorista para club",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

## Ejemplo 8
**Mensaje:** "Qué diferencia hay entre la Osorno y la Vesubio?"
**Respuesta:**
{
  "area": "ASESORAMIENTO_PRODUCTO",
  "confianza": "alta",
  "intencion_detectada": "comparativa entre modelos Osorno y Vesubio",
  "requiere_herramienta": true,
  "herramienta_sugerida": "info_catalogo_vulcano"
}

## Ejemplo 9
**Mensaje:** "La pala me llegó con una rajadura, es inaceptable"
**Respuesta:**
{
  "area": "RECLAMO",
  "confianza": "alta",
  "intencion_detectada": "reclamo producto defectuoso",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

## Ejemplo 10
**Mensaje:** "Hola, vi que tienen promos con bancos, cuáles son?"
**Respuesta:**
{
  "area": "VENTAS_BANCOS",
  "confianza": "alta",
  "intencion_detectada": "consulta promociones bancarias",
  "requiere_herramienta": true,
  "herramienta_sugerida": "precios_y_promociones_vigentes"
}

## Ejemplo 11
**Mensaje:** "Quiero ver la Osorno"
**Respuesta:**
{
  "area": "VENTAS_TIENDA",
  "confianza": "alta",
  "intencion_detectada": "quiere ver/comprar pala Osorno",
  "requiere_herramienta": true,
  "herramienta_sugerida": "tienda_kombat_oferta_comercial"
}

## Ejemplo 12
**Mensaje:** "Cómo es la Krakatoa? Es buena para defensa?"
**Respuesta:**
{
  "area": "ASESORAMIENTO_PRODUCTO",
  "confianza": "alta",
  "intencion_detectada": "consulta características Krakatoa para estilo defensivo",
  "requiere_herramienta": true,
  "herramienta_sugerida": "info_catalogo_vulcano"
}

## Ejemplo 13
**Mensaje:** "Qué es Kombat en Cancha?"
**Respuesta:**
{
  "area": "INFO_GENERAL",
  "confianza": "alta",
  "intencion_detectada": "consulta sobre programa Kombat en Cancha",
  "requiere_herramienta": false,
  "herramienta_sugerida": null
}

---

# NOTAS FINALES

- Respondé SOLO el JSON, nada más
- Si no podés clasificar con certeza, usá confianza "baja"
- Ante duda entre VENTAS_TIENDA y VENTAS_BANCOS: ¿mencionó cuotas? Sí → BANCOS, No → TIENDA
- Ante duda entre VENTAS_TIENDA y ASESORAMIENTO: ¿pregunta precio o características? Precio → TIENDA, Características → ASESORAMIENTO
- Un mensaje agresivo o con insultos siempre es RECLAMO
- El agente decidirá si usa herramientas secundarias como link_producto_kombat
`;

  const modelRouter = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
  }).withStructuredOutput(routerSchemaSimple, { strict: true }).withConfig({tags:['nostream']});

  const response = await modelRouter.invoke([
    new SystemMessage(ROUTER_SYSTEM_PROMPT),
    ...messages,
  ]);

  return { derivation: response };
};

const faqNode = async (state: typeof MessagesState.State) => {
  const messages = state.messages;

  const model = new ChatOpenAI({
    model: "gpt-4o-mini", // Modelo económico para clasificación
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  }).withStructuredOutput(faqSchema, { strict: true }).withConfig({tags:['nostream']});

  const response = await model.invoke([
    new SystemMessage(FAQ_SYSTEM_PROMPT),
    ...messages,
  ]);

  return { 
    messages: messages, 
    faqResult: response 
  };
};

const shouldContinue = (state: typeof MessagesState.State) => {
  const last = state.messages.at(-1) as AIMessage;
  // if (!last || !(last instanceof AIMessage)) return END;
  console.log("last", last);
  return last?.tool_calls?.length ? "toolNode" : END;
};

const graphKombat = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("faqNode", faqNode)
  .addNode("faqResponseNode", faqResponseNode)
  .addNode("router", router)
  .addNode("toolNode", toolNode)
  .addEdge(START, "faqNode")
  .addConditionalEdges("faqNode", afterFaq, ["faqResponseNode", "router"])
  .addEdge("router", "llmCall")
  .addEdge("faqResponseNode", END)
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall");

const checkpointer = new MemorySaver();
export const workflow = graphKombat.compile({ checkpointer });

// Ejemplo de uso:
// async function demo() {
//   const orgId = "kombatpadel";
//   const agentId = "agent_wsp";
//   const title = "como_elegir_palas_kombat";

//   const question = `Soy principiante en el padel y quiero elegir una pala. Me gustaria que me recomiendes una pala.`;

//   const result = await workflow.invoke(
//     {
//       messages: [new HumanMessage(question)],
//     },
//     {
//       configurable: {
//         thread_id: "1234567890",
//         orgId: orgId,
//         agentId: agentId,
//         title: title,
//       },
//     },
//   );

//   console.log("finished!");

//   console.log(result);
// }

// demo().catch(console.error);
