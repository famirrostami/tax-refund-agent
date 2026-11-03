import { convertToModelMessages, isStepCount, streamText, type LanguageModel, type ToolSet, type UIMessage } from "ai";

export type StreamAgentInput = {
  model: LanguageModel;
  system: string;
  messages: Omit<UIMessage, "id">[];
  tools?: ToolSet;
  maxSteps?: number;
  signal?: AbortSignal;
};

/** One agent turn: streams text and tool steps until the model stops or the step limit is reached. */
export async function streamAgent({ model, system, messages, tools = {}, maxSteps = 8, signal }: StreamAgentInput) {
  const modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
  return streamText({
    model,
    instructions: system,
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(maxSteps),
    abortSignal: signal,
  });
}
