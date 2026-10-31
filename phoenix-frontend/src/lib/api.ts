import { getCached, setCached, clearCache } from "./cache";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export const TOKEN_KEY = "phoenix.token";

// The token lives only in the browser. Never touch localStorage during SSR.
let token: string | null = null;
if (typeof window !== "undefined") {
  token = window.localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null) {
  token = value;
  if (typeof window !== "undefined") {
    if (value) window.localStorage.setItem(TOKEN_KEY, value);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  // Per lib/cache.ts contract: cache keys include the auth token so one
  // user's cached data can never be served to another.
  const cacheKey = `${token ?? "anon"}::${path}`;
  if (method === "GET" && opts.cache) {
    const hit = getCached<T>(cacheKey);
    if (hit !== undefined) return hit;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  const data = (await res.json()) as T;
  if (method === "GET" && opts.cache) setCached(cacheKey, data);
  else clearCache(); // after any write, the whole cache is stale
  return data;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 402) return "Not enough credits. Ask the workspace owner to top up.";
    if (err.status === 403) return "You don't have permission to do that.";
    if (err.status === 404) return "Not found (or you don't have access).";
    if (err.status >= 500) return "Server error. Please try again.";
    return err.message;
  }
  return "Unexpected error.";
}
