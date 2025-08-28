import * as vscode from "vscode"
import { LMAPIServer } from "./server/LMAPIServer"
import { Logger } from "./utils/Logger"
import { DEFAULT_CONFIG } from "./constants"

let server: LMAPIServer
let statusBarItem: vscode.StatusBarItem
let extensionContext: vscode.ExtensionContext

export function activate(context: vscode.ExtensionContext) {
  Logger.info("BasicLM extension activating")

  // store context for global state access
  extensionContext = context

  // initialize server
  server = new LMAPIServer()

  // create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = "basiclm.status"
  context.subscriptions.push(statusBarItem)

  // register commands
  registerCommands(context)

  // auto-start if configured, but check global state first
  const config = vscode.workspace.getConfiguration("basiclm")
  if (config.get<boolean>("autoStart", DEFAULT_CONFIG.autoStart)) {
    checkLanguageModelAccess().then(hasAccess => {
      if (hasAccess) {
        checkAndStartServer()
      } else {
        Logger.warn("auto-start skipped: Language Model access not available")
      }
    })
  }

  updateStatusBar()
  Logger.info("BasicLM extension activated")
}

export function deactivate() {
  Logger.info("BasicLM extension deactivating")

  if (server) {
    server.dispose()
  }

  if (statusBarItem) {
    statusBarItem.dispose()
  }

  Logger.info("BasicLM extension deactivated")
}

function registerCommands(context: vscode.ExtensionContext) {
  // start server command
  const startCommand = vscode.commands.registerCommand("basiclm.start", async () => {
    try {
      // Check global state to see if another window has a server running
      const globalServerState = getGlobalServerState()
      if (globalServerState?.isRunning) {
        vscode.window.showWarningMessage("BasicLM is already running in another window")
        return
      }
      
      if (server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is already running")
        return
      }

      await server.start()
      
      // Update global state to inform other windows
      await updateGlobalServerState(true)
      
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM started successfully")
    } catch (error) {
      const errorMessage = `BasicLM failed to start: ${(error as Error).message}`
      Logger.error(errorMessage, { error: error as Error })
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // stop server command
  const stopCommand = vscode.commands.registerCommand("basiclm.stop", async () => {
    try {
      if (!server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is not running")
        return
      }

      await server.stop()
      
      // Update global state to inform other windows
      await updateGlobalServerState(false)
      
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM stopped")
    } catch (error) {
      const errorMessage = `BasicLM failed to stop: ${(error as Error).message}`
      Logger.error(errorMessage, { error: error as Error })
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // restart server command
  const restartCommand = vscode.commands.registerCommand("basiclm.restart", async () => {
    try {
      await server.restart()
      
      // Update global state
      await updateGlobalServerState(server.isRunning())
      
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM restarted")
    } catch (error) {
      const errorMessage = `BasicLM failed to restart: ${(error as Error).message}`
      Logger.error(errorMessage, { error: error as Error })
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // configure command
  const configureCommand = vscode.commands.registerCommand("basiclm.configure", async () => {
    await vscode.commands.executeCommand("workbench.action.openSettings", "basiclm")
  })

  // status command
  const statusCommand = vscode.commands.registerCommand("basiclm.status", showServerStatus)

  context.subscriptions.push(
    startCommand,
    stopCommand,
    restartCommand,
    configureCommand,
    statusCommand,
  )
}

function updateStatusBar() {
  const state = server.getState()
  const globalState = getGlobalServerState()

  if (state.isRunning) {
    statusBarItem.text = `$(server) BasicLM :${state.port}`
    statusBarItem.tooltip = `BasicLM is running: http://${state.host}:${state.port}`
    statusBarItem.backgroundColor = undefined
  } else if (globalState?.isRunning) {
    statusBarItem.text = "$(server) BasicLM (external)"
    statusBarItem.tooltip = "BasicLM is running in another window"
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground")
  } else {
    statusBarItem.text = "$(server) BasicLM (stopped)"
    statusBarItem.tooltip = "BasicLM is stopped"
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
  }

  statusBarItem.show()
}

async function showServerStatus() {
  const state = server.getState()
  const globalState = getGlobalServerState()
  let items, status

  if (state.isRunning) {
    items = [
      {
        label: "Stop Server",
        action: "basiclm.stop",
      },
      {
        label: "Restart Server",
        action: "basiclm.restart",
      },
      {
        label: "Configure",
        description: "Open VS Code settings for BasicLM",
        action: "basiclm.configure",
      },
    ]
    status = `Running on http://${state.host}:${state.port} | Requests: ${state.requestCount}`
  } else if (globalState?.isRunning) {
    items = [
      {
        label: "Configure",
        description: "Open VS Code settings for BasicLM",
        action: "basiclm.configure",
      },
    ]
    status = "Server running in another window"
  } else {
    const config = server.getConfig()
    items = [
      {
        label: "Start Server",
        description: `Start on http://${config.host}:${config.port}`,
        action: "basiclm.start",
      },
      {
        label: "Configure",
        description: "Open VS Code settings for BasicLM",
        action: "basiclm.configure",
      },
    ]
    status = "Stopped"
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: "BasicLM Status",
    placeHolder: status,
  })

  if (selected) await vscode.commands.executeCommand(selected.action)
}

async function checkLanguageModelAccess(): Promise<boolean> {
  try {
    const models = await vscode.lm.selectChatModels()
    return models.length > 0
  } catch (error) {
    Logger.warn("language model access check failed", { error: (error as Error).message })
    return false
  }
}

/**
 * Get server state key for global state storage
 */
function getServerStateKey(): string {
  const config = server.getConfig()
  return `basiclm.serverState.${config.host}:${config.port}`
}

/**
 * Interface for global server state
 */
interface GlobalServerState {
  isRunning: boolean
  port?: number
  host?: string
  lastUpdated: string
}

/**
 * Get global server state from extension global state
 */
function getGlobalServerState(): GlobalServerState | undefined {
  if (!extensionContext) return undefined
  
  const stateKey = getServerStateKey()
  return extensionContext.globalState.get(stateKey)
}

/**
 * Update global server state
 */
async function updateGlobalServerState(isRunning: boolean): Promise<void> {
  if (!extensionContext) return
  
  const state = server.getState()
  const stateKey = getServerStateKey()
  
  const globalState: GlobalServerState = {
    isRunning,
    port: isRunning ? state.port : undefined,
    host: isRunning ? state.host : undefined,
    lastUpdated: new Date().toISOString(),
  }
  
  await extensionContext.globalState.update(stateKey, globalState)
}

/**
 * Check if we should auto-start based on global state
 */
async function checkAndStartServer(): Promise<void> {
  const globalState = getGlobalServerState()
  
  if (globalState?.isRunning) {
    // Another window is already running the server
    Logger.info("Server is already running in another window")
    updateStatusBar()
  } else {
    // No server running, start our own
    await vscode.commands.executeCommand("basiclm.start")
  }
}
