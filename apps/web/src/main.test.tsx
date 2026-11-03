import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockApi } from "./test/network";

describe("main", () => {
  afterEach(() => document.getElementById("root")?.remove());

  it("mounts the providers and the chat page into #root", async () => {
    mockApi({ "GET /api/health": () => ({ ok: true, country: "de", years: [2025, 2026] }) });
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    await act(async () => {
      await import("./main");
    });

    expect(await screen.findByRole("combobox", { name: "Tax year" })).toHaveValue("2025");
    expect(screen.getByRole("heading", { level: 1, name: "Tax Refund Agent" })).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
  });
});
