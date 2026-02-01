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

import { priceTool, infoCatalogoVulcano, infoPalasKombat } from "./tools.js";

const model = new ChatOpenAI({
  model: "gpt-5-nano-2025-08-07",

  apiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
});

const tools = [infoPalasKombat, priceTool, infoCatalogoVulcano];

tools.forEach((tool) => {
  console.log("tool name");
  console.log(tool.name);
});
const modelWithTools = model.bindTools(tools);

const MessagesState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

const llmCall = async (state: typeof MessagesState.State) => {
  const { messages } = state;

  const sysMessage =
    new SystemMessage(` Sos un asistente RAG. Para preguntas sobre el PDF, SIEMPRE llamá a kb_search antes de responder.,
        "Luego respondé usando SOLO el contexto retornado por la tool y citá pageNumber si está disponible en metadata.loc.pageNumber.,`);

  const response = await modelWithTools.invoke([sysMessage, ...messages]);
  return { messages: [response] };
};

const toolNode = new ToolNode(tools);

const shouldContinue = (state: typeof MessagesState.State) => {
  const last = state.messages.at(-1);
  if (!last || !(last instanceof AIMessage)) return END;
  return last.tool_calls?.length ? "toolNode" : END;
};

const graphKombat = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "llmCall")
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
    }
  );

  console.log("finished!");

  console.log(result);
}

// demo().catch(console.error);
