export interface TabEventPayload {
  source: string;
  target?: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function publishTabEvent(event: TabEventPayload): Promise<ApiResult> {
  try {
    const response = await fetch('/api/tabs/events', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(event),
    });
    const data = await response.json();
    return response.ok ? { ok: true, data } : { ok: false, error: data?.error || response.statusText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown tab bus error' };
  }
}

export async function getApiSpec(): Promise<ApiResult> {
  try {
    const response = await fetch('/api/openapi.json');
    const data = await response.json();
    return response.ok ? { ok: true, data } : { ok: false, error: data?.error || response.statusText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to load API spec' };
  }
}
