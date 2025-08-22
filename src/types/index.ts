export interface ServerConfig {
  port: number
  host: string
  autoStart: boolean
  enableLogging: boolean
}

export interface ServerState {
  isRunning: boolean
  port?: number
  host?: string
  startTime?: Date
  requestCount: number
  errorCount: number
}


export interface AnthropicMessageRequest {
  model: string
  max_tokens: number
  messages: AnthropicMessage[]
  temperature?: number
  top_p?: number
  top_k?: number
  stream?: boolean
  stop_sequences?: string[]
  system?: string
  tools?: AnthropicTool[]
}

export interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | AnthropicContent[]
}

export interface AnthropicContent {
  type: "text" | "image" | "tool_use" | "tool_result"
  text?: string
  source?: {
    type: "base64"
    media_type: string
    data: string
  }
  id?: string
  name?: string
  input?: any
  content?: string | AnthropicContent[]
  tool_use_id?: string
  is_error?: boolean
}

export interface AnthropicMessageResponse {
  id: string
  type: "message"
  role: "assistant"
  content: AnthropicContent[]
  model: string
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null
  stop_sequence?: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ErrorResponse {
  type?: "error"
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
  request_id?: string
}


export interface AnthropicTool {
  name: string
  description: string
  input_schema?: object
}
