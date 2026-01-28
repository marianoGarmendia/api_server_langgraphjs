import { StateGraph, MessagesAnnotation, Annotation, LangGraphRunnableConfig, MemorySaver } from "@langchain/langgraph";
import { buildModel } from "./models/chatModels.js";
import { comprimedTool } from "./tools.js";

import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { conversationalPrompt } from "./prompts/conversationalPrompt.js";
import { formatContextForPrompt } from "./prompts/comprimedPrompt.js";
// import { z } from "zod";

const stateGraph = Annotation.Root({
     ...MessagesAnnotation.spec,
    user_profile: Annotation<any>(),
    analysis_nutricional: Annotation<any>(),
    informacion_nutricional: Annotation<any>(),
    suplements_info: Annotation<any>(),
    suplements_raw: Annotation<any>(),
    prescription: Annotation<string>(),
    summary: Annotation<string>(),
    comprimed_context: Annotation<string>(),
    comprimed: Annotation<boolean>(),
    total_tokens: Annotation<number>({
        reducer: (x, y) =>  y ?? 0,
        default: () => 0,
      }),
 
})

const model = buildModel("gpt-5-mini");

const comprimedNode = async (state: typeof stateGraph.State, config: LangGraphRunnableConfig) => {
    const { summary, messages, comprimed , comprimed_context } = state;
    const {  analisis_nutricional, informacion_nutricional, suplements_raw, prescription } = config?.configurable as any;
    console.log("suplements_raw", suplements_raw);
    console.log("prescription", prescription);
    console.log("analisis_nutricional", analisis_nutricional);
    console.log("informacion_nutricional", informacion_nutricional);
    console.log("messages", messages);

    console.log("comprimed", comprimed);


    if(comprimed){
        console.log("comprimed es true");
        console.log("comprimed_context", comprimed_context);
        return {
            comprimed_context: comprimed_context,
            summary: summary,
            comprimed: comprimed,
            messages: [...messages]
        };
    }



const hasSuplementsPlan =
  Array.isArray(suplements_raw) && suplements_raw.length > 0;

if (!hasSuplementsPlan) {
  return {
    comprimed: true,
    summary,
    comprimed_context: formatContextForPrompt({
      resumen_usuario: {
        objetivo_principal: null,
        objetivos_secundarios: [],
        datos_perfil: {
          edad: null,
          sexo: null,
          peso_kg: null,
          altura_cm: null,
          actividad: null,
        },
        banderas_riesgo: {
          embarazo_o_lactancia: null,
          medicamentos: [],
          condiciones: [],
          alergias_intolerancias: [],
        },
        rutina: {
          horario_entrenamiento: null,
          horario_sueno: null,
        },
      },
      resumen_plan_nutricional: {
        existe_plan: false,
        aspectos_destacados: [],
        brechas_potenciales: [],
      },
      plan_supletario: {
        existe_plan: false,
        elementos: [],
        horario_diario_sugerido: null,
      },
      notas_de_seguridad: [],
      preguntas_abiertas: [],
      no_perder: [
        "No hay un plan de suplementación prescripto disponible.",
        "No puedes responder sobre ese plan.",
        "Solo puedes responder consultas genéricas sobre los suplementos de Centenarian Road.",
      ],
    }),
    messages: [...messages],
  };
}

const baseContext = formatContextForPrompt({
  suplements_raw,
  prescription,
  analysis_nutricional: analisis_nutricional,
  informacion_nutricional,
});

const comprimedResult = await comprimedTool.invoke({
  context: baseContext,
});



const formattedContext = formatContextForPrompt(comprimedResult);


    return {
        comprimed: true,
        summary: summary,
        comprimed_context: formattedContext,
        messages: [...messages]
    };
}

// const summarizeConversation = async (state: typeof stateGraph.State) => {
//     const { summary, messages } = state;

//     // Prompt para resumir
//     const prompt = summary 
//       ? `Este es el resumen actual: ${summary}. Extiéndelo con estos nuevos mensajes:`
//       : "Resume la conversación de arriba:";
  
//     const response = await model.invoke([...messages, new HumanMessage(prompt)]);
  
//     // Creamos la lista de mensajes a eliminar (todos excepto los 2 últimos)
//     const deleteMessages = messages.slice(0, -2).map(m => new RemoveMessage({ id: m.id! }));
  
//     return { 
//       summary: response.content, 
//       messages: deleteMessages // El reducer borrará estos IDs del estado
//     };
//   };

const agentNode = async (state: typeof stateGraph.State , config: LangGraphRunnableConfig) => {
    const { messages , comprimed_context } = state;

   
   


    try {
        const threadId = config?.configurable?.thread_id;
        console.log("threadId", threadId);
    
        // const { thread_id, nutri_id, enterprise_id, analisis_nutricional, informacion_nutricional, suplements_raw, prescription } = config?.configurable as any;
    
        const prompt: string = conversationalPrompt({
            agent_name: "centenarian",
            context: comprimed_context,
        }) as string;
        const result = await model.invoke([new SystemMessage(prompt), ...messages]);

        console.log("result", result);

        console.log(messages);
        return {
            messages: [...messages, result],
        };
    }catch(error){
        console.error("Error en agentNode:", error);
        return {
            messages: [...messages, new AIMessage("Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta nuevamente.")],
        };
    }
}

const graphBuilder = new StateGraph(stateGraph);
graphBuilder
.addNode("agent", agentNode)
.addNode("comprimir", comprimedNode)
.addEdge("__start__", "comprimir")
.addEdge("comprimir", "agent")
.addEdge("agent", "__end__")

// graphBuilder
// // .addNode("comprimir", comprimedNode)
// .addNode("agent", agentNode)
// .addEdge("__start__", "agent")
// // .addEdge("comprimir", "agent")
// .addEdge("agent", "__end__")


const checkpointer = new MemorySaver();

export const conversationalAgent = graphBuilder.compile({ checkpointer});
