import { chatCompletion, ChatMessage } from './llm7.js';
import tools from '../tools/index.js';

// Extended ChatMessage type with tool_calls
interface ExtendedChatMessage extends ChatMessage {
  tool_calls?: Array<{
    name: string;
    arguments: string | any;
    id: string;
  }>;
}

/**
 * Extended agent wrapper around the LLM7 API with tool support.  This
 * agent can handle function/tool calls emitted by the model.  When the
 * model requests a tool execution, the agent invokes the appropriate
 * local tool from the `tools` directory and then sends the tool result
 * back to the model to complete the conversation.
 */
export async function agent(env: any): Promise<any> {
  const userText = env?.content?.text || '';
  const model = env?.inputs?.parameters?.model || 'mistral-small-3.1-24b-instruct-2503';
  const maxTokens = env?.inputs?.parameters?.max_tokens || 256;
  // Begin a new conversation with a system prompt and user message
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant. If you do not know the answer, say so clearly.' },
    { role: 'user', content: userText },
  ];
  // Build tool/function definitions for the API from our local tools
  const toolSpecs = Object.values(tools).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
  // First call to the LLM7 API.  Include the tool specs so the model
  // understands which functions are available.  Use `tool_choice: 'auto'`
  // so the model can choose whether to call a tool.
  let request: any = {
    model,
    messages,
    tools: toolSpecs,
    tool_choice: 'auto',
    max_tokens: maxTokens,
  };
  let result = await chatCompletion(request);
  let choice = result.choices?.[0];
  // If the model produced a tool call, handle it
  const extendedMessage = choice?.message as ExtendedChatMessage;
  if (choice?.finish_reason === 'tool_calls' || extendedMessage?.tool_calls) {
    const toolCalls = extendedMessage.tool_calls || [];
    for (const call of toolCalls) {
      const { name, arguments: argsStr, id } = call;
      const toolDef = (tools as any)[name];
      if (!toolDef) {
        // Unknown tool – skip and continue
        continue;
      }
      let args: any = {};
      try {
        if (typeof argsStr === 'string') args = JSON.parse(argsStr);
        else args = argsStr;
      } catch {
        args = {};
      }
      // Execute the tool locally
      const toolResult = await Promise.resolve(toolDef.execute(args));
      // Append the assistant message referencing the tool call
      (messages as any).push({ role: 'assistant', content: null, tool_call_id: id } as any);
      // Append the tool result message – the role is `tool` and content is the
      // stringified result
      (messages as any).push({ role: 'tool', name, content: JSON.stringify(toolResult) } as any);
    }
    // Ask the model again with the updated messages including tool results
    request = {
      model,
      messages,
      tools: toolSpecs,
      tool_choice: 'auto',
      max_tokens: maxTokens,
    };
    result = await chatCompletion(request);
    choice = result.choices?.[0];
  }
  // Extract final assistant reply (plain text)
  const reply = choice?.message?.content || '';
  return {
    role: 'agent',
    agent: { id: 'llm7.tool', name: 'LLM7 with tools', model },
    timestamp: new Date().toISOString(),
    intent: env.intent,
    task: env.task,
    content: { type: 'text', text: reply },
    outputs: {},
    confidence: { score: 0.7 },
  };
}