import * as vscode from "vscode"
import { LMAPIServer } from "./server/LMAPIServer"
import { Logger } from "./utils/Logger"
import { DEFAULT_CONFIG } from "./constants"
import { isServerRunning, getServerStateKey, GlobalServerState } from "./utils/ServerUtils"

let server: LMAPIServer
let statusBarItem: vscode.StatusBarItem
let extensionContext: vscode.ExtensionContext
let statusCheckInterval: NodeJS.Timeout | undefined

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

  // start status monitoring
  startStatusMonitoring()

  // auto-start if configured and no server is running
  const config = vscode.workspace.getConfiguration("basiclm")
  if (config.get<boolean>("autoStart", DEFAULT_CONFIG.autoStart)) {
    checkLanguageModelAccess().then(hasAccess => {
      if (hasAccess) {
        // Check if server is already running before auto-starting
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

  // stop status monitoring
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = undefined
  }

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
      const config = server.getConfig()
      
      // Check if server is already running somewhere
      if (await isServerRunning(config)) {
        vscode.window.showWarningMessage("BasicLM is already running in another window")
        // Sync with existing server state
        await syncServerStatus()
        return
      }
      
      if (server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is already running")
        return
      }

      await server.start()
      
      // Update global state
      const state = server.getState()
      await updateGlobalServerState({
        isRunning: true,
        port: state.port,
        host: state.host,
        startTime: state.startTime?.toISOString(),
        requestCount: state.requestCount,
        errorCount: state.errorCount,
        lastUpdated: new Date().toISOString(),
      })
      
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
        // Check if server is running elsewhere
        const config = server.getConfig()
        if (await isServerRunning(config)) {
          vscode.window.showWarningMessage("Cannot stop server running in another window")
          return
        }
        vscode.window.showWarningMessage("BasicLM is not running")
        return
      }

      await server.stop()
      
      // Update global state
      await updateGlobalServerState({
        isRunning: false,
        requestCount: 0,
        errorCount: 0,
        lastUpdated: new Date().toISOString(),
      })
      
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
      const state = server.getState()
      await updateGlobalServerState({
        isRunning: state.isRunning,
        port: state.port,
        host: state.host,
        startTime: state.startTime?.toISOString(),
        requestCount: state.requestCount,
        errorCount: state.errorCount,
        lastUpdated: new Date().toISOString(),
      })
      
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

  // sync command
  const syncCommand = vscode.commands.registerCommand("basiclm.sync", async () => {
    try {
      await syncServerStatus()
      vscode.window.showInformationMessage("Synced with external server state")
    } catch (error) {
      const errorMessage = `Failed to sync server state: ${(error as Error).message}`
      Logger.error(errorMessage, { error: error as Error })
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  context.subscriptions.push(
    startCommand,
    stopCommand,
    restartCommand,
    configureCommand,
    statusCommand,
    syncCommand,
  )
}

function updateStatusBar() {
  const state = server.getState()

  if (state.isRunning) {
    statusBarItem.text = `$(server) BasicLM :${state.port}`
    statusBarItem.tooltip = `BasicLM is running: http://${state.host}:${state.port}`
    statusBarItem.backgroundColor = undefined
  } else {
    // Check if server might be running externally
    const config = server.getConfig()
    isServerRunning(config).then(isRunningElsewhere => {
      if (isRunningElsewhere) {
        statusBarItem.text = "$(server) BasicLM (external)"
        statusBarItem.tooltip = `BasicLM is running in another window: http://${config.host}:${config.port}`
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground")
      } else {
        statusBarItem.text = "$(server) BasicLM (stopped)"
        statusBarItem.tooltip = "BasicLM is stopped"
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
      }
    }).catch(() => {
      // If check fails, assume stopped
      statusBarItem.text = "$(server) BasicLM (stopped)"
      statusBarItem.tooltip = "BasicLM is stopped"
      statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
    })
  }

  statusBarItem.show()
}

async function showServerStatus() {
  // First sync with actual server state
  await syncServerStatus()
  
  const state = server.getState()
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
  } else {
    const config = server.getConfig()
    
    // Check if server is running elsewhere
    const isRunningElsewhere = await isServerRunning(config)
    if (isRunningElsewhere) {
      items = [
        {
          label: "Sync with Running Server",
          description: "Connect to server running in another window",
          action: "basiclm.sync",
        },
        {
          label: "Configure",
          description: "Open VS Code settings for BasicLM",
          action: "basiclm.configure",
        },
      ]
      status = `Server running in another window on http://${config.host}:${config.port}`
    } else {
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
 * Get global server state from extension global state
 */
function getGlobalServerState(): GlobalServerState | undefined {
  if (!extensionContext) return undefined
  
  const config = server.getConfig()
  const stateKey = getServerStateKey(config)
  return extensionContext.globalState.get(stateKey)
}

/**
 * Update global server state
 */
async function updateGlobalServerState(state: GlobalServerState): Promise<void> {
  if (!extensionContext) return
  
  const config = server.getConfig()
  const stateKey = getServerStateKey(config)
  await extensionContext.globalState.update(stateKey, state)
}

/**
 * Check if server is running and start if needed
 */
async function checkAndStartServer(): Promise<void> {
  const config = server.getConfig()
  const isRunning = await isServerRunning(config)
  
  if (isRunning) {
    // Server is already running (possibly in another window)
    Logger.info("Server is already running in another instance")
    // Update our local state and global state
    await updateGlobalServerState({
      isRunning: true,
      port: config.port,
      host: config.host,
      startTime: new Date().toISOString(),
      requestCount: 0,
      errorCount: 0,
      lastUpdated: new Date().toISOString(),
    })
  } else {
    // No server running, start our own
    await vscode.commands.executeCommand("basiclm.start")
  }
}

/**
 * Start periodic status monitoring to sync between windows
 */
function startStatusMonitoring(): void {
  // Check status every 5 seconds
  statusCheckInterval = setInterval(async () => {
    await syncServerStatus()
  }, 5000)
}

/**
 * Sync server status across all windows
 */
async function syncServerStatus(): Promise<void> {
  const config = server.getConfig()
  const actuallyRunning = await isServerRunning(config)
  const localState = server.getState()
  const globalState = getGlobalServerState()
  
  // If actual state differs from what we think, update accordingly
  if (actuallyRunning !== localState.isRunning) {
    if (actuallyRunning) {
      // Server started in another window
      if (globalState) {
        Logger.info("Server started in another window, syncing state")
        server.syncExternalState({
          isRunning: true,
          port: globalState.port,
          host: globalState.host,
          startTime: globalState.startTime ? new Date(globalState.startTime) : undefined,
          requestCount: globalState.requestCount,
          errorCount: globalState.errorCount,
        })
      }
    } else {
      // Server stopped in another window
      Logger.info("Server stopped in another window, syncing state")
      server.syncExternalState({
        isRunning: false,
        port: undefined,
        host: undefined,
        startTime: undefined,
        requestCount: 0,
        errorCount: 0,
      })
      
      // Clear global state
      await updateGlobalServerState({
        isRunning: false,
        requestCount: 0,
        errorCount: 0,
        lastUpdated: new Date().toISOString(),
      })
    }
    
    updateStatusBar()
  }
}
