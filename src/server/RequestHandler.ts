import * as http from "http"
import * as vscode from "vscode"
import { CONTENT_TYPES, ERROR_CODES, HTTP_STATUS, SSE_HEADERS } from "../constants"
import {
  AnthropicContentBlock,
  AnthropicMessageRequest,
  AnthropicMessageResponse,
  AnthropicTextBlockParam,
  AnthropicToolResultBlockParam,
  AnthropicToolUnion,
  AnthropicToolUseBlock,
  AnthropicToolUseBlockParam,
  ErrorResponse,
} from "../types"
import { Logger } from "../utils/Logger"

export class RequestHandler {

  constructor() {}

  public async handleAnthropicMessages(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== "POST") {
        this.sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, "method not allowed", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      Logger.debug("processing anthropic messages request", { requestId })

      const body = await this.readRequestBody(req)
      const request: AnthropicMessageRequest = JSON.parse(body)

      // validate request
      if (!request.model || !request.messages || !Array.isArray(request.messages) || !request.max_tokens) {
        this.sendError(res, HTTP_STATUS.BAD_REQUEST, "invalid request: model, messages, and max_tokens are required", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      // check vscode language model access
      const models = await vscode.lm.selectChatModels()
      if (models.length === 0) {
        this.sendError(res, HTTP_STATUS.SERVICE_UNAVAILABLE, "no language models available", ERROR_CODES.API_ERROR, requestId)
        return
      }

      // select model based on request
      const model = this.selectModel(models, request.model)
      if (!model) {
        this.sendError(res, HTTP_STATUS.NOT_FOUND, `model "${request.model}" not found`, ERROR_CODES.NOT_FOUND_ERROR, requestId)
        return
      }
      Logger.debug("selected model", { modelId: model.id, family: model.family, requestedModel: request.model, requestId })

      // convert anthropic messages to vscode format
      const vsCodeMessages = this.convertAnthropicMessagesToVSCode(request.messages, request.system)
      Logger.debug("converted anthropic messages", { messageCount: vsCodeMessages.length, requestId })

      // convert tools to vscode format
      const vsCodeTools = this.convertAnthropicToolsToVSCode(request.tools)
      Logger.debug("converted anthropic tools", { toolCount: vsCodeTools.length, requestId })

      // make request to vscode language model api
      const options = { tools: vsCodeTools }
      const token = new vscode.CancellationTokenSource().token

      try {
        const response = await model.sendRequest(vsCodeMessages, options, token)
        const handleAnthropicResponse = request.stream
          ? this.handleAnthropicStreamingResponse
          : this.handleAnthropicResponse
        await handleAnthropicResponse.apply(this, [response, res, request, model, requestId])
      } catch (lmError) {
        Logger.error("VS Code LM API error", lmError as Error, { requestId })

        if (lmError instanceof vscode.LanguageModelError) {
          this.handleLanguageModelError(lmError, res, requestId)
        } else {
          this.sendError(res, HTTP_STATUS.BAD_GATEWAY, `language model request failed: ${lmError}`, ERROR_CODES.API_ERROR, requestId)
        }
      }

    } catch (error) {
      Logger.error("error handling anthropic messages", error as Error, { requestId })

      if (!res.headersSent) {
        this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "request processing failed", ERROR_CODES.API_ERROR, requestId)
      }
    }
  }

  public async handleModels(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== "GET") {
        this.sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, "method not allowed", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      Logger.debug("processing models request", { requestId })

      const models = await vscode.lm.selectChatModels()

      const modelsData = models.map(model => ({
        created_at: new Date().toISOString(), // mocking the creation date
        display_name: model.name,
        id: model.id,
        type: "model",
      }))

      const modelsResponse = {
        data: modelsData,
        first_id: modelsData.length > 0 ? modelsData[0].id : null,
        has_more: false, // assuming a single page for now
        last_id: modelsData.length > 0 ? modelsData[modelsData.length - 1].id : null,
      }

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(modelsResponse, null, 2))

