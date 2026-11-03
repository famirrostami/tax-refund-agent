import type { ErrorBodyDto } from "../dto";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/** Fetches `/api${path}` and returns the raw response; a non-2xx answer throws `ApiError` with the server's `code`. */
export async function apiResponse(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBodyDto | null;
    throw new ApiError(typeof body?.code === "string" ? body.code : "unknown", res.status);
  }
  return res;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await apiResponse(path, init)).json()) as T;
}
