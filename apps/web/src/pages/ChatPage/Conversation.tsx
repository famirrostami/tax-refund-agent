import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, useAgentChat, useUploadFile } from "../../api";
import type { AgentChatMessage } from "../../api";
import { formatFileMention } from "../../lib";
import {
  addAttachmentAtom,
  attachmentsAtom,
  clearConversationAtom,
  draftAtom,
  removeAttachmentAtom,
  selectedYearAtom,
} from "../../state";
import { Button, Select, Spinner } from "../../ui/atoms";
import { DropZone, FileChip, Message, Notice } from "../../ui/molecules";
import { ChatLog, Composer } from "../../ui/organisms";
import { AppShell } from "../../ui/templates";
import { PartView } from "./PartView";

export interface ConversationProps {
  year: number;
  years: number[];
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

/** Key of the first unresolved question/approval across the conversation; only that one is actionable. */
function firstOpenGate(messages: AgentChatMessage[]): string | null {
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.kind === "question" && !p.answer) return `question:${p.question.toolCallId}`;
      if (p.kind === "approval" && p.approval.approved === undefined) return `approval:${p.approval.toolCallId}`;
    }
  }
  return null;
}

const gateKey = (p: AgentChatMessage["parts"][number]): string | null =>
  p.kind === "question" ? `question:${p.question.toolCallId}` : p.kind === "approval" ? `approval:${p.approval.toolCallId}` : null;

