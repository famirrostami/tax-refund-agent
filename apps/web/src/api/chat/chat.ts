import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Answer, ChatPart } from "../../domain";
import { ApiError, apiResponse } from "../client";
import { toChatParts } from "../mappers";

export type AgentChatStatus = "ready" | "submitted" | "streaming" | "error";
export type AgentChatMessage = { id: string; role: "user" | "assistant"; parts: ChatPart[] };
export type AgentChat = {
  messages: AgentChatMessage[];
  status: AgentChatStatus;
  error: ApiError | null;
  send(text: string): void;
  answerQuestion(toolCallId: string, answer: Answer): void;
  respondApproval(toolCallId: string, approved: boolean): void;
  /** After an error: resends the conversation without duplicating the last user message. No-op otherwise. */
  retry(): void;
  stop(): void;
  reset(): void;
};

/**
 * Chat fetch: non-2xx answers become `ApiError(code, status)` (via `apiResponse`), a failed request becomes
 * `ApiError("network_error", 0)`. Aborts pass through untouched so `stop()` is not reported as an error.
 */
async function chatFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await apiResponse("/chat", init);
  } catch (e) {
    if (e instanceof ApiError || init?.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw e;
    throw new ApiError("network_error", 0);
  }
}

/** Anything else that ends a request (an `error` chunk, a broken stream) is a `stream_error`. */
const toApiError = (e: Error | undefined): ApiError | null =>
  !e ? null : e instanceof ApiError ? e : new ApiError("stream_error", 0);

/** A tool part that still needs a human: an unanswered `askUser` question or an unanswered approval. */
const waitsForHuman = (part: UIMessage["parts"][number]) =>
  isToolUIPart(part) && ((part.type === "tool-askUser" && part.state === "input-available") || part.state === "approval-requested");

/**
 * Resume only when every question/approval in the last assistant message is resolved and the AI SDK agrees the
 * step is complete (all tool outputs present, or approvals responded).
 */
function readyToResume(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || last.parts.some(waitsForHuman)) return false;
  return lastAssistantMessageIsCompleteWithToolCalls({ messages }) || lastAssistantMessageIsCompleteWithApprovalResponses({ messages });
}

/** Shows rejected answers as unanswered again so the question can be answered anew. */
const reopen = (parts: ChatPart[], rejected: ReadonlySet<string> | null): ChatPart[] =>
  !rejected || rejected.size === 0
    ? parts
    : parts.map((p) => (p.kind === "question" && p.answer && rejected.has(p.question.toolCallId) ? { kind: "question", question: p.question } : p));

/** The agent conversation for one tax year. Returns domain chat parts only; AI SDK types never leave api/. */
export function useAgentChat(year: number): AgentChat {
  const [session, setSession] = useState(0);
  // Set by answerQuestion/respondApproval: an automatic resubmission only ever follows a human action.
  const resumeArmed = useRef(false);
  // What started the latest request: a new user message or a resume after an answer/approval (decides how retry resends).
  const lastRequest = useRef<"send" | "resume">("send");
  // Questions answered since the last request the server accepted; reopened when the server rejects an answer.
  const [unconfirmed, setUnconfirmed] = useState<ReadonlySet<string>>(() => new Set());

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        fetch: chatFetch,
        prepareSendMessagesRequest: ({ messages }) => ({ body: { year, messages } }),
      }),
    [year],
  );

  const chat = useChat<UIMessage>({
    id: `agent-chat-${session}`,
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      if (!resumeArmed.current || !readyToResume(messages)) return false;
      resumeArmed.current = false;
      lastRequest.current = "resume";
      return true;
    },
    onFinish: ({ isError, isAbort }) => {
      if (!isError && !isAbort) setUnconfirmed((s) => (s.size === 0 ? s : new Set()));
    },
  });
  const { messages: uiMessages, sendMessage, regenerate, addToolOutput, addToolApprovalResponse, stop } = chat;
  const error = toApiError(chat.error);
  const rejected = error?.code === "invalid_answer" ? unconfirmed : null;

  const messages = useMemo(
    () =>
      uiMessages.flatMap((m): AgentChatMessage[] =>
        m.role === "user" || m.role === "assistant" ? [{ id: m.id, role: m.role, parts: reopen(toChatParts(m.parts), rejected) }] : [],
      ),
    [uiMessages, rejected],
  );

  const send = useCallback(
    (text: string) => {
      // A new user message supersedes any resume still armed (e.g. an answer given after Stop).
      resumeArmed.current = false;
      lastRequest.current = "send";
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const answerQuestion = useCallback(
    (toolCallId: string, answer: Answer) => {
      setUnconfirmed((s) => new Set(s).add(toolCallId));
      resumeArmed.current = true;
      void addToolOutput({ tool: "askUser", toolCallId, output: answer });
    },
    [addToolOutput],
  );

  const respondApproval = useCallback(
    (toolCallId: string, approved: boolean) => {
      const part = uiMessages
        .flatMap((m) => m.parts)
        .find((p) => isToolUIPart(p) && p.toolCallId === toolCallId && p.state === "approval-requested");
      if (!part || !isToolUIPart(part) || part.state !== "approval-requested") return;
      resumeArmed.current = true;
      void addToolApprovalResponse({ id: part.approval.id, approved });
    },
    [uiMessages, addToolApprovalResponse],
  );

  const failed = chat.status === "error";
  const retry = useCallback(() => {
    if (!failed) return;
    // A failed resume resends the history as it is (answers included); a failed reply to a user message is
    // regenerated, which drops the partial assistant message and keeps exactly one copy of the user message.
    if (lastRequest.current === "resume") void sendMessage();
    else void regenerate();
  }, [failed, sendMessage, regenerate]);

  const reset = useCallback(() => {
    resumeArmed.current = false;
    lastRequest.current = "send";
    setUnconfirmed(new Set());
    void stop();
    setSession((n) => n + 1);
  }, [stop]);

  return {
    messages,
    status: chat.status,
    error,
    send,
    answerQuestion,
    respondApproval,
    retry,
    stop: () => void stop(),
    reset,
  };
}
