import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStore } from "./store";

const make = async () => createFileStore(await mkdtemp(join(tmpdir(), "files-")), "default", 2025);

describe("file store", () => {
  it("saves and reads back a file", async () => {
    const store = await make();
    const { fileId } = await store.save({ mediaType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
    const file = await store.read(fileId);
    expect(file.mediaType).toBe("image/png");
    expect(Array.from(file.bytes)).toEqual([1, 2, 3]);
    expect(await store.list()).toEqual([fileId]);
  });
  it("rejects unsupported types and oversize files", async () => {
    const store = await make();
    await expect(store.save({ mediaType: "text/html", bytes: new Uint8Array(1) })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(store.save({ mediaType: "image/png", bytes: new Uint8Array(16 * 1024 * 1024) })).rejects.toMatchObject({ code: "too_large" });
  });
  it("never resolves ids outside the uploads folder", async () => {
    const store = await make();
    for (const id of ["../../etc/passwd", "a.png", "/abs.png"]) {
      await expect(store.read(id)).rejects.toMatchObject({ code: "file_not_found" });
    }
  });
  it("rejects unsafe profile names", () => {
    expect(() => createFileStore("/tmp", "../x", 2025)).toThrow();
  });
});