/** The chat for one tax year. Mounted per year (keyed by the parent), so the agent conversation starts fresh. */
export function Conversation({ year, years }: ConversationProps) {
  const { t } = useTranslation("common");
  const chat = useAgentChat(year);
  const upload = useUploadFile(year);
  const [draft, setDraft] = useAtom(draftAtom);
  const [attachments, setAttachments] = useAtom(attachmentsAtom);
  const addAttachment = useSetAtom(addAttachmentAtom);
  const removeAttachment = useSetAtom(removeAttachmentAtom);
  const clearConversation = useSetAtom(clearConversationAtom);
  const setYear = useSetAtom(selectedYearAtom);
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // False once this conversation is unmounted (year switched) or reset; late upload results are then discarded.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const errorText = (code: string): string => {
    switch (code) {
      case "invalid_request":
        return t("chat.error.invalid_request");
      case "unsupported_year":
        return t("chat.error.unsupported_year");
      case "invalid_answer":
        return t("chat.error.invalid_answer");
      case "network_error":
        return t("chat.error.network_error");
      case "stream_error":
        return t("chat.error.stream_error");
      case "file_type":
        return t("chat.error.file_type");
      case "file_too_large":
        return t("chat.error.file_too_large");
      case "unsupported_type":
        return t("chat.error.unsupported_type");
      case "too_large":
        return t("chat.error.too_large");
      default:
        return t("chat.error.unknown");
    }
  };

  const busy = chat.status === "submitted" || chat.status === "streaming";
  const openGate = firstOpenGate(chat.messages);
  // When a turn ends with nothing to answer, give the keyboard back to the composer if focus fell to <body>
  // (e.g. the button the user pressed was removed). Never steal focus from where the user moved it.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasBusy = useRef(busy);
  useEffect(() => {
    const turnEnded = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!turnEnded || openGate !== null) return;
    const active = document.activeElement;
    if (!active || active === document.body) inputRef.current?.focus();
  }, [busy, openGate]);

  const hasContent = chat.messages.length > 0 || draft.trim() !== "" || attachments.length > 0 || upload.isPending;

  const changeYear = (next: number) => {
    if (next === year) return;
    if (hasContent) setPendingYear(next);
    else setYear(next);
  };

  const confirmYear = () => {
    if (pendingYear === null) return;
    live.current = false;
    chat.reset();
    clearConversation();
    setYear(pendingYear);
  };

  const uploadFiles = async (files: File[]) => {
    setUploadError(null);
    for (const file of files) {
      if (!live.current) return;
      try {
        const uploaded = await upload.mutateAsync(file);
        // A file stored for this year must never land in another year's conversation.
        if (live.current) addAttachment({ fileId: uploaded.fileId, name: uploaded.name });
      } catch (e) {
        if (live.current) setUploadError(e instanceof ApiError ? e.code : "network_error");
      }
    }
  };

  const sendDraft = () => {
    chat.send(formatFileMention(draft.trim(), attachments.map((a) => a.fileId)));
    setDraft("");
    setAttachments([]);
  };

  const header = (
    <>
      <h1>{t("app.title")}</h1>
      <label htmlFor="tax-year">{t("chat.year.label")}</label>{" "}
      <Select id="tax-year" value={String(year)} onChange={(e) => changeYear(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {String(y)}
          </option>
        ))}
      </Select>
    </>
  );

  const footer = (
    <>
      {chat.error ? (
        <Notice
          tone="danger"
          actions={
            chat.error.code === "invalid_answer" ? undefined : (
              <Button tone="primary" onClick={chat.retry}>
                {t("chat.error.retry")}
              </Button>
            )
          }
        >
          {errorText(chat.error.code)}
        </Notice>
      ) : null}
      {uploadError ? (
        <Notice
          tone="danger"
          actions={
            <Button onClick={() => setUploadError(null)}>{t("chat.upload.dismiss")}</Button>
          }
        >
          {errorText(uploadError)}
        </Notice>
      ) : null}
      <DropZone
        label={t("chat.upload.label")}
        accept={ACCEPT}
        multiple
        busy={upload.isPending}
        busyLabel={t("chat.upload.busy")}
        onFiles={(files) => void uploadFiles(files)}
      />
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={sendDraft}
        placeholder={t("chat.composer.placeholder")}
        inputLabel={t("chat.composer.inputLabel")}
        sendLabel={t("chat.composer.send")}
        sendDisabled={busy || openGate !== null}
        inputRef={inputRef}
        canSend={draft.trim() !== "" || attachments.length > 0}
        attachments={
          attachments.length > 0
            ? attachments.map((a) => (
                <FileChip
                  key={a.fileId}
                  name={a.name}
                  removeLabel={t("chat.composer.removeFile", { name: a.name })}
                  onRemove={() => removeAttachment(a.fileId)}
                />
              ))
            : undefined
        }
        footer={
          busy ? (
            <Button onClick={chat.stop}>{t("chat.composer.stop")}</Button>
          ) : undefined
        }
      />
    </>
  );

  return (
    <AppShell header={header} footer={footer}>
      {pendingYear !== null ? (
        <Notice
          tone="warning"
          title={t("chat.year.confirmTitle")}
          actions={
            <>
              <Button onClick={() => setPendingYear(null)}>{t("chat.year.cancel")}</Button>
              <Button tone="danger" onClick={confirmYear}>
                {t("chat.year.confirm")}
              </Button>
            </>
          }
        >
          {t("chat.year.confirmBody", { year: String(pendingYear) })}
        </Notice>
      ) : null}
      <ChatLog aria-label={t("chat.log.label")} emptyContent={<p>{t("chat.log.empty")}</p>}>
        {chat.messages.map((m) => (
          <Message
            key={m.id}
            role={m.role}
            aria-label={m.role === "user" ? t("chat.message.user") : t("chat.message.assistant")}
          >
            {m.parts.map((p, i) => {
              const key = gateKey(p);
              return (
                <PartView
                  key={key ?? `${m.id}:${i}`}
                  part={p}
                  year={year}
                  actionable={!busy && key !== null && key === openGate}
                  onAnswer={chat.answerQuestion}
                  onApproval={chat.respondApproval}
                />
              );
            })}
          </Message>
        ))}
        {busy ? <Spinner aria-label={t("chat.log.working")} /> : null}
      </ChatLog>
    </AppShell>
  );
}
