import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { getAccessToken } from '@/lib/auth-session';

let configured = false;

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  authenticated?: boolean;
  body?: unknown;
};

/** Configure generated API requests once for the current Expo bundle. */
export function configureApi(): void {
  if (configured) return;

  setBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? null);
  setAuthTokenGetter(getAccessToken);
  configured = true;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  configureApi();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL before making an API request.');

  const { authenticated = false, body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  if (body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (authenticated) {
    const token = await getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message = payload?.message;
    throw new ApiRequestError(
      Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : `Request failed (${response.status}).`,
      response.status,
    );
  }

  return data as T;
}

/** Lightweight connectivity probe used during app startup and diagnostics. */
export async function checkApiHealth(): Promise<boolean> {
  const health = await apiRequest<{ services?: { api?: string } }>('/api/v1/health');
  return health.services?.api === 'up';
}