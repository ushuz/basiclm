import * as http from "http"
import * as vscode from "vscode"
import { Logger } from "../utils/Logger"
import {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  AnthropicMessageRequest,
  AnthropicMessageResponse,
  ServerState,
  ErrorResponse,
  OpenAITool,
  AnthropicTool
} from "../types"
import { HTTP_STATUS, CONTENT_TYPES, SSE_HEADERS, ERROR_CODES } from "../constants"

export class RequestHandler {

  constructor() {}

  public async handleOpenAIChatCompletions(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string
  ): Promise<void> {
    try {
      if (req.method !== "POST") {
        this.sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, "method not allowed", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      Logger.debug("processing openai chat completions request", { requestId })

      const body = await this.readRequestBody(req)
      const request: OpenAIChatCompletionRequest = JSON.parse(body)

      // validate request
      if (!request.model || !request.messages || !Array.isArray(request.messages)) {
        this.sendError(res, HTTP_STATUS.BAD_REQUEST, "invalid request: model and messages are required", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      // check vs code language model access
      const models = await vscode.lm.selectChatModels()
      if (models.length === 0) {
        this.sendError(res, HTTP_STATUS.SERVICE_UNAVAILABLE, "no language models available", ERROR_CODES.API_ERROR, requestId)
        return
      }

      // select model based on request
      const model = this.selectModel(models, request.model)
      if (!model) {
        this.sendError(res, HTTP_STATUS.BAD_REQUEST, `model "${request.model}" not available`, ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }
      Logger.debug("selected vs code model", { modelId: model.id, family: model.family, requestedModel: request.model, requestId })

      // convert openai messages to vs code format
      const vsCodeMessages = this.convertOpenAIMessagesToVSCode(request.messages)
      Logger.debug("converted OpenAI messages", { messageCount: vsCodeMessages.length, messages: vsCodeMessages, requestId })

      // convert tools to vs code format
      const vsCodeTools = this.convertOpenAIToolsToVSCode(request.tools)
      Logger.debug("converted OpenAI tools", { toolCount: vsCodeTools.length, tools: vsCodeTools, requestId })

      // make request to vs code language model api
      const options = { tools: vsCodeTools }
      const token = new vscode.CancellationTokenSource().token

      try {
        const response = await model.sendRequest(vsCodeMessages, options, token)

        if (request.stream) {
          await this.handleOpenAIStreamingResponse(response, res, request, model, requestId)
        } else {
          await this.handleOpenAINonStreamingResponse(response, res, request, model, requestId)
        }

      } catch (lmError) {
        Logger.error("VS Code LM API error", lmError as Error, { requestId })

        if (lmError instanceof vscode.LanguageModelError) {
          this.handleLanguageModelError(lmError, res, requestId)
        } else {
          this.sendError(res, HTTP_STATUS.BAD_GATEWAY, `Language model request failed: ${lmError}`, ERROR_CODES.API_ERROR, requestId)
        }
      }

    } catch (error) {
      Logger.error("error handling OpenAI chat completions", error as Error, { requestId })

      if (!res.headersSent) {
        this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "request processing failed", ERROR_CODES.API_ERROR, requestId)
      }
    }
  }

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

      // check vs code language model access
      const models = await vscode.lm.selectChatModels()
      if (models.length === 0) {
        this.sendError(res, HTTP_STATUS.SERVICE_UNAVAILABLE, "no language models available", ERROR_CODES.API_ERROR, requestId)
        return
      }

      // select model based on request
      const model = this.selectModel(models, request.model)
      if (!model) {
        this.sendError(res, HTTP_STATUS.BAD_REQUEST, `model "${request.model}" not available`, ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }
      Logger.debug("selected vs code model", { modelId: model.id, family: model.family, requestedModel: request.model, requestId })

      // convert anthropic messages to vs code format
      const vsCodeMessages = this.convertAnthropicMessagesToVSCode(request.messages, request.system)
      Logger.debug("converted Anthropic messages", { messageCount: vsCodeMessages.length, messages: vsCodeMessages, requestId })

      // convert tools to vs code format
      const vsCodeTools = this.convertAnthropicToolsToVSCode(request.tools)
      Logger.debug("converted Anthropic tools", { toolCount: vsCodeTools.length, tools: vsCodeTools, requestId })

      // make request to vs code language model api
      const options = { tools: vsCodeTools }
      const token = new vscode.CancellationTokenSource().token

      try {
        const response = await model.sendRequest(vsCodeMessages, options, token)

        if (request.stream) {
          await this.handleAnthropicStreamingResponse(response, res, request, model, requestId)
        } else {
          await this.handleAnthropicNonStreamingResponse(response, res, request, model, requestId)
        }

      } catch (lmError) {
        Logger.error("VS Code LM API error", lmError as Error, { requestId })

        if (lmError instanceof vscode.LanguageModelError) {
          this.handleLanguageModelError(lmError, res, requestId)
        } else {
          this.sendError(res, HTTP_STATUS.BAD_GATEWAY, `Language model request failed: ${lmError}`, ERROR_CODES.API_ERROR, requestId)
        }
      }

    } catch (error) {
      Logger.error("error handling Anthropic messages", error as Error, { requestId })

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

      const modelsResponse = {
        object: "list",
        data: models.map(model => ({
          id: model.id,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: model.vendor || "unknown",
          permission: [],
          root: model.id,
          parent: null
        }))
      }

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(modelsResponse, null, 2))

      Logger.debug("models response sent", { modelCount: models.length, requestId })

    } catch (error) {
      Logger.error("error handling models request", error as Error, { requestId })
      this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "failed to retrieve models", ERROR_CODES.API_ERROR, requestId)
    }
  }

