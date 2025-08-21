import * as http from "http"
import { ErrorResponse } from "../types"
import { CONTENT_TYPES } from "../constants"
import { Logger } from "./Logger"

/**
 * Unified error response utility for both OpenAI and Anthropic API compatibility
 */
export class UnifiedErrorResponse {
  /**
   * Send a unified error response compatible with both OpenAI and Anthropic APIs
   */
  static sendError(
    res: http.ServerResponse,
    statusCode: number,
    message: string,
    type: string,
    requestId?: string,
    param?: string
  ): void {
    if (res.headersSent) {
      return
    }

    const errorResponse: ErrorResponse = {
      error: {
        message,
        type,
        code: statusCode.toString(),
        ...(param && { param }),
        ...(requestId && { requestId }),
      },
    }

    res.writeHead(statusCode, { "Content-Type": CONTENT_TYPES.JSON })
    res.end(JSON.stringify(errorResponse, null, 2))

    Logger.error(`error response: ${statusCode}`, new Error(message), { type, requestId, param })
  }
}