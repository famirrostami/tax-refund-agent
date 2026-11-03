/** Appends uploaded file ids to a chat message, one `fileId: <id>` line each (agent wire protocol, not UI text). */
export function formatFileMention(text: string, fileIds: string[]): string {
  if (fileIds.length === 0) return text;
  const lines = fileIds.map((id) => `fileId: ${id}`).join("\n");
  return text.trim() === "" ? lines : `${text}\n\n${lines}`;
}
