import { vi } from "vitest";

type Handler = (req: { url: string; body: unknown }) => Response | object | Promise<Response | object>;

/** Stubs global fetch with `"METHOD /path"` handlers. Objects become JSON 200 responses. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
    const body = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body });
    const handler = routes[key];
    if (!handler) return Response.json({ error: `unmocked ${key}` }, { status: 500 });
    const out = await handler({ url, body });
    return out instanceof Response ? out : Response.json(out);
  });
  vi.stubGlobal("fetch", fn);
  return { fetch: fn, calls };
}

/** An AI SDK UI-message stream: one `data: {json}` event per chunk, then `data: [DONE]`. */
export function sseChunks(chunks: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}
