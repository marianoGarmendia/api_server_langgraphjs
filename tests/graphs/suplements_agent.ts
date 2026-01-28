import {StateGraph, START, END, MessagesAnnotation, Annotation, LangGraphRunnableConfig} from "@langchain/langgraph";
import { SystemMessage, AIMessage, type BaseMessage, AIMessageFields } from "@langchain/core/messages";
import {ToolNode} from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { buildModel } from "./models/chatModels.js";
import { suplementsProductsTool, suplementsPrescriptionTool } from "./tools.js";
import { suplementsAgentPrompt } from "./prompts/suplementsPrompts.js";
import { HumanMessage } from "@langchain/core/messages";
import { getSuplementsByIds } from "./db/suplementsRepository.js";
import { hasToolCalls } from "./helpers/hasToolCalls.js";

const stateGraph = Annotation.Root({
    ...MessagesAnnotation.spec,
    user_profile: Annotation<any>(),
    analysis_nutricional: Annotation<any>(),
    suplements_info: Annotation<any>(),
    suplements_selected: Annotation<any>(),
    prescription: Annotation<string>(),
    total_tokens: Annotation<number>({
        reducer: (x, y) =>  y ?? 0,
        default: () => 0,
      }),
 
})


const model = buildModel("gpt-4o-mini");
const tools = [suplementsProductsTool];
const toolNode = new ToolNode(tools);

const modelWithTools = model.bindTools(tools);

const agentNode = async (state: typeof stateGraph.State , config: LangGraphRunnableConfig) => {
    const { messages } = state;
    const { thread_id, nutri_id, enterprise_id, analisis_nutricional, informacion_nutricional, prompt } = config?.configurable as any;
    console.log("Tokens acumulados al entrar al nodo:", state.total_tokens);

    const suplementsProductsToolResult = await suplementsProductsTool.invoke({
        analisis_nutricional,
        informacion_nutricional,
        prompt,
    });

    console.log("suplementsProductsToolResult", suplementsProductsToolResult)

    const selectedIds = Array.isArray((suplementsProductsToolResult as any)?.selected_ids)
      ? ((suplementsProductsToolResult as any).selected_ids as string[])
      : [];

    const selectedSuplements = await getSuplementsByIds(selectedIds);
   



//     const withSystem =
//         messages?.length && messages[0]?._getType?.() === "system"
//             ? messages
//             : [new SystemMessage(suplementsAgentPrompt), ...(messages ?? [])];
//     const response = await modelWithTools.invoke(withSystem);


//     // 2. Extraer tokens de la respuesta actual
//   const usage = (response as any).usage_metadata?.total_tokens  ?? 0;
//   console.log("usage", usage)

    return {
      suplements_selected: {
        ...suplementsProductsToolResult,
        suplements_raw: selectedSuplements,
      },
    };
}

const analysisSuplementsNode = async (state: typeof stateGraph.State , config: LangGraphRunnableConfig) => {
    const { suplements_selected  } = state;
    const { thread_id, nutri_id, enterprise_id, analisis_nutricional, informacion_nutricional, prompt } = config?.configurable as any;
    try {
        const result = await suplementsPrescriptionTool.invoke({
            suplements_raw: suplements_selected.suplements_raw,
            analysis: analisis_nutricional,
            informacion_nutricional: informacion_nutricional,
            prompt: prompt,
        });
        return {
            prescription: result.prescription,
        };

    }catch(error){
        console.error("Error en analysisSuplementsNode:", error);
        return {
            prescription: null,
        };
    }
  
}

const graphBuilder = new StateGraph(stateGraph);

// const fullHandler = {
//     // Se dispara al inicio de CUALQUIER componente (grafo, nodo, cadena)
//     handleChainStart: (chain, inputs) => {
//         console.log("Iniciando paso... chain")
        
//     },
    
//     // Se dispara específicamente cuando un MODELO empieza a generar
//     handleLLMStart: (llm, prompts) => {
//         console.log("Generando respuesta...")
//         console.log("prompts", )
//         console.log("llm", llm)
//     },
    
//     // Se dispara cuando el MODELO termina (aquí llegan los TOKENS)
//     handleLLMEnd: (output) =>{
        
//          console.log("Tokens usados:", output.llmOutput?.tokenUsage);
//         },
    
//     // Se dispara cuando se inicia una HERRAMIENTA (tool)
//     handleToolStart: (tool, input) =>{
//         console.log("Usando herramienta:", tool.name)
//         console.log("input", input)
//     },
    
//     // Se dispara si algo falla
//     handleLLMError: (err) => console.error("Error en el modelo:", err),
//   };

// ESTO ES CON DECISION DEL MODELO EN LLAMAR A TOOLS O NO
// graphBuilder
// .addNode("agent", agentNode)
// .addNode("tools", toolNode)
// .addEdge(START, "agent")
// .addConditionalEdges("agent", shouldContinue)
// .addEdge("tools", "agent")

graphBuilder
.addNode("agent", agentNode)
.addNode("analysisSuplements", analysisSuplementsNode)
.addEdge(START, "agent")
.addEdge("agent", "analysisSuplements")
.addEdge("analysisSuplements", "__end__")


const checkpointer = new MemorySaver();

export const suplement_graph = graphBuilder.compile({
    checkpointer,
});

const run = async () => {
    const payload = {
        thread_id: "runExample",
        nutri_id: "default",
        enterprise_id: "centenarian_road",
        // Contexto del usuario + targets (lo que debería alcanzar)
        analisis_nutricional: {
            objetivo: "mejorar rendimiento y recuperación, priorizando sueño",
            targets_diarios: {
                kcal: 2400,
                proteina_g: 160,
                carbohidratos_g: 260,
                grasas_g: 70,
                fibra_g: 30,
                agua_l: 2.5,
            },
            perfil_usuario: {
                edad: 32,
                sexo: "masculino",
                peso_kg: 78,
                altura_cm: 178,
                compite: true,
                deporte: "fútbol",
                entrenamientos_por_semana: 5,
                sueño_objetivo_horas: 8,
                estres: "medio",
                dolor_articular: true,
                zona_dolor: "rodilla",
                lesiones_recientes: false,
                medicacion: null,
                intolerancias: [],
            },
        },
        // Lo que ya aporta el plan actual (nutrientes que le provee el plan del nutricionista)
        informacion_nutricional: {
            plan_actual: {
                kcal: 2200,
                macros_g: {
                    proteina_g: 140,
                    carbohidratos_g: 230,
                    grasas_g: 65,
                },
                fibra_g: 22,
                sodio_mg: 2600,
                omega3_estimado_mg: 250,
                vitamina_d_estimado_ui: 400,
            },
            notas: "El usuario reporta fatiga y sueño con despertares. Busca optimizar recuperación sin salir del plan actual.",
        },
        prompt: "Quiero mejorar mi recuperación y dormir mejor. ¿Qué suplementos del catálogo me recomendarías?, además siento algunos dolores articulares y tengo una zona dolorosa en la rodilla",
    };

    const result = await suplement_graph.invoke(
        { messages: [new HumanMessage(payload.prompt)] },
        {
            configurable: {
                thread_id: payload.thread_id,
                nutri_id: payload.nutri_id,
                enterprise_id: payload.enterprise_id,
                analisis_nutricional: payload.analisis_nutricional,
                informacion_nutricional: payload.informacion_nutricional,
                prompt: payload.prompt,
            },
            // callbacks: [fullHandler],
        }
    );

    console.log("result", result)
    console.log("suplements_selected", result.suplements_selected)
    console.log("prescription", result.prescription)
}

// run();