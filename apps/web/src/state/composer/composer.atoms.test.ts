import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { selectedYearAtom } from "../app";
import {
  addAttachmentAtom,
  attachmentsAtom,
  clearConversationAtom,
  clearQuestionDraftsAtom,
  draftAtom,
  questionDraftsAtomFamily,
  removeAttachmentAtom,
} from "./composer.atoms";

describe("composer atoms", () => {
  it("start empty", () => {
    const s = createStore();
    expect(s.get(draftAtom)).toBe("");
    expect(s.get(attachmentsAtom)).toEqual([]);
  });

  it("clearConversationAtom empties draft and attachments, leaves year", () => {
    const s = createStore();
    s.set(selectedYearAtom, 2024);
    s.set(draftAtom, "hello");
    s.set(addAttachmentAtom, { fileId: "f1", name: "a.pdf" });
    s.set(clearConversationAtom);
    expect(s.get(draftAtom)).toBe("");
    expect(s.get(attachmentsAtom)).toEqual([]);
    expect(s.get(selectedYearAtom)).toBe(2024);
  });

  it("changing the year alone does not clear; clearConversationAtom does", () => {
    const s = createStore();
    s.set(selectedYearAtom, 2024);
    s.set(draftAtom, "hello");
    s.set(addAttachmentAtom, { fileId: "f1", name: "a.pdf" });
    s.set(selectedYearAtom, 2023);
    expect(s.get(draftAtom)).toBe("hello");
    expect(s.get(attachmentsAtom)).toHaveLength(1);
    s.set(clearConversationAtom);
    expect(s.get(attachmentsAtom)).toEqual([]);
    expect(s.get(draftAtom)).toBe("");
  });

  it("addAttachmentAtom de-duplicates by fileId", () => {
    const s = createStore();
    s.set(addAttachmentAtom, { fileId: "f1", name: "a.pdf" });
    s.set(addAttachmentAtom, { fileId: "f1", name: "a.pdf" });
    s.set(addAttachmentAtom, { fileId: "f2", name: "b.pdf" });
    expect(s.get(attachmentsAtom).map((a) => a.fileId)).toEqual(["f1", "f2"]);
  });

  it("removeAttachmentAtom removes by fileId and ignores unknown ids", () => {
    const s = createStore();
    s.set(addAttachmentAtom, { fileId: "f1", name: "a.pdf" });
    s.set(addAttachmentAtom, { fileId: "f2", name: "b.pdf" });
    s.set(removeAttachmentAtom, "f1");
    s.set(removeAttachmentAtom, "nope");
    expect(s.get(attachmentsAtom).map((a) => a.fileId)).toEqual(["f2"]);
  });
});

describe("questionDraftsAtomFamily", () => {
  it("is stable for the same id and distinct across ids", () => {
    expect(questionDraftsAtomFamily("t1")).toBe(questionDraftsAtomFamily("t1"));
    expect(questionDraftsAtomFamily("t1")).not.toBe(questionDraftsAtomFamily("t2"));
  });

  it("holds independent values per toolCallId, defaulting to empty string", () => {
    const s = createStore();
    expect(s.get(questionDraftsAtomFamily("t1"))).toBe("");
    s.set(questionDraftsAtomFamily("t1"), "abc");
    expect(s.get(questionDraftsAtomFamily("t1"))).toBe("abc");
    expect(s.get(questionDraftsAtomFamily("t2"))).toBe("");
  });
});

describe("clearing question drafts", () => {
  it("clearQuestionDraftsAtom empties every known question draft and nothing else", () => {
    const s = createStore();
    s.set(draftAtom, "keep");
    s.set(questionDraftsAtomFamily("q-a"), "1");
    s.set(questionDraftsAtomFamily("q-b"), "2");
    s.set(clearQuestionDraftsAtom);
    expect(s.get(questionDraftsAtomFamily("q-a"))).toBe("");
    expect(s.get(questionDraftsAtomFamily("q-b"))).toBe("");
    expect(s.get(draftAtom)).toBe("keep");
  });

  it("clearConversationAtom also empties question drafts", () => {
    const s = createStore();
    s.set(questionDraftsAtomFamily("q-c"), "42");
    s.set(clearConversationAtom);
    expect(s.get(questionDraftsAtomFamily("q-c"))).toBe("");
  });

  it("changing the year alone keeps question drafts", () => {
    const s = createStore();
    s.set(selectedYearAtom, 2025);
    s.set(questionDraftsAtomFamily("q-d"), "7");
    s.set(selectedYearAtom, 2026);
    expect(s.get(questionDraftsAtomFamily("q-d"))).toBe("7");
  });
});
