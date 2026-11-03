import { atom, type PrimitiveAtom } from "jotai";

export type PendingAttachment = { fileId: string; name: string };

export const draftAtom = atom("");

/** Uploaded files waiting to be sent with the next message. */
export const attachmentsAtom = atom<PendingAttachment[]>([]);

export const addAttachmentAtom = atom(null, (get, set, attachment: PendingAttachment) => {
  const current = get(attachmentsAtom);
  if (current.some((a) => a.fileId === attachment.fileId)) return;
  set(attachmentsAtom, [...current, attachment]);
});

export const removeAttachmentAtom = atom(null, (get, set, fileId: string) => {
  set(
    attachmentsAtom,
    get(attachmentsAtom).filter((a) => a.fileId !== fileId),
  );
});

const questionDrafts = new Map<string, PrimitiveAtom<string>>();

/** Empties every question draft created so far (the family is module-level, keyed by toolCallId). */
export const clearQuestionDraftsAtom = atom(null, (_get, set) => {
  for (const a of questionDrafts.values()) set(a, "");
});

/** Empties the composer and question drafts. Year changes never call this implicitly; the page does after confirming. */
export const clearConversationAtom = atom(null, (_get, set) => {
  set(draftAtom, "");
  set(attachmentsAtom, []);
  set(clearQuestionDraftsAtom);
});

/** Per-question draft input value, memoised by toolCallId. */
export function questionDraftsAtomFamily(toolCallId: string): PrimitiveAtom<string> {
  let a = questionDrafts.get(toolCallId);
  if (!a) {
    a = atom("");
    questionDrafts.set(toolCallId, a);
  }
  return a;
}
