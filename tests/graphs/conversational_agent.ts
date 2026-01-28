import { StateGraph, START, END, MessagesAnnotation, Annotation, LangGraphRunnableConfig, MemorySaver } from "@langchain/langgraph";
import { buildModel } from "./models/chatModels.js";
import { comprimedTool } from "./tools.js";

import { SystemMessage, AIMessage, type BaseMessage, AIMessageFields, HumanMessage, RemoveMessage } from "@langchain/core/messages";
import { conversationalPrompt } from "./prompts/conversationalPrompt.js";
import { formatContextForPrompt } from "./prompts/comprimedPrompt.js";
import { z } from "zod";

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

    if(comprimed){
        return {
            comprimed_context: comprimed_context,
            messages: messages,
        };
    }

    const { thread_id, nutri_id, enterprise_id, analisis_nutricional, informacion_nutricional, suplements_raw, prescription } = config?.configurable as any;

const comprimedResult = await comprimedTool.invoke({
  context: formatContextForPrompt({
    suplements_raw,
    prescription,
    analysis_nutricional: analisis_nutricional,
    informacion_nutricional,
  }),
});



const formattedContext = formatContextForPrompt(comprimedResult);

    const model = buildModel("gpt-4o-mini");

    return {
        comprimed: true,
        summary: summary,
        comprimed_context: formattedContext,
        messages: messages,
    };
}

const summarizeConversation = async (state: typeof stateGraph.State) => {
    const { summary, messages } = state;

    // Prompt para resumir
    const prompt = summary 
      ? `Este es el resumen actual: ${summary}. Extiéndelo con estos nuevos mensajes:`
      : "Resume la conversación de arriba:";
  
    const response = await model.invoke([...messages, new HumanMessage(prompt)]);
  
    // Creamos la lista de mensajes a eliminar (todos excepto los 2 últimos)
    const deleteMessages = messages.slice(0, -2).map(m => new RemoveMessage({ id: m.id! }));
  
    return { 
      summary: response.content, 
      messages: deleteMessages // El reducer borrará estos IDs del estado
    };
  };

const agentNode = async (state: typeof stateGraph.State , config: LangGraphRunnableConfig) => {
    const { messages , comprimed_context } = state;

    // const { thread_id, nutri_id, enterprise_id, analisis_nutricional, informacion_nutricional, suplements_raw, prescription } = config?.configurable as any;

    const prompt: string = conversationalPrompt({
        agent_name: "centenarian",
        context: comprimed_context,
    }) as string;
    console.log("comprimed_context", comprimed_context);
    console.log("prompt", prompt);


    try {
        const result = await model.invoke([new SystemMessage(prompt), ...messages]);
        return {
            messages: [...messages, new AIMessage(result.content as string)], // Revisar si es necesario pasar el objeto que diga { content: result.content }
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


const checkpointer = new MemorySaver();

export const conversationalAgent = graphBuilder.compile({
    checkpointer,
});
