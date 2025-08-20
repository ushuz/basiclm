export const DEFAULT_CONFIG = {
  port: 8099,
  host: "127.0.0.1",
  autoStart: false,
  enableLogging: true
}

export const API_ENDPOINTS = {
  OPENAI_CHAT_COMPLETIONS: "/v1/chat/completions",
  ANTHROPIC_MESSAGES: "/v1/messages",
  MODELS: "/v1/models",
  HEALTH: "/health"
} as const

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const

export const CONTENT_TYPES = {
  JSON: "application/json",
  TEXT: "text/plain",
  SSE: "text/event-stream"
} as const

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400"
} as const

export const SSE_HEADERS = {
  "Content-Type": CONTENT_TYPES.SSE,
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  ...CORS_HEADERS
} as const

export const ERROR_CODES = {
  INVALID_REQUEST: "invalid_request_error",
  PERMISSION_ERROR: "permission_error",
  NOT_FOUND_ERROR: "not_found_error",
  API_ERROR: "api_error"
} as const
