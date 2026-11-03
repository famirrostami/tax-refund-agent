import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi } from "../../test/network";
import { createWrapper } from "../../test/render";
import { useHealth } from "./health";

describe("useHealth", () => {
  it("returns country and years", async () => {
    mockApi({ "GET /api/health": () => ({ ok: true, country: "de", years: [2025, 2026] }) });
    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper().Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ country: "de", years: [2025, 2026] });
  });
  it("uses the health query key and surfaces ApiError", async () => {
    mockApi({ "GET /api/health": () => Response.json({ code: "down" }, { status: 503 }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useHealth(), { wrapper: createWrapper({ client }).Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: "down", status: 503 });
    expect(client.getQueryState(["health"])).toBeDefined();
  });
});
