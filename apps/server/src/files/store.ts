import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};

export class FileStoreError extends Error {
  constructor(public readonly code: "unsupported_type" | "too_large" | "file_not_found" | "bad_scope", message: string) {
    super(message);
  }
}

export type StoredFile = { fileId: string; mediaType: string; bytes: Uint8Array };

/** Files live under <dataDir>/<profile>/<year>/uploads. Ids are server-generated; nothing user-supplied reaches a path. */
export function createFileStore(dataDir: string, profile: string, year: number) {
  if (!/^[a-z0-9_-]{1,40}$/i.test(profile) || !Number.isInteger(year)) throw new FileStoreError("bad_scope", "bad profile or year");
  const dir = join(dataDir, profile, String(year), "uploads");

  return {
    async save(input: { mediaType: string; bytes: Uint8Array }): Promise<{ fileId: string; mediaType: string }> {
      const ext = EXT_BY_TYPE[input.mediaType];
      if (!ext) throw new FileStoreError("unsupported_type", `Unsupported type: ${input.mediaType}`);
      if (input.bytes.byteLength > MAX_UPLOAD_BYTES) throw new FileStoreError("too_large", "File too large");
      await mkdir(dir, { recursive: true });
      const fileId = `${randomUUID()}.${ext}`;
      await writeFile(join(dir, fileId), input.bytes);
      return { fileId, mediaType: input.mediaType };
    },
    async read(fileId: string): Promise<StoredFile> {
      const match = /^[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.exec(fileId);
      if (!match) throw new FileStoreError("file_not_found", "Unknown file");
      const mediaType = TYPES[match[1]!]!;
      try {
        return { fileId, mediaType, bytes: await readFile(join(dir, fileId)) };
      } catch {
        throw new FileStoreError("file_not_found", "Unknown file");
      }
    },
    async list(): Promise<string[]> {
      return readdir(dir).catch(() => []);
    },
  };
}

export type FileStore = ReturnType<typeof createFileStore>;
