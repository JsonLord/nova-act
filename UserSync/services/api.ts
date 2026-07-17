/** Shared API client: unwraps the backend envelope, surfaces warnings, and
 * injects BYOK LLM headers when the caller opts to pass keys per-request.
 * All backend responses are { data, artifact_id, provenance, quota, warnings,
 * next_actions } — callers usually want `data`, so `api()` returns the whole
 * envelope and helpers pull what they need. */

export interface Envelope<T = any> {
  data: T;
  artifact_id?: string;
  provenance?: Record<string, unknown>;
  quota?: Record<string, unknown>;
  warnings?: string[];
  next_actions?: { action: string; endpoint: string }[];
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Envelope<T>> {
  const response = await fetch(path, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON */
  }
  if (!response.ok) {
    throw new ApiError(payload?.detail || response.statusText, response.status);
  }
  return payload as Envelope<T>;
}

/** Convenience: return just `data`, throwing on error. */
export async function apiData<T = any>(path: string, options?: Parameters<typeof api>[1]): Promise<T> {
  return (await api<T>(path, options)).data;
}
