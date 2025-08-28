import * as http from "http"
import { ServerConfig } from "../types"
import { API_ENDPOINTS } from "../constants"

/**
 * Check if a BasicLM server is already running on the specified host and port
 */
export async function isServerRunning(config: ServerConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: API_ENDPOINTS.MODELS,
      method: "GET",
      timeout: 2000, // 2 second timeout
    }

    const req = http.request(options, (res) => {
      // If we get any response, server is running
      resolve(true)
    })

    req.on("error", () => {
      // If connection fails, server is not running
      resolve(false)
    })

    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

/**
 * Get server state key for global state storage
 */
export function getServerStateKey(config: ServerConfig): string {
  return `basiclm.serverState.${config.host}:${config.port}`
}

/**
 * Global server state interface
 */
export interface GlobalServerState {
  isRunning: boolean
  port?: number
  host?: string
  startTime?: string
  requestCount: number
  errorCount: number
  lastUpdated: string
}