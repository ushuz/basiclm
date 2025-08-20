import * as vscode from "vscode"

class LoggerService {
  private outputChannel: vscode.OutputChannel

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("BasicLM")
  }

  private formatMessage(level: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ""
    return `[${timestamp}] ${level}: ${message}${contextStr}`
  }

  info(message: string, context?: any): void {
    const formatted = this.formatMessage("INFO", message, context)
    this.outputChannel.appendLine(formatted)
    console.log(formatted)
  }

  warn(message: string, context?: any): void {
    const formatted = this.formatMessage("WARN", message, context)
    this.outputChannel.appendLine(formatted)
    console.warn(formatted)
  }

  error(message: string, error?: Error, context?: any): void {
    const errorInfo = error ? ` | Error: ${error.message} | Stack: ${error.stack}` : ""
    const formatted = this.formatMessage("ERROR", message, context) + errorInfo
    this.outputChannel.appendLine(formatted)
    console.error(formatted)
  }

  debug(message: string, context?: any): void {
    const config = vscode.workspace.getConfiguration("basiclmapi")
    if (config.get<boolean>("enableLogging", true)) {
      const formatted = this.formatMessage("DEBUG", message, context)
      this.outputChannel.appendLine(formatted)
      console.debug(formatted)
    }
  }

  show(): void {
    this.outputChannel.show()
  }

  dispose(): void {
    this.outputChannel.dispose()
  }
}

export const Logger = new LoggerService()