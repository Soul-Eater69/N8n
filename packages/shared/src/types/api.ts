export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: IApiError;
  meta?: IApiMeta;
}

export interface IApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface IApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface IWebhookPayload {
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  path: string;
}

export interface IWebSocketMessage {
  type: WebSocketEventType;
  payload: unknown;
  timestamp: number;
}

export type WebSocketEventType =
  | 'execution:started'
  | 'execution:progress'
  | 'execution:completed'
  | 'execution:error'
  | 'workflow:updated'
  | 'node:executing'
  | 'node:completed'
  | 'node:error';
