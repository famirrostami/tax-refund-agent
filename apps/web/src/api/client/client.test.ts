import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/network";
import { ApiError, apiFetch } from "./client";

describe("apiFetch", () => {
  it("returns parsed json", async () => {
    mockApi({ "GET /api/x": () => ({ a: 1 }) });
    expect(await apiFetch<{ a: number }>("/x")).toEqual({ a: 1 });
  });
  it("throws ApiError with the server code", async () => {
    mockApi({ "GET /api/x": () => Response.json({ code: "unsupported_year" }, { status: 400 }) });
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "unsupported_year", status: 400 });
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
  });
  it("falls back to code unknown for non-json bodies", async () => {
    mockApi({ "GET /api/x": () => new Response("boom", { status: 502 }) });
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "unknown", status: 502 });
  });
});
