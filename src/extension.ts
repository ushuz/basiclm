import * as vscode from "vscode"
import { LMAPIServer } from "./server/LMAPIServer"
import { Logger } from "./utils/Logger"
import { DEFAULT_CONFIG } from "./constants"

let server: LMAPIServer
let statusBarItem: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  Logger.info("BasicLM extension activating")

  // initialize server
  server = new LMAPIServer()

  // create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = "basiclm.status"
  context.subscriptions.push(statusBarItem)

  // register commands
  registerCommands(context)

  // auto-start if configured
  const config = vscode.workspace.getConfiguration("basiclm")
  if (config.get<boolean>("autoStart", DEFAULT_CONFIG.autoStart)) {
    checkLanguageModelAccess().then(hasAccess => {
      if (hasAccess) {
        vscode.commands.executeCommand("basiclm.start")
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
      if (server.isRunning()) {
        vscode.window.showWarningMessage("BasicLM is already running")
        return
      }

      await server.start()
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM started successfully")
    } catch (error) {
      const errorMessage = `BasicLM failed to start: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
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
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM stopped")
    } catch (error) {
      const errorMessage = `BasicLM failed to stop: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
      vscode.window.showErrorMessage(errorMessage)
    }
  })

  // restart server command
  const restartCommand = vscode.commands.registerCommand("basiclm.restart", async () => {
    try {
      await server.restart()
      updateStatusBar()
      vscode.window.showInformationMessage("BasicLM restarted")
    } catch (error) {
      const errorMessage = `BasicLM failed to restart: ${(error as Error).message}`
      Logger.error(errorMessage, error as Error)
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

  if (state.isRunning) {
    statusBarItem.text = `$(server) BasicLM :${state.port}`
    statusBarItem.tooltip = `BasicLM is running: http://${state.host}:${state.port}`
    statusBarItem.backgroundColor = undefined
  } else {
    statusBarItem.text = "$(server) BasicLM (stopped)"
    statusBarItem.tooltip = "BasicLM is stopped"
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
  }

  statusBarItem.show()
}

async function showServerStatus() {
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
