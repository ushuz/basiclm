import * as http from "http"
import * as vscode from "vscode"
import { URL } from "url"
import { Logger } from "../utils/Logger"
import { RequestHandler } from "./RequestHandler"
import { ServerConfig, ServerState, APIEndpointType, OpenAIErrorResponse, AnthropicErrorResponse } from "../types"
import { DEFAULT_CONFIG, API_ENDPOINTS, HTTP_STATUS, CORS_HEADERS } from "../constants"

export class LMAPIServer {
  private server?: http.Server
  private requestHandler: RequestHandler
  private config: ServerConfig
  private state: ServerState

  constructor() {
    this.requestHandler = new RequestHandler()
    this.config = this.loadConfig()
    this.state = {
      isRunning: false,
      requestCount: 0,
      errorCount: 0,
    }

    // listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged.bind(this))
  }

  public async start(port?: number): Promise<void> {
    if (this.state.isRunning) {
      throw new Error("BasicLM is already running")
    }

    const serverPort = port || this.config.port
    const serverHost = this.config.host

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(this.handleRequest.bind(this))

        // configure server settings
        this.server.keepAliveTimeout = 65000
        this.server.headersTimeout = 66000
        this.server.requestTimeout = 120000

        this.server.listen(serverPort, serverHost, () => {
          this.state.isRunning = true
          this.state.port = serverPort
          this.state.host = serverHost
          this.state.startTime = new Date()

          Logger.info("BasicLM started", {
            host: serverHost,
            port: serverPort,
            endpoints: {
              openai: `http://${serverHost}:${serverPort}${API_ENDPOINTS.OPENAI_CHAT_COMPLETIONS}`,
              anthropic: `http://${serverHost}:${serverPort}${API_ENDPOINTS.ANTHROPIC_MESSAGES}`,
            },
          })

          resolve()
        })

        this.server.on("error", (error: NodeJS.ErrnoException) => {
          this.state.isRunning = false

          if (error.code === "EADDRINUSE") {
            const message = `port ${serverPort} is already in use`
            Logger.error(message, error)
            reject(new Error(message))
          } else {
            Logger.error("BasicLM startup error", error)
            reject(error)
          }
        })

      } catch (error) {
        Logger.error("failed to create server", error as Error)
        reject(error)
      }
    })
  }

  public async stop(): Promise<void> {
    if (!this.state.isRunning || !this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.state.isRunning = false
        this.state.port = undefined
        this.state.host = undefined
        this.state.startTime = undefined

        Logger.info("BasicLM stopped")
        resolve()
      })

      // force close after timeout
      setTimeout(() => {
        this.server?.closeAllConnections?.()
        resolve()
      }, 5000)
    })
  }

  public async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  public isRunning(): boolean {
    return this.state.isRunning
  }

  public getState(): ServerState {
    return { ...this.state }
  }

  public getConfig(): ServerConfig {
    return { ...this.config }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now()
    const requestId = this.generateRequestId()

    try {
      this.state.requestCount++

      const hostHeader = req.headers.host || `${this.config.host}:${this.config.port}`
      const url = new URL(req.url || "/", `http://${hostHeader}`)
      const method = req.method || "GET"

      Logger.debug(`request: ${method} ${url.pathname}`, { requestId })

      // add cors headers
      this.addCORSHeaders(res)

      // handle preflight requests
      if (method === "OPTIONS") {
        res.writeHead(HTTP_STATUS.OK)
        res.end()
        return
      }

      // route request
      await this.routeRequest(url.pathname, method, req, res, requestId)

    } catch (error) {
      this.state.errorCount++
      Logger.error("request handling error", error as Error, { requestId })

      if (!res.headersSent) {
        this.sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "internal server error", requestId, APIEndpointType.OPENAI)
      }
    } finally {
      const duration = Date.now() - startTime
      Logger.debug(`response: ${res.statusCode || 500}`, { requestId, duration: `${duration}ms` })
    }
  }

  private async routeRequest(
    pathname: string,
    method: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string
  ): Promise<void> {
    switch (pathname) {
      case API_ENDPOINTS.OPENAI_CHAT_COMPLETIONS:
        await this.requestHandler.handleOpenAIChatCompletions(req, res, requestId)
        break

      case API_ENDPOINTS.ANTHROPIC_MESSAGES:
        await this.requestHandler.handleAnthropicMessages(req, res, requestId)
        break

      case API_ENDPOINTS.MODELS:
        await this.requestHandler.handleModels(req, res, requestId)
        break

      case API_ENDPOINTS.HEALTH:
        await this.requestHandler.handleHealth(req, res, requestId, this.state)
        break

      default:
        // Determine API type from pathname for proper error format
        const apiType = pathname.includes("/messages") ? APIEndpointType.ANTHROPIC : APIEndpointType.OPENAI
        this.sendError(res, HTTP_STATUS.NOT_FOUND, "endpoint not found", requestId, apiType)
    }
  }

  private addCORSHeaders(res: http.ServerResponse): void {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value)
    })
  }

  private sendError(
    res: http.ServerResponse, 
    statusCode: number, 
    message: string, 
    requestId?: string, 
    apiType: APIEndpointType = APIEndpointType.OPENAI
  ): void {
    if (res.headersSent) {
      return
    }

    let errorResponse: OpenAIErrorResponse | AnthropicErrorResponse

    if (apiType === APIEndpointType.ANTHROPIC) {
      errorResponse = {
        type: "error",
        error: {
          type: "api_error",
          message,
        },
      } as AnthropicErrorResponse
    } else {
      // Default to OpenAI format
      errorResponse = {
        error: {
          message,
          type: "api_error",
          param: null,
          code: null,
        },
      } as OpenAIErrorResponse
    }

    res.writeHead(statusCode, { "Content-Type": "application/json" })
    res.end(JSON.stringify(errorResponse, null, 2))
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private loadConfig(): ServerConfig {
    const config = vscode.workspace.getConfiguration("basiclmapi")

    return {
      port: config.get<number>("port", DEFAULT_CONFIG.port),
      host: config.get<string>("host", DEFAULT_CONFIG.host),
      autoStart: config.get<boolean>("autoStart", DEFAULT_CONFIG.autoStart),
      enableLogging: config.get<boolean>("enableLogging", DEFAULT_CONFIG.enableLogging),
    }
  }

  private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    if (event.affectsConfiguration("basiclmapi")) {
      const newConfig = this.loadConfig()
      const oldConfig = this.config

      this.config = newConfig

      Logger.info("configuration changed", {
        old: oldConfig,
        new: newConfig,
      })

      // restart server if critical settings changed
      if (this.state.isRunning &&
                (oldConfig.port !== newConfig.port || oldConfig.host !== newConfig.host)) {

        vscode.window.showInformationMessage(
          "Server configuration changed. Restart required.",
          "Restart Now"
        ).then(selection => {
          if (selection === "Restart Now") {
            this.restart().catch(error => {
              Logger.error("failed to restart server after config change", error)
            })
          }
        })
      }
    }
  }

  public dispose(): void {
    this.stop().catch(error => {
      Logger.error("error during server disposal", error)
    })

    this.requestHandler.dispose()
  }
}