      Logger.debug("models response sent", { modelCount: models.length, requestId })

    } catch (error) {
      Logger.error("error handling models request", error as Error, { requestId })
      this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "failed to retrieve models", ERROR_CODES.API_ERROR, requestId)
    }
  }

  private selectModel(models: vscode.LanguageModelChat[], requestedModel: string): vscode.LanguageModelChat | null {
    // exact match by id
    let match = models.find(m => m.id === requestedModel)
    if (match) return match

    // try to match by family or partial id
    match = models.find(m => m.family && requestedModel.toLowerCase().includes(m.family.toLowerCase()))
    if (match) return match

    // no match found
    return null
  }

  private convertAnthropicMessagesToVSCode(messages: AnthropicMessageRequest["messages"], system?: AnthropicMessageRequest["system"]): vscode.LanguageModelChatMessage[] {
    const vsCodeMessages: vscode.LanguageModelChatMessage[] = []

    // FIXME: hack for system messages, since LM API does not yet support native system messages
    if (system) vsCodeMessages.push(vscode.LanguageModelChatMessage.User(`[SYSTEM] ${system}`))

    const convertToolResultContent = (content: any) => {
      if (typeof content === "string") {
        return [new vscode.LanguageModelTextPart(content)]
      }
      if (Array.isArray(content)) {
        const textParts = []
        for (const c of content) {
          textParts.push(new vscode.LanguageModelTextPart(c.text || ""))
        }
        return textParts
      }
      return [new vscode.LanguageModelTextPart("")]
    }

    const partHandlers = {
      text: (part: AnthropicTextBlockParam) => new vscode.LanguageModelTextPart(part.text),
      tool_result: (part: AnthropicToolResultBlockParam) => new vscode.LanguageModelToolResultPart(
        part.tool_use_id,
        convertToolResultContent(part.content)
      ),
      tool_use: (part: AnthropicToolUseBlockParam) => new vscode.LanguageModelToolCallPart(part.id, part.name, part.input as object),
    }

    const messageConstructors = {
      user: vscode.LanguageModelChatMessage.User,
      assistant: vscode.LanguageModelChatMessage.Assistant,
    }

    for (const msg of messages) {
      const constructor = messageConstructors[msg.role as keyof typeof messageConstructors]

      let content
      if (typeof msg.content === "string") {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        content = []
        for (const part of msg.content) {
          const handler = partHandlers[part.type as keyof typeof partHandlers]
          if (handler) {
            content.push(handler(part as any))
          }
        }
      }

      vsCodeMessages.push(constructor(content as any))
    }

    return vsCodeMessages
  }

  private convertAnthropicToolsToVSCode(tools?: AnthropicToolUnion[]): vscode.LanguageModelChatTool[] {
    if (!tools || !Array.isArray(tools)) {
      return []
    }

    return tools.map(tool => ({
      name: tool.name,
      description: (tool as any).description || tool.name || "no description available",
      inputSchema: (tool as any).input_schema,
    }))
  }

  private convertVSCodeToolCallsToAnthropic(toolCalls?: vscode.LanguageModelToolCallPart[]): AnthropicToolUseBlock[] {
    if (!toolCalls || !Array.isArray(toolCalls)) {
      return []
    }

    return toolCalls.map(call => ({
      type: "tool_use" as const,
      id: call.callId,
      name: call.name,
      input: call.input,
    }))
  }

  private async handleAnthropicStreamingResponse(
    response: vscode.LanguageModelChatResponse,
    res: http.ServerResponse,
    request: AnthropicMessageRequest,
    model: vscode.LanguageModelChat,
    requestId: string
  ): Promise<void> {
    res.writeHead(HTTP_STATUS.OK, SSE_HEADERS)

    try {
      Logger.debug("starting anthropic streaming response", { requestId })

      let content = ""
      let blockIndex = 0
      const toolCalls: vscode.LanguageModelToolCallPart[] = []

      // send initial message_start event
      const messageStartEvent = {
        type: "message_start",
        message: {
          id: `msg_${requestId}`,
          type: "message",
          role: "assistant",
          content: [],
          model: request.model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }
      res.write("event: message_start\n")
      res.write(`data: ${JSON.stringify(messageStartEvent)}\n\n`)

      // send content_block_start event for text
      const contentBlockStartEvent = {
        type: "content_block_start",
        index: blockIndex,
        content_block: {
          type: "text",
          text: "",
        },
      }
      res.write("event: content_block_start\n")
      res.write(`data: ${JSON.stringify(contentBlockStartEvent)}\n\n`)

      // process the response stream to get both text and tool calls
      for await (const part of response.stream) {
        // check if this is a text part
        if (part instanceof vscode.LanguageModelTextPart) {
          const textChunk = part.value
          content += textChunk

          const contentBlockDeltaEvent = {
            type: "content_block_delta",
            index: blockIndex,
            delta: {
              type: "text_delta",
              text: textChunk,
            },
          }

          res.write("event: content_block_delta\n")
          res.write(`data: ${JSON.stringify(contentBlockDeltaEvent)}\n\n`)
        }
        // check if this is a tool call part
        else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCalls.push(part)
        }
      }

      // send content_block_stop event for text
      const contentBlockStopEvent = {
        type: "content_block_stop",
        index: blockIndex,
      }
      res.write("event: content_block_stop\n")
      res.write(`data: ${JSON.stringify(contentBlockStopEvent)}\n\n`)
      blockIndex++

      // check for tool calls and add them as additional content blocks
      const anthropicToolCalls = this.convertVSCodeToolCallsToAnthropic(toolCalls)

      Logger.debug("tool calls", { anthropicToolCalls })

      for (const toolCall of anthropicToolCalls) {
        // send tool use content block start event
        const toolBlockStartEvent = {
          type: "content_block_start",
          index: blockIndex,
          content_block: {
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.name,
            input: {},
          },
        }
        res.write("event: content_block_start\n")
        res.write(`data: ${JSON.stringify(toolBlockStartEvent)}\n\n`)

        // send tool use content delta event
        const toolBlockDeltaEvent = {
          type: "content_block_delta",
          index: blockIndex,
          delta: {
            type: "input_json_delta",
            partial_json: JSON.stringify(toolCall.input),
          },
        }
        res.write("event: content_block_delta\n")
        res.write(`data: ${JSON.stringify(toolBlockDeltaEvent)}\n\n`)

        // send tool use content block stop event
        const toolBlockStopEvent = {
          type: "content_block_stop",
          index: blockIndex,
        }
        res.write("event: content_block_stop\n")
        res.write(`data: ${JSON.stringify(toolBlockStopEvent)}\n\n`)
        blockIndex++
      }

      // send message_delta event with stop_reason
      const stopReason = anthropicToolCalls.length > 0 ? "tool_use" : "end_turn"
      const messageDeltaEvent = {
        type: "message_delta",
        delta: {
          stop_reason: stopReason,
        },
        usage: {
          output_tokens: this.estimateTokens([{ role: "assistant", content: content }]),
        },
      }
      res.write("event: message_delta\n")
      res.write(`data: ${JSON.stringify(messageDeltaEvent)}\n\n`)

      // send final message_stop event
      const messageStopEvent = {
        type: "message_stop",
      }
      res.write("event: message_stop\n")
      res.write(`data: ${JSON.stringify(messageStopEvent)}\n\n`)

      Logger.debug("anthropic streaming response completed", {
        requestId,
        contentLength: content.length,
        toolCallsCount: anthropicToolCalls.length,
      })

    } catch (error) {
      Logger.error("anthropic streaming error", error as Error, { requestId })
      const errorEvent = {
        type: "error",
        error: {
          message: "stream processing error",
          type: ERROR_CODES.API_ERROR,
        },
      }
      res.write("event: error\n")
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
    } finally {
      res.end()
    }
  }

  private async handleAnthropicResponse(
    response: vscode.LanguageModelChatResponse,
    res: http.ServerResponse,
    request: AnthropicMessageRequest,
    model: vscode.LanguageModelChat,
    requestId: string
  ): Promise<void> {
    try {
      Logger.debug("collecting anthropic full response", { requestId })

      let content = ""
      const toolCalls: vscode.LanguageModelToolCallPart[] = []

      // process the response stream to get both text and tool calls
      for await (const part of response.stream) {
        // check if this is a text part
        if (part instanceof vscode.LanguageModelTextPart) {
          content += part.value
        }
        // check if this is a tool call part
        else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCalls.push(part)
        }
      }

      // convert tool calls to anthropic format
      const anthropicToolCalls = this.convertVSCodeToolCallsToAnthropic(toolCalls)

      const responseContent: AnthropicContentBlock[] = []

      // add text content if present
      if (content) {
        responseContent.push({
          type: "text",
          text: content,
          citations: null,
        })
      }

      // add tool use content if present
      responseContent.push(...anthropicToolCalls)

      let stopReason: string = "end_turn"
      if (anthropicToolCalls.length > 0) {
        stopReason = "tool_use"
      }

      const messageResponse: AnthropicMessageResponse = {
        id: `msg_${requestId}`,
        type: "message",
        role: "assistant",
        content: responseContent,
        model: request.model,
        stop_reason: stopReason as any,
        stop_sequence: null,
        usage: {
          input_tokens: this.estimateTokens(request.messages),
          output_tokens: this.estimateTokens([{ role: "assistant", content: content }]),
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(messageResponse, null, 2))

      Logger.debug("anthropic response sent", {
        requestId,
        contentLength: content.length,
        inputTokens: messageResponse.usage.input_tokens,
        outputTokens: messageResponse.usage.output_tokens,
        toolCallsCount: anthropicToolCalls.length,
      })

    } catch (error) {
      Logger.error("error collecting anthropic response", error as Error, { requestId })
      throw error
    }
  }

  private handleLanguageModelError(
    error: vscode.LanguageModelError,
    res: http.ServerResponse,
    requestId: string
  ): void {
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
    let errorCode: string = ERROR_CODES.API_ERROR
    let message = error.message

    switch (error.code) {
      case "NoPermissions":
        statusCode = HTTP_STATUS.FORBIDDEN
        errorCode = ERROR_CODES.PERMISSION_ERROR
        message = "permission denied for language model access"
        break
      case "Blocked":
        statusCode = HTTP_STATUS.FORBIDDEN
        errorCode = ERROR_CODES.PERMISSION_ERROR
        message = "request blocked by content filter"
        break
      case "NotFound":
        statusCode = HTTP_STATUS.NOT_FOUND
        errorCode = ERROR_CODES.NOT_FOUND_ERROR
        message = "language model not found"
        break
      case "ContextLengthExceeded":
        statusCode = HTTP_STATUS.BAD_REQUEST
        errorCode = ERROR_CODES.INVALID_REQUEST
        message = "request exceeds context length limit"
        break
      default:
        statusCode = HTTP_STATUS.BAD_GATEWAY
        errorCode = ERROR_CODES.API_ERROR
        message = `language model error: ${error.message}`
    }

    this.sendError(res, statusCode, message, errorCode, requestId)
  }

  private sendError(
    res: http.ServerResponse,
    statusCode: number,
    message: string,
    type: string,
    requestId: string
  ): void {
    if (res.headersSent) {
      return
    }

    const errorResponse: ErrorResponse = {
      type: "error",
      error: {
        message,
        type,
        code: statusCode.toString(),
      },
      request_id: requestId,
    }

    res.writeHead(statusCode, { "Content-Type": CONTENT_TYPES.JSON })
    res.end(JSON.stringify(errorResponse, null, 2))

    const log = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR ? Logger.error : Logger.warn
    log.apply(Logger, [`error response: ${statusCode}`, new Error(message), { type, requestId }])
  }

  private async readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ""

      req.on("data", chunk => {
        body += chunk

        // limit body size to 10mb
        if (body.length > 10 * 1024 * 1024) {
          reject(new Error("request body too large"))
          return
        }
      })

      req.on("end", () => resolve(body))
      req.on("error", reject)
    })
  }

  private estimateTokens(messages: any[]): number {
    // simple token estimation - roughly 4 characters per token
    const text = messages.map(msg =>
      typeof msg.content === "string" ? msg.content :
        Array.isArray(msg.content) ? msg.content.map((c: any) => c.text || "").join("") :
          ""
    ).join("")

    return Math.ceil(text.length / 4)
  }

  public dispose(): void {
    // cleanup any resources if needed
  }
}
