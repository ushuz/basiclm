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

// anthropic/openai combined error response
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

export type { MessageCreateParams as AnthropicMessageRequest } from "@anthropic-ai/sdk/resources/messages"

export type { TextBlockParam as AnthropicTextBlockParam } from "@anthropic-ai/sdk/resources/messages"

export type { ToolResultBlockParam as AnthropicToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages"

export type { ToolUseBlockParam as AnthropicToolUseBlockParam } from "@anthropic-ai/sdk/resources/messages"

export type { Message as AnthropicMessageResponse } from "@anthropic-ai/sdk/resources/messages"

export type { ContentBlock as AnthropicContentBlock } from "@anthropic-ai/sdk/resources/messages"

export type { ToolUseBlock as AnthropicToolUseBlock } from "@anthropic-ai/sdk/resources/messages"

export type { ToolUnion as AnthropicToolUnion } from "@anthropic-ai/sdk/resources/messages"