  public async handleHealth(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string,
    serverState: ServerState
  ): Promise<void> {
    try {
      if (req.method !== "GET") {
        this.sendError(res, HTTP_STATUS.METHOD_NOT_ALLOWED, "method not allowed", ERROR_CODES.INVALID_REQUEST, requestId)
        return
      }

      const models = await vscode.lm.selectChatModels()

      const healthResponse = {
        status: "healthy",
        server: {
          running: serverState.isRunning,
          uptime: serverState.startTime ? Date.now() - serverState.startTime.getTime() : 0,
          requests: serverState.requestCount,
          errors: serverState.errorCount
        },
        languageModels: {
          available: models.length,
          accessible: models.length > 0
        },
        endpoints: {
          openai: "/v1/chat/completions",
          anthropic: "/v1/messages"
        },
        timestamp: new Date().toISOString()
      }

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(healthResponse, null, 2))

    } catch (error) {
      Logger.error("error handling health check", error as Error, { requestId })
      this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "health check failed", ERROR_CODES.API_ERROR, requestId)
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

  private convertOpenAIMessagesToVSCode(messages: any[]): vscode.LanguageModelChatMessage[] {
    return messages.map(msg => {
      const role = msg.role === "system" ? vscode.LanguageModelChatMessageRole.User :
        msg.role === "user" ? vscode.LanguageModelChatMessageRole.User :
          vscode.LanguageModelChatMessageRole.Assistant

      let content = ""
      if (typeof msg.content === "string") {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        // handle multimodal content - extract text for now
        content = msg.content
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("\n")
      }

      // for system messages, prepend a system indicator
      if (msg.role === "system") {
        content = `[SYSTEM] ${content}`
      }

      return vscode.LanguageModelChatMessage.User(content)
    })
  }

  private convertAnthropicMessagesToVSCode(messages: any[], system?: string): vscode.LanguageModelChatMessage[] {
    const vsCodeMessages: vscode.LanguageModelChatMessage[] = []

    // add system message if provided
    if (system) {
      vsCodeMessages.push(vscode.LanguageModelChatMessage.User(`[SYSTEM] ${system}`))
    }

    // convert messages
    messages.forEach(msg => {
      const role = msg.role === "user" ? vscode.LanguageModelChatMessageRole.User :
        vscode.LanguageModelChatMessageRole.Assistant

      let content = ""
      if (typeof msg.content === "string") {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        // handle multimodal content - extract text for now
        content = msg.content
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("\n")
      }

      if (role === vscode.LanguageModelChatMessageRole.User) {
        vsCodeMessages.push(vscode.LanguageModelChatMessage.User(content))
      } else {
        vsCodeMessages.push(vscode.LanguageModelChatMessage.Assistant(content))
      }
    })

    return vsCodeMessages
  }

