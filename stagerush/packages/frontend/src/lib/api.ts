const BASE_URL = '/api/v1';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ---------------------------------------------------------------------------
  // Token Management
  // ---------------------------------------------------------------------------

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('stagerush_access_token');
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('stagerush_refresh_token');
  }

  setTokens(tokens: TokenPair): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('stagerush_access_token', tokens.accessToken);
    localStorage.setItem('stagerush_refresh_token', tokens.refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('stagerush_access_token');
    localStorage.removeItem('stagerush_refresh_token');
  }

  // ---------------------------------------------------------------------------
  // Headers
  // ---------------------------------------------------------------------------

  private getHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // ---------------------------------------------------------------------------
  // Token Refresh
  // ---------------------------------------------------------------------------

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  private async handleTokenRefresh(): Promise<boolean> {
    // Deduplicate concurrent refresh attempts
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  // ---------------------------------------------------------------------------
  // Core Request Method
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
    retry = true,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.getHeaders(customHeaders);

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    // Handle 401 — attempt token refresh and retry once
    if (response.status === 401 && retry) {
      const refreshed = await this.handleTokenRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, customHeaders, false);
      }
      // Refresh failed — clear tokens and redirect to login
      this.clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        message: response.statusText,
        statusCode: response.status,
      }));
      throw new ApiRequestError(
        errorData.message || 'An unexpected error occurred',
        response.status,
        errorData,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Public HTTP Methods
  // ---------------------------------------------------------------------------

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, headers);
  }

  async post<T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('POST', path, body, headers);
  }

  async put<T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('PUT', path, body, headers);
  }

  async delete<T>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, headers);
  }
}

export class ApiRequestError extends Error {
  public statusCode: number;
  public data: ApiError;

  constructor(message: string, statusCode: number, data: ApiError) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// Singleton instance
export const api = new ApiClient();

export default api;
