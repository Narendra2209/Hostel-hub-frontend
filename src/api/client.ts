/**
 * The one HTTP client.
 *
 * Every screen in this application reads and writes through here, so there is
 * exactly one place that knows the base URL, attaches the session token,
 * unwraps the `{ success, data, meta }` envelope and turns a failure envelope
 * into a typed error a component can show.
 *
 * The browser never talks to MongoDB. React -> HTTPS -> Next.js -> Prisma.
 */
import axios, { AxiosError, type AxiosRequestConfig, type AxiosInstance } from 'axios';
import type { ApiFailure, ApiSuccess } from '@hostel/shared';
import { config } from '../config';
import { getToken } from '../auth/session';

/** A failure the UI can render: a stable code, a human message, field errors. */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(message: string, code: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isPermissionError(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 409/422 are business-rule refusals worth showing verbatim. */
  get isBusinessRule(): boolean {
    return this.status === 409 || this.status === 422;
  }
}

/** Called when the API rejects our token, so the shell can drop to /login. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

export const setUnauthorizedHandler = (handler: UnauthorizedHandler): void => {
  onUnauthorized = handler;
};

export const http: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  // Sends the HttpOnly session cookie when the API is same-site. Cross-origin
  // deployments fall back to the Bearer header; see auth/session.ts.
  withCredentials: true,
});

http.interceptors.request.use((request) => {
  const token = getToken();
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

function toClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiFailure>;

    if (axiosError.code === 'ECONNABORTED') {
      return new ApiClientError('That took too long. Please try again.', 'TIMEOUT', 0);
    }

    if (!axiosError.response) {
      return new ApiClientError(
        'Could not reach the server. Check your connection and try again.',
        'NETWORK_ERROR',
        0,
      );
    }

    const { status, data } = axiosError.response;
    if (status === 401) onUnauthorized();

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return new ApiClientError(data.error.message, data.error.code, status, data.error.details);
    }

    return new ApiClientError(
      status >= 500
        ? 'Something went wrong on the server. Please try again.'
        : 'That request could not be completed.',
      'UNEXPECTED_ERROR',
      status,
    );
  }

  return new ApiClientError(
    error instanceof Error ? error.message : 'Something went wrong.',
    'UNEXPECTED_ERROR',
    0,
  );
}

/** Result of a list endpoint: the rows plus whatever meta the server sent. */
export interface Paged<TItem, TMeta> {
  items: TItem[];
  meta: TMeta;
}

async function request<TData, TMeta = undefined>(
  options: AxiosRequestConfig,
): Promise<{ data: TData; meta: TMeta }> {
  try {
    const response = await http.request<ApiSuccess<TData, TMeta>>(options);
    // 204 has no body.
    if (response.status === 204 || response.data === undefined || response.data === null) {
      return { data: undefined as TData, meta: undefined as TMeta };
    }
    return { data: response.data.data, meta: response.data.meta as TMeta };
  } catch (error) {
    throw toClientError(error);
  }
}

/** Drops undefined/empty params so the query string stays clean and cache keys stable. */
export function toParams(input: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    params[key] = Array.isArray(value) ? value.join(',') : String(value);
  }
  return params;
}

export async function apiGet<TData>(
  url: string,
  params?: Record<string, unknown>,
): Promise<TData> {
  const { data } = await request<TData>({
    method: 'GET',
    url,
    params: params ? toParams(params) : undefined,
  });
  return data;
}

export async function apiGetPaged<TItem, TMeta>(
  url: string,
  params?: Record<string, unknown>,
): Promise<Paged<TItem, TMeta>> {
  const { data, meta } = await request<TItem[], TMeta>({
    method: 'GET',
    url,
    params: params ? toParams(params) : undefined,
  });
  return { items: data ?? [], meta };
}

export async function apiPost<TData, TBody = unknown>(url: string, body?: TBody): Promise<TData> {
  const { data } = await request<TData>({ method: 'POST', url, data: body });
  return data;
}

export async function apiPatch<TData, TBody = unknown>(url: string, body?: TBody): Promise<TData> {
  const { data } = await request<TData>({ method: 'PATCH', url, data: body });
  return data;
}

export async function apiDelete<TData = void>(url: string): Promise<TData> {
  const { data } = await request<TData>({ method: 'DELETE', url });
  return data;
}

/** Download an export as a Blob so the browser can save it. */
export async function apiDownload(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ blob: Blob; fileName: string }> {
  try {
    const response = await http.request<Blob>({
      method: 'GET',
      url,
      params: params ? toParams(params) : undefined,
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'];
    const match = typeof disposition === 'string' ? /filename="?([^"]+)"?/.exec(disposition) : null;
    return { blob: response.data, fileName: match?.[1] ?? 'download.csv' };
  } catch (error) {
    throw toClientError(error);
  }
}

/**
 * Upload a file to the API as multipart form data.
 *
 * Documents now live in MongoDB GridFS rather than S3, so there is no presign
 * step: the bytes go to our own authenticated endpoint, which validates the
 * type and size before storing anything.
 */
export async function uploadFile<TData>(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<TData> {
  const form = new FormData();
  form.append('file', file);
  try {
    const response = await http.request<ApiSuccess<TData>>({
      method: 'POST',
      url,
      data: form,
      // Let the browser set the multipart boundary itself.
      headers: { 'Content-Type': undefined },
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return response.data.data;
  } catch (error) {
    throw toClientError(error);
  }
}

/**
 * Fetch a private document as a blob and return an object URL.
 *
 * An `<img src>` cannot carry an Authorization header, and the session cookie
 * is not sent cross-origin, so the bytes are fetched through the normal client
 * (which does attach the token) and handed to the DOM as a blob URL instead.
 * The caller MUST revoke the URL when the component unmounts.
 */
export async function fetchDocumentObjectUrl(
  url: string,
): Promise<{ url: string; contentType: string }> {
  try {
    const response = await http.request<Blob>({ method: 'GET', url, responseType: 'blob' });
    return {
      url: URL.createObjectURL(response.data),
      // The blob carries the Content-Type the API sent, which is what tells the
      // profile whether to render an <img> or a link to a PDF.
      contentType: response.data.type || 'application/octet-stream',
    };
  } catch (error) {
    throw toClientError(error);
  }
}
