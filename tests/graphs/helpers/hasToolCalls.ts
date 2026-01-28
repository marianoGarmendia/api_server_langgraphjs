import { AIMessage, BaseMessage } from "@langchain/core/messages";

function hasToolCalls(messages: BaseMessage[]): boolean {
    if (!messages || messages.length === 0) {
      return false;
    }
  
    const lastMessage = messages[messages.length - 1];
  
    // Verificamos que sea un mensaje de IA y que tenga tool_calls con contenido
    return (
      lastMessage instanceof AIMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    );
  }


export { hasToolCalls };