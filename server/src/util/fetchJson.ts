export interface FetchJsonOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** GET JSON with a hard timeout. Throws on non-2xx or network/timeout error. */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', ...opts.headers },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
