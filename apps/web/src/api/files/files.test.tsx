import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/network";
import { createWrapper } from "../../test/render";
import { useUploadFile } from "./files";

const pdf = () => new File(["x"], "r.pdf", { type: "application/pdf" });
const run = (file: File) => {
  const { result } = renderHook(() => useUploadFile(2025), { wrapper: createWrapper().Wrapper });
  return { result, go: () => act(() => result.current.mutateAsync(file).catch(() => undefined)) };
};

describe("useUploadFile", () => {
  it("posts FormData to /api/files?year=2025 and maps the 201 body", async () => {
    const api = mockApi({
      "POST /api/files": () => Response.json({ fileId: "f1", mediaType: "application/pdf", name: "r.pdf" }, { status: 201 }),
    });
    const { result, go } = run(pdf());
    await go();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ fileId: "f1", name: "r.pdf", mediaType: "application/pdf" });
    const [url, init] = api.fetch.mock.calls[0]!;
    expect(url).toBe("/api/files?year=2025");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(init?.headers).toBeUndefined();
  });
  it("rejects oversize files without fetching", async () => {
    const api = mockApi({});
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "b.pdf", { type: "application/pdf" });
    const { result, go } = run(big);
    await go();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "file_too_large", status: 0 });
    expect(api.fetch).not.toHaveBeenCalled();
  });
  it("rejects wrong types without fetching", async () => {
    const api = mockApi({});
    const { result, go } = run(new File(["x"], "a.gif", { type: "image/gif" }));
    await go();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "file_type", status: 0 });
    expect(api.fetch).not.toHaveBeenCalled();
  });
  it.each([[400, "unsupported_year"], [413, "too_large"], [415, "unsupported_type"]])("surfaces server %i %s", async (status, code) => {
    mockApi({ "POST /api/files": () => Response.json({ code }, { status }) });
    const { result, go } = run(pdf());
    await go();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code, status });
  });
});
