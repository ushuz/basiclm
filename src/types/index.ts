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

export interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  logit_bias?: Record<string, number>
  user?: string
  tools?: OpenAITool[]
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "function" | "tool"
  content: string | OpenAIMessageContent[] | null
  name?: string
  function_call?: {
    name: string
    arguments: string
  }
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

export interface OpenAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAIMessageContent {
  type: "text" | "image_url"
  text?: string
  image_url?: {
    url: string
    detail?: "low" | "high" | "auto"
  }
}

export interface OpenAIChatCompletionResponse {
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: OpenAIChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIChoice {
  index: number
  message: OpenAIMessage
  finish_reason: "stop" | "length" | "function_call" | "tool_calls" | "content_filter" | null
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
  error: {
    message: string
    type: string
    param?: string
    code?: string
  }
}

export interface OpenAIErrorResponse {
  error: {
    message: string
    type: string
    param?: string | null
    code?: string | null
  }
}

export interface AnthropicErrorResponse {
  type: "error"
  error: {
    type: string
    message: string
  }
}

export interface UnifiedErrorResponse {
  type: "error"
  error: {
    message: string
    type: string
    param?: string | null
    code?: string | null
  }
}

export interface OpenAITool {
  type: "function"
  function: {
    name: string
    description: string
    parameters?: object
  }
}

export interface AnthropicTool {
  name: string
  description: string
  input_schema?: object
}