  private convertOpenAIToolsToVSCode(tools?: OpenAITool[]): vscode.LanguageModelChatTool[] {
    if (!tools || !Array.isArray(tools)) {
      return []
    }

    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: tool.function.parameters
    }))
  }

  private convertAnthropicToolsToVSCode(tools?: AnthropicTool[]): vscode.LanguageModelChatTool[] {
    if (!tools || !Array.isArray(tools)) {
      return []
    }

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema
    }))
  }

  private async handleOpenAIStreamingResponse(
    response: vscode.LanguageModelChatResponse,
    res: http.ServerResponse,
    request: OpenAIChatCompletionRequest,
    model: vscode.LanguageModelChat,
    requestId: string
  ): Promise<void> {
    res.writeHead(HTTP_STATUS.OK, SSE_HEADERS)

    try {
      Logger.debug("starting OpenAI streaming response", { requestId })

      let content = ""
      let chunkIndex = 0

      for await (const chunk of response.text) {
        content += chunk

        const streamChunk = {
          id: `chatcmpl-${requestId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          choices: [{
            index: 0,
            delta: {
              role: chunkIndex === 0 ? "assistant" : undefined,
              content: chunk
            },
            finish_reason: null
          }]
        }

        res.write(`data: ${JSON.stringify(streamChunk)}\n\n`)
        chunkIndex++
      }

      // send final chunk
      const finalChunk = {
        id: `chatcmpl-${requestId}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop"
        }]
      }

      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`)
      res.write("data: [DONE]\n\n")

      Logger.debug("OpenAI streaming response completed", { requestId, contentLength: content.length })

    } catch (error) {
      Logger.error("OpenAI streaming error", error as Error, { requestId })
      const errorEvent = {
        error: {
          message: "stream processing error",
          type: ERROR_CODES.API_ERROR
        }
      }
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
    } finally {
      res.end()
    }
  }

  private async handleOpenAINonStreamingResponse(
    response: vscode.LanguageModelChatResponse,
    res: http.ServerResponse,
    request: OpenAIChatCompletionRequest,
    model: vscode.LanguageModelChat,
    requestId: string
  ): Promise<void> {
    try {
      Logger.debug("collecting OpenAI full response", { requestId })

      let content = ""
      for await (const chunk of response.text) {
        content += chunk
      }

      const completionResponse: OpenAIChatCompletionResponse = {
        id: `chatcmpl-${requestId}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: content
          },
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: this.estimateTokens(request.messages),
          completion_tokens: this.estimateTokens([{ role: "assistant", content: content }]),
          total_tokens: 0
        }
      }

      completionResponse.usage.total_tokens =
                completionResponse.usage.prompt_tokens + completionResponse.usage.completion_tokens

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(completionResponse, null, 2))

      Logger.debug("OpenAI response sent", {
        requestId,
        contentLength: content.length,
        totalTokens: completionResponse.usage.total_tokens
      })

    } catch (error) {
      Logger.error("error collecting OpenAI response", error as Error, { requestId })
      throw error
    }
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
      Logger.debug("starting Anthropic streaming response", { requestId })

      let content = ""
      let isFirst = true

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
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      }
      res.write(`data: ${JSON.stringify(messageStartEvent)}\n\n`)

      // send content_block_start event
      const contentBlockStartEvent = {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "text",
          text: ""
        }
      }
      res.write(`data: ${JSON.stringify(contentBlockStartEvent)}\n\n`)

      for await (const chunk of response.text) {
        content += chunk

        const contentBlockDeltaEvent = {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: chunk
          }
        }

        res.write(`data: ${JSON.stringify(contentBlockDeltaEvent)}\n\n`)
      }

      // send content_block_stop event
      const contentBlockStopEvent = {
        type: "content_block_stop",
        index: 0
      }
      res.write(`data: ${JSON.stringify(contentBlockStopEvent)}\n\n`)

      // send final message_stop event
      const messageStopEvent = {
        type: "message_stop"
      }
      res.write(`data: ${JSON.stringify(messageStopEvent)}\n\n`)

      Logger.debug("Anthropic streaming response completed", { requestId, contentLength: content.length })

    } catch (error) {
      Logger.error("Anthropic streaming error", error as Error, { requestId })
      const errorEvent = {
        type: "error",
        error: {
          message: "stream processing error",
          type: ERROR_CODES.API_ERROR
        }
      }
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
    } finally {
      res.end()
    }
  }

  private async handleAnthropicNonStreamingResponse(
    response: vscode.LanguageModelChatResponse,
    res: http.ServerResponse,
    request: AnthropicMessageRequest,
    model: vscode.LanguageModelChat,
    requestId: string
  ): Promise<void> {
    try {
      Logger.debug("collecting Anthropic full response", { requestId })

      let content = ""
      for await (const chunk of response.text) {
        content += chunk
      }

      const messageResponse: AnthropicMessageResponse = {
        id: `msg_${requestId}`,
        type: "message",
        role: "assistant",
        content: [{
          type: "text",
          text: content
        }],
        model: request.model,
        stop_reason: "end_turn",
        usage: {
          input_tokens: this.estimateTokens(request.messages),
          output_tokens: this.estimateTokens([{ role: "assistant", content: content }])
        }
      }

      res.writeHead(HTTP_STATUS.OK, { "Content-Type": CONTENT_TYPES.JSON })
      res.end(JSON.stringify(messageResponse, null, 2))

      Logger.debug("Anthropic response sent", {
        requestId,
        contentLength: content.length,
        inputTokens: messageResponse.usage.input_tokens,
        outputTokens: messageResponse.usage.output_tokens
      })

    } catch (error) {
      Logger.error("error collecting Anthropic response", error as Error, { requestId })
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
      error: {
        message,
        type,
        code: statusCode.toString()
      }
    }

    res.writeHead(statusCode, { "Content-Type": CONTENT_TYPES.JSON })
    res.end(JSON.stringify(errorResponse, null, 2))

    Logger.error(`error response: ${statusCode}`, new Error(message), { type, requestId })
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
